"use client";

import { demoRun, demoRunId } from "@/lib/demo-data";
import { getRunLocal, saveRunLocal } from "@/lib/storage";
import { CreateHiringRunPayload, HealthResponse, HiringRunRecord } from "@/lib/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const API_KEY = process.env.NEXT_PUBLIC_API_KEY ?? "change-this-demo-key";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
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

export async function parsePdf(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/parse-pdf`, {
    method: "POST",
    headers: {
      "X-API-Key": API_KEY,
    },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to parse PDF resume");
  }

  return (await response.json()) as { candidate_name: string; resume_text: string };
}

export async function listHiringRuns() {
  return request<HiringRunRecord[]>("/api/hiring-runs");
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

export async function getHiringRun(runId: string) {
  return request<HiringRunRecord>(`/api/hiring-runs/${runId}`);
}

export async function resolveRun(runId: string): Promise<{ run: HiringRunRecord; source: "api" | "local" | "demo"; offline: boolean }> {
  if (runId === demoRunId) {
    return { run: demoRun, source: "demo", offline: true };
  }

  try {
    const live = await getHiringRun(runId);
    // If the live run has status completed, save it locally for future caching
    if (live.status === "completed") {
      saveRunLocal(live);
    }
    return { run: live, source: "api", offline: false };
  } catch {
    const local = getRunLocal(runId);
    if (local) {
      return { run: local, source: "local", offline: true };
    }
    throw new Error("Local run not found and backend fetch failed. Use the live backend flow or load the demo scenario.");
  }
}

export async function createDemoRun() {
  saveRunLocal(demoRun);
  return demoRun;
}
