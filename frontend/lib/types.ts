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
