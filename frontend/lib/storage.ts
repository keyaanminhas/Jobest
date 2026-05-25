import { demoRun, demoRunId } from "@/lib/demo-data";
import { HiringRunRecord } from "@/lib/types";

const STORAGE_KEY = "jobest-local-runs";

function readStore(): Record<string, HiringRunRecord> {
  if (typeof window === "undefined") {
    return {};
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { [demoRunId]: demoRun };
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, HiringRunRecord>;
    return { [demoRunId]: demoRun, ...parsed };
  } catch {
    return { [demoRunId]: demoRun };
  }
}

export function saveRunLocal(run: HiringRunRecord) {
  const runs = readStore();
  runs[run.id] = run;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
}

export function getRunLocal(runId: string) {
  return readStore()[runId];
}

export function listRunsLocal() {
  return Object.values(readStore()).sort((a, b) => {
    const aDate = new Date(a.created_at ?? 0).getTime();
    const bDate = new Date(b.created_at ?? 0).getTime();
    return bDate - aDate;
  });
}
