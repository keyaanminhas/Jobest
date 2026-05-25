"""initial org workflow schema

Revision ID: 20260525_0001
Revises:
Create Date: 2026-05-25
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260525_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("last_login_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "job_postings",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("job_description", sa.Text(), nullable=False),
        sa.Column("hiring_context", sa.Text(), nullable=False),
        sa.Column("company_priority", sa.String(length=255), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_job_postings_user_id", "job_postings", ["user_id"], unique=False)

    op.create_table(
        "job_posting_skills",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("job_posting_id", sa.String(length=36), sa.ForeignKey("job_postings.id"), nullable=False),
        sa.Column("skill_name", sa.String(length=255), nullable=False),
        sa.Column("skill_type", sa.String(length=32), nullable=False),
    )
    op.create_index("ix_job_posting_skills_posting_id", "job_posting_skills", ["job_posting_id"], unique=False)

    op.create_table(
        "candidates",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("job_posting_id", sa.String(length=36), sa.ForeignKey("job_postings.id"), nullable=False),
        sa.Column("uploaded_by_user_id", sa.String(length=36), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("resume_file_path", sa.Text(), nullable=False),
        sa.Column("resume_sha256", sa.String(length=64), nullable=False),
        sa.Column("resume_text", sa.Text(), nullable=False),
        sa.Column("upload_status", sa.String(length=32), nullable=False),
        sa.Column("analysis_status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_candidates_job_posting_id", "candidates", ["job_posting_id"], unique=False)
    op.create_index("ix_candidates_uploaded_by_user_id", "candidates", ["uploaded_by_user_id"], unique=False)
    op.create_index("ix_candidates_resume_sha256", "candidates", ["resume_sha256"], unique=False)

    op.create_table(
        "candidate_links",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("candidate_id", sa.String(length=36), sa.ForeignKey("candidates.id"), nullable=False),
        sa.Column("link_type", sa.String(length=32), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
    )
    op.create_index("ix_candidate_links_candidate_id", "candidate_links", ["candidate_id"], unique=False)

    op.create_table(
        "candidate_triage",
        sa.Column("candidate_id", sa.String(length=36), sa.ForeignKey("candidates.id"), primary_key=True),
        sa.Column("keyword_match_score", sa.Float(), nullable=False),
        sa.Column("llm_triage_score", sa.Float(), nullable=False),
        sa.Column("triage_score", sa.Float(), nullable=False),
        sa.Column("triage_summary", sa.Text(), nullable=False),
        sa.Column("triage_status", sa.String(length=32), nullable=False),
        sa.Column("rank_last_computed_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_candidate_triage_score", "candidate_triage", ["triage_score"], unique=False)

    op.create_table(
        "candidate_analysis_runs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("candidate_id", sa.String(length=36), sa.ForeignKey("candidates.id"), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.Column("final_score", sa.Float(), nullable=True),
        sa.Column("recommendation", sa.String(length=64), nullable=True),
        sa.Column("report_summary", sa.Text(), nullable=True),
    )
    op.create_index("ix_candidate_analysis_runs_candidate_id", "candidate_analysis_runs", ["candidate_id"], unique=False)

    op.create_table(
        "candidate_stage_outputs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("analysis_run_id", sa.String(length=36), sa.ForeignKey("candidate_analysis_runs.id"), nullable=False),
        sa.Column("stage_name", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("raw_output_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_candidate_stage_outputs_analysis_run_id", "candidate_stage_outputs", ["analysis_run_id"], unique=False)

    op.create_table(
        "candidate_final_outputs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("candidate_id", sa.String(length=36), sa.ForeignKey("candidates.id"), nullable=False),
        sa.Column("analysis_run_id", sa.String(length=36), sa.ForeignKey("candidate_analysis_runs.id"), nullable=False),
        sa.Column("score_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("report_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("panel_review_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("interview_pack_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.UniqueConstraint("candidate_id", name="uq_candidate_final_output_candidate"),
    )
    op.create_index("ix_candidate_final_outputs_candidate_id", "candidate_final_outputs", ["candidate_id"], unique=False)
    op.create_index("ix_candidate_final_outputs_analysis_run_id", "candidate_final_outputs", ["analysis_run_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_candidate_final_outputs_analysis_run_id", table_name="candidate_final_outputs")
    op.drop_index("ix_candidate_final_outputs_candidate_id", table_name="candidate_final_outputs")
    op.drop_table("candidate_final_outputs")

    op.drop_index("ix_candidate_stage_outputs_analysis_run_id", table_name="candidate_stage_outputs")
    op.drop_table("candidate_stage_outputs")

    op.drop_index("ix_candidate_analysis_runs_candidate_id", table_name="candidate_analysis_runs")
    op.drop_table("candidate_analysis_runs")

    op.drop_index("ix_candidate_triage_score", table_name="candidate_triage")
    op.drop_table("candidate_triage")

    op.drop_index("ix_candidate_links_candidate_id", table_name="candidate_links")
    op.drop_table("candidate_links")

    op.drop_index("ix_candidates_resume_sha256", table_name="candidates")
    op.drop_index("ix_candidates_uploaded_by_user_id", table_name="candidates")
    op.drop_index("ix_candidates_job_posting_id", table_name="candidates")
    op.drop_table("candidates")

    op.drop_index("ix_job_posting_skills_posting_id", table_name="job_posting_skills")
    op.drop_table("job_posting_skills")

    op.drop_index("ix_job_postings_user_id", table_name="job_postings")
    op.drop_table("job_postings")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
