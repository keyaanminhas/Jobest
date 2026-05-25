"use client";

import { demoRun, demoRunId } from "@/lib/demo-data";
import { clearAuthToken, getAuthToken, setAuthToken } from "@/lib/session";
import { getRunLocal, saveRunLocal } from "@/lib/storage";
import {
  AnalysisQueueStatus,
  AuthResponse,
  CandidateAnalysisResponse,
  CandidateDetail,
  CandidateListItem,
  CandidateReportListItem,
  CandidateReportResponse,
  CreateHiringRunPayload,
  CreateJobPostingPayload,
  CurrentUserResponse,
  HealthResponse,
  HiringRunRecord,
  JobPostingRecord,
  NotificationListResponse,
  SingleCvRunResponse,
} from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? "change-this-demo-key";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const bodyIsFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "X-API-Key": API_KEY,
      ...(bodyIsFormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

async function requestOrg<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  if (!token) {
    throw new Error("Not authenticated.");
  }
  const bodyIsFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(bodyIsFormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const message = await response.text();
    if (response.status === 401) {
      clearAuthToken();
    }
    throw new Error(message || `Request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function getHealth() {
  const response = await fetch(`${API_BASE_URL}/health`, {
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }

  return (await response.json()) as HealthResponse;
}

export async function signup(email: string, password: string, fullName?: string) {
  const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, full_name: fullName }),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  const data = (await response.json()) as AuthResponse;
  setAuthToken(data.access_token);
  return data;
}

export async function login(email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  const data = (await response.json()) as AuthResponse;
  setAuthToken(data.access_token);
  return data;
}

export function logout() {
  clearAuthToken();
}

export async function getCurrentUser() {
  return requestOrg<CurrentUserResponse>("/api/auth/me");
}

export async function createJobPosting(payload: CreateJobPostingPayload) {
  return requestOrg<JobPostingRecord>("/api/job-postings", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listJobPostings() {
  return requestOrg<{ postings: JobPostingRecord[] }>("/api/job-postings");
}

export async function getJobPosting(jobPostingId: string) {
  return requestOrg<JobPostingRecord>(`/api/job-postings/${jobPostingId}`);
}

export async function deleteJobPosting(jobPostingId: string) {
  return requestOrg<{ deleted: boolean }>(`/api/job-postings/${jobPostingId}`, {
    method: "DELETE",
  });
}

export async function listCandidates(jobPostingId: string) {
  return requestOrg<CandidateListItem[]>(`/api/job-postings/${jobPostingId}/candidates`);
}

export async function uploadCandidates(
  jobPostingId: string,
  files: File[],
  additionalUrls?: string,
  additionalUrlsByFilename?: Record<string, string>,
) {
  const body = new FormData();
  for (const file of files) {
    body.append("cv_pdfs", file);
  }
  if (additionalUrls?.trim()) {
    body.append("additional_urls", additionalUrls.trim());
  }
  if (additionalUrlsByFilename && Object.keys(additionalUrlsByFilename).length > 0) {
    body.append("additional_urls_by_filename", JSON.stringify(additionalUrlsByFilename));
  }
  return requestOrg<{ job_posting_id: string; uploaded_count: number; candidates: CandidateListItem[] }>(
    `/api/job-postings/${jobPostingId}/candidates/upload`,
    { method: "POST", body },
  );
}

export async function getCandidate(candidateId: string) {
  return requestOrg<CandidateDetail>(`/api/candidates/${candidateId}`);
}

export async function analyzeCandidate(candidateId: string) {
  return requestOrg<{ candidate_id: string; analysis_run_id: string; status: string; queue_position?: number | null }>(
    `/api/candidates/${candidateId}/analyze`,
    { method: "POST" },
  );
}

export async function getCandidateAnalysis(candidateId: string) {
  return requestOrg<CandidateAnalysisResponse>(`/api/candidates/${candidateId}/analysis`);
}

export async function getCandidateReport(candidateId: string) {
  return requestOrg<CandidateReportResponse>(`/api/candidates/${candidateId}/report`);
}

export async function getCandidateResumeBlob(candidateId: string) {
  const token = getAuthToken();
  if (!token) {
    throw new Error("Not authenticated.");
  }
  const response = await fetch(`${API_BASE_URL}/api/candidates/${candidateId}/resume`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }
  return response.blob();
}

export async function listAllCandidates() {
  return requestOrg<CandidateListItem[]>("/api/candidates");
}

export async function listReports() {
  return requestOrg<CandidateReportListItem[]>("/api/reports");
}

export async function getAnalysisQueueStatus() {
  return requestOrg<AnalysisQueueStatus>("/api/analysis-queue");
}

export async function getNotifications() {
  return requestOrg<NotificationListResponse>("/api/notifications");
}

export async function markNotificationRead(notificationId: string) {
  return requestOrg<{ ok: boolean }>(`/api/notifications/${notificationId}/read`, {
    method: "POST",
  });
}

export async function markAllNotificationsRead() {
  return requestOrg<{ ok: boolean; updated: number }>("/api/notifications/read-all", {
    method: "POST",
  });
}

export function toApiUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return `${API_BASE_URL}${path}`;
}

export async function createHiringRun(payload: CreateHiringRunPayload) {
  return request<{ run_id: string; status: string; run: HiringRunRecord }>("/api/hiring-runs", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function runHiringPipeline(runId: string) {
  return request<{
    run_id: string;
    status: string;
    pipeline: NonNullable<HiringRunRecord["results"]>["pipeline"];
    top_candidates: NonNullable<HiringRunRecord["results"]>["top_candidates"];
    report: string;
  }>(`/api/hiring-runs/${runId}/run`, {
    method: "POST",
  });
}

export async function uploadSingleCvRun(cvFile: File, candidateNameOverride?: string, additionalUrls?: string) {
  const body = new FormData();
  body.append("cv_pdf", cvFile);
  if (candidateNameOverride?.trim()) {
    body.append("candidate_name_override", candidateNameOverride.trim());
  }
  if (additionalUrls?.trim()) {
    body.append("additional_urls", additionalUrls.trim());
  }

  return request<SingleCvRunResponse>("/api/single-cv-runs", {
    method: "POST",
    body,
  });
}

export async function getHiringRun(runId: string) {
  return request<HiringRunRecord>(`/api/hiring-runs/${runId}`);
}

export async function getShortlist(runId: string) {
  return request<{ run_id: string; shortlist: NonNullable<HiringRunRecord["results"]>["top_candidates"] }>(
    `/api/hiring-runs/${runId}/shortlist`,
  );
}

export async function getReport(runId: string) {
  return request<{ run_id: string; report: NonNullable<HiringRunRecord["results"]>["report_data"] }>(
    `/api/hiring-runs/${runId}/report`,
  );
}

export async function resolveRun(runId: string): Promise<{ run: HiringRunRecord; source: "api" | "local" | "demo"; offline: boolean }> {
  if (runId === demoRunId) {
    return { run: demoRun, source: "demo", offline: true };
  }

  try {
    const run = await getHiringRun(runId);
    saveRunLocal(run);
    return { run, source: "api", offline: false };
  } catch {
    const local = getRunLocal(runId);
    if (local) {
      return { run: local, source: "local", offline: false };
    }
    throw new Error("Run not found in local cache or backend. Use live run upload or load the demo scenario.");
  }
}

export async function createDemoRun() {
  saveRunLocal(demoRun);
  return demoRun;
}
