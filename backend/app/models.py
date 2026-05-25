from datetime import datetime
from uuid import uuid4

from sqlalchemy import JSON, DateTime, Float, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def _uuid() -> str:
    return str(uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    job_postings: Mapped[list["JobPosting"]] = relationship(back_populates="owner")
    notifications: Mapped[list["Notification"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class JobPosting(Base):
    __tablename__ = "job_postings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    job_description: Mapped[str] = mapped_column(Text)
    hiring_context: Mapped[str] = mapped_column(Text)
    company_priority: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner: Mapped[User] = relationship(back_populates="job_postings")
    skills: Mapped[list["JobPostingSkill"]] = relationship(back_populates="job_posting", cascade="all, delete-orphan")
    candidates: Mapped[list["Candidate"]] = relationship(back_populates="job_posting", cascade="all, delete-orphan")


class JobPostingSkill(Base):
    __tablename__ = "job_posting_skills"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    job_posting_id: Mapped[str] = mapped_column(ForeignKey("job_postings.id"), index=True)
    skill_name: Mapped[str] = mapped_column(String(255))
    skill_type: Mapped[str] = mapped_column(String(32))

    job_posting: Mapped[JobPosting] = relationship(back_populates="skills")


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    job_posting_id: Mapped[str] = mapped_column(ForeignKey("job_postings.id"), index=True)
    uploaded_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    display_name: Mapped[str] = mapped_column(String(255))
    resume_file_path: Mapped[str] = mapped_column(Text)
    resume_sha256: Mapped[str] = mapped_column(String(64), index=True)
    resume_text: Mapped[str] = mapped_column(Text)
    upload_status: Mapped[str] = mapped_column(String(32), default="completed")
    analysis_status: Mapped[str] = mapped_column(String(32), default="not_started")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    job_posting: Mapped[JobPosting] = relationship(back_populates="candidates")
    links: Mapped[list["CandidateLink"]] = relationship(back_populates="candidate", cascade="all, delete-orphan")
    triage: Mapped["CandidateTriage"] = relationship(back_populates="candidate", cascade="all, delete-orphan", uselist=False)
    analysis_runs: Mapped[list["CandidateAnalysisRun"]] = relationship(back_populates="candidate", cascade="all, delete-orphan")
    final_output: Mapped["CandidateFinalOutput"] = relationship(back_populates="candidate", cascade="all, delete-orphan", uselist=False)


class CandidateLink(Base):
    __tablename__ = "candidate_links"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    candidate_id: Mapped[str] = mapped_column(ForeignKey("candidates.id"), index=True)
    link_type: Mapped[str] = mapped_column(String(32))
    url: Mapped[str] = mapped_column(Text)

    candidate: Mapped[Candidate] = relationship(back_populates="links")


class CandidateTriage(Base):
    __tablename__ = "candidate_triage"

    candidate_id: Mapped[str] = mapped_column(ForeignKey("candidates.id"), primary_key=True)
    keyword_match_score: Mapped[float] = mapped_column(Float, default=0.0)
    llm_triage_score: Mapped[float] = mapped_column(Float, default=0.0)
    triage_score: Mapped[float] = mapped_column(Float, default=0.0, index=True)
    triage_summary: Mapped[str] = mapped_column(Text, default="")
    triage_status: Mapped[str] = mapped_column(String(32), default="completed")
    rank_last_computed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    candidate: Mapped[Candidate] = relationship(back_populates="triage")


class CandidateAnalysisRun(Base):
    __tablename__ = "candidate_analysis_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    candidate_id: Mapped[str] = mapped_column(ForeignKey("candidates.id"), index=True)
    status: Mapped[str] = mapped_column(String(32), default="queued")
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    final_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    recommendation: Mapped[str | None] = mapped_column(String(64), nullable=True)
    report_summary: Mapped[str | None] = mapped_column(Text, nullable=True)

    candidate: Mapped[Candidate] = relationship(back_populates="analysis_runs")
    stage_outputs: Mapped[list["CandidateStageOutput"]] = relationship(
        back_populates="analysis_run",
        cascade="all, delete-orphan",
    )
    final_output: Mapped["CandidateFinalOutput"] = relationship(back_populates="analysis_run", uselist=False)


class CandidateStageOutput(Base):
    __tablename__ = "candidate_stage_outputs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    analysis_run_id: Mapped[str] = mapped_column(ForeignKey("candidate_analysis_runs.id"), index=True)
    stage_name: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(32))
    summary: Mapped[str] = mapped_column(Text, default="")
    raw_output_json: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    analysis_run: Mapped[CandidateAnalysisRun] = relationship(back_populates="stage_outputs")


class CandidateFinalOutput(Base):
    __tablename__ = "candidate_final_outputs"
    __table_args__ = (UniqueConstraint("candidate_id", name="uq_candidate_final_output_candidate"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    candidate_id: Mapped[str] = mapped_column(ForeignKey("candidates.id"), index=True)
    analysis_run_id: Mapped[str] = mapped_column(ForeignKey("candidate_analysis_runs.id"), index=True)
    score_json: Mapped[dict] = mapped_column(JSON, default=dict)
    report_json: Mapped[dict] = mapped_column(JSON, default=dict)
    panel_review_json: Mapped[dict] = mapped_column(JSON, default=dict)
    interview_pack_json: Mapped[dict] = mapped_column(JSON, default=dict)

    candidate: Mapped[Candidate] = relationship(back_populates="final_output")
    analysis_run: Mapped[CandidateAnalysisRun] = relationship(back_populates="final_output")


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    body: Mapped[str] = mapped_column(Text)
    notification_type: Mapped[str] = mapped_column(String(64), default="pipeline")
    candidate_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    analysis_run_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    is_read: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    user: Mapped[User] = relationship(back_populates="notifications")
