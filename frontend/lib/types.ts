export type Recommendation = "Strong Shortlist" | "Shortlist" | "Maybe" | "Reject";

export type CandidateInput = {
  name: string;
  resume_text: string;
  professional_links?: {
    github?: string | null;
    portfolio?: string | null;
    linkedin?: string | null;
    kaggle?: string | null;
    scholar?: string | null;
  } | null;
  notes?: string | null;
};

export type PipelineStage = {
  stage: string;
  status: string;
  summary: string;
  raw_output: Record<string, unknown>;
};

export type CandidateScore = {
  requirement_match: number;
  evidence_strength: number;
  professional_footprint: number;
  hiring_context_fit: number;
  risk_penalty: number;
  final_score: number;
  recommendation: Recommendation;
  score_explanation?: string;
};

export type TopCandidate = {
  rank: number;
  candidate_name: string;
  status: string;
  final_score: number;
  recommendation: Recommendation;
  score_breakdown: CandidateScore;
  top_strengths: string[];
  key_risks: string[];
  why: string;
};

export type CandidateRecord = {
  candidate: CandidateInput;
  status: string;
  parsed_profile?: {
    candidate_name?: string;
    education?: Array<Record<string, unknown>>;
    work_experience?: Array<Record<string, unknown>>;
    projects?: Array<Record<string, unknown>>;
    skills?: string[];
    tools?: string[];
    certifications?: string[];
    achievements?: string[];
    professional_links?: string[];
  };
  evidence?: {
    evidence_items?: Array<{
      skill: string;
      evidence: string;
      source: string;
      confidence: "high" | "medium" | "low";
    }>;
    unsupported_claims?: Array<{
      claim: string;
      reason: string;
    }>;
  };
  transferable_skills?: {
    exact_matches?: Array<{
      requirement: string;
      candidate_skill: string;
      evidence?: string;
      reasoning?: string;
      confidence?: string;
    }>;
    transferable_matches?: Array<{
      requirement: string;
      candidate_skill: string;
      evidence?: string;
      reasoning?: string;
      confidence?: string;
    }>;
    missing_requirements?: Array<{
      requirement: string;
      reason: string;
    }>;
  };
  professional_footprint?: {
    portfolio_score?: number;
    github_score?: number;
    claim_support?: string;
    professional_evidence?: string[];
    concerns?: string[];
    supported_resume_claims?: string[];
    unsupported_resume_claims?: string[];
  };
  risk_audit?: {
    risk_level?: string;
    risk_penalty?: number;
    risks?: string[];
    recommended_interview_focus?: string[];
  };
  score: CandidateScore;
  panel_review?: {
    technical_lead_view?: string;
    hr_recruiter_view?: string;
    hiring_manager_view?: string;
    risk_auditor_view?: string;
    final_panel_recommendation?: string;
  };
  interview_pack?: {
    technical_questions?: Array<{ question: string; what_to_listen_for: string }>;
    behavioral_questions?: Array<{ question: string; what_to_listen_for: string }>;
    risk_validation_questions?: Array<{ question: string; what_to_listen_for: string }>;
  };
  why_this_candidate?: string;
  why_not_this_candidate?: string;
  error?: string;
};

export type HiringRunRecord = {
  id: string;
  title: string;
  job_description: string;
  hiring_context: string;
  company_priority?: string | null;
  must_have_skills: string[];
  nice_to_have_skills: string[];
  candidates: CandidateInput[];
  status: string;
  created_at?: string;
  results?: {
    run_id: string;
    status: string;
    pipeline: PipelineStage[];
    top_candidates: TopCandidate[];
    report: string;
    report_data?: {
      summary?: string;
      job_summary?: string;
      hiring_context_summary?: string;
      top_5_summary?: string;
      top_candidates?: TopCandidate[];
      candidate_explanations?: Array<{ candidate_name: string; explanation: string }>;
      risks_to_verify?: string[];
      final_recommendation?: string;
      suggested_next_action?: string;
    };
    candidates?: CandidateRecord[];
  };
};

export type HealthResponse = {
  status: string;
  app_env: string;
  llm_mode: string;
  provider: string;
  base_url: string;
  model: string;
};

export type CreateHiringRunPayload = {
  title: string;
  job_description: string;
  hiring_context: string;
  company_priority?: string;
  must_have_skills: string[];
  nice_to_have_skills: string[];
  candidates: CandidateInput[];
};

export type SingleCvRunResponse = {
  run_id: string;
  status: string;
  run: HiringRunRecord;
};

export type AuthResponse = {
  access_token: string;
  token_type: "bearer";
  user_id: string;
  email: string;
  full_name?: string | null;
};

export type CurrentUserResponse = {
  id: string;
  email: string;
  full_name?: string | null;
  created_at: string;
};

export type CreateJobPostingPayload = {
  title: string;
  job_description: string;
  hiring_context: string;
  company_priority?: string;
  must_have_skills: string[];
  nice_to_have_skills: string[];
};

export type JobPostingRecord = {
  id: string;
  title: string;
  job_description: string;
  hiring_context: string;
  company_priority?: string | null;
  status: string;
  must_have_skills: string[];
  nice_to_have_skills: string[];
  created_at: string;
  updated_at: string;
};

export type CandidateListItem = {
  id: string;
  job_posting_id: string;
  job_posting_title: string;
  display_name: string;
  upload_status: string;
  analysis_status: string;
  triage_status: string;
  triage_score: number;
  keyword_match_score: number;
  llm_triage_score: number;
  triage_summary: string;
  current_score: number;
  current_score_type: "triage" | "final";
  final_score?: number | null;
  recommendation?: string | null;
  report_ready: boolean;
  resume_url: string;
  created_at: string;
};

export type CandidateDetail = {
  id: string;
  job_posting_id: string;
  job_posting_title: string;
  display_name: string;
  resume_text: string;
  upload_status: string;
  analysis_status: string;
  links: Record<string, string>;
  triage_score: number;
  triage_summary: string;
  keyword_match_score: number;
  llm_triage_score: number;
  current_score: number;
  current_score_type: "triage" | "final";
  final_score?: number | null;
  recommendation?: string | null;
  report_ready: boolean;
  resume_url: string;
};

export type CandidateAnalysisStage = {
  stage: string;
  status: string;
  summary: string;
  raw_output: Record<string, unknown>;
  created_at: string;
};

export type CandidateAnalysisResponse = {
  candidate_id: string;
  analysis_run_id?: string | null;
  status: string;
  stages: CandidateAnalysisStage[];
  final_score?: number | null;
  recommendation?: string | null;
  report_summary?: string | null;
};

export type CandidateReportResponse = {
  candidate_id: string;
  analysis_run_id: string;
  score: Record<string, unknown>;
  report: Record<string, unknown>;
  panel_review: Record<string, unknown>;
  interview_pack: Record<string, unknown>;
};

export type DeepDiveEvidenceRow = {
  requirement: string;
  match_type: "exact" | "transferable" | "missing" | "unclassified";
  evidence: string;
  confidence_label: string;
  confidence_score: number;
};

export type DeepDiveMatchBuckets = {
  exact: Array<{ requirement: string; detail: string }>;
  transferable: Array<{ requirement: string; detail: string }>;
  missing: Array<{ requirement: string; detail: string }>;
};

export type DeepDivePanelSummary = {
  technical_lead_view: string;
  hr_recruiter_view: string;
  hiring_manager_view: string;
  risk_auditor_view: string;
  final_panel_recommendation: string;
};

export type CandidateReportViewModel = {
  candidate_id: string;
  candidate_name: string;
  job_posting_title: string;
  final_score: number;
  recommendation: string;
  candidate_summary: string;
  why_this_candidate: string;
  risk_flags: string[];
  interview_focus: string[];
  evidence_rows: DeepDiveEvidenceRow[];
  matches: DeepDiveMatchBuckets;
  professional_footprint_summary: string;
  professional_links: Record<string, string>;
  panel: DeepDivePanelSummary;
};

export type CandidateReportListItem = {
  candidate_id: string;
  candidate_name: string;
  job_posting_id: string;
  job_posting_title: string;
  analysis_run_id: string;
  final_score?: number | null;
  recommendation?: string | null;
  completed_at?: string | null;
};

export type AnalysisQueueStatus = {
  queue_size_total: number;
  queue_size_user: number;
  current_candidate_id?: string | null;
  current_candidate_name?: string | null;
  current_job_posting_id?: string | null;
  current_job_posting_title?: string | null;
  current_run_id?: string | null;
  current_status?: string | null;
  current_stage?: string | null;
  current_progress_percent: number;
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  notification_type: string;
  candidate_id?: string | null;
  analysis_run_id?: string | null;
  is_read: boolean;
  created_at: string;
};

export type NotificationListResponse = {
  items: NotificationItem[];
  unread_count: number;
};
