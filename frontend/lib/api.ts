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

export async function resolveRun(runId: string): Promise<{ run: HiringRunRecord; source: "api" | "local" | "demo"; offline: boolean }> {
  const local = getRunLocal(runId);
  if (local?.results?.candidates?.length) {
    return { run: local, source: runId === demoRunId ? "demo" : "local", offline: runId === demoRunId };
  }

  if (runId === demoRunId) {
    return { run: demoRun, source: "demo", offline: true };
  }

  throw new Error("Local run not found. Use the live backend flow or load the demo scenario.");
}

export async function createDemoRun() {
  saveRunLocal(demoRun);
  return demoRun;
}
