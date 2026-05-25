"use client";

import { AppShell } from "@/components/app-shell";
import { EmptyState, Panel, RecommendationBadge, ScoreRing } from "@/components/ui";
import { analyzeCandidate, listAllCandidates } from "@/lib/api";
import { CandidateListItem } from "@/lib/types";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";

export default function CandidatesIndexPage() {
  const [rows, setRows] = useState<CandidateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlParams = new URLSearchParams(window.location.search);
    setQuery((urlParams.get("q") || "").trim().toLowerCase());
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await listAllCandidates();
        if (cancelled) return;
        setRows(data);
        setLoading(false);
      } catch (requestError) {
        if (cancelled) return;
        setError(requestError instanceof Error ? requestError.message : "Failed loading candidates.");
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredRows = useMemo(() => {
    if (!query) return rows;
    return rows.filter((candidate) => {
      const haystack = [
        candidate.display_name,
        candidate.job_posting_title,
        candidate.recommendation || "",
        candidate.current_score_type,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [query, rows]);

  function triggerRun(candidateId: string) {
    setError("");
    startTransition(async () => {
      try {
        await analyzeCandidate(candidateId);
        const refreshed = await listAllCandidates();
        setRows(refreshed);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Failed to start analysis.");
      }
    });
  }

  return (
    <AppShell
      title="Candidates"
      subtitle="Unified applicants list across all job postings, ranked by triage (0-80) before full analysis."
    >
      <Panel title="All Candidates" subtitle="Current score uses triage (0-80) until full analysis completes, then switches to final score (0-100).">
        {loading ? <div className="text-sm text-slate-500">Loading candidates...</div> : null}
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        {!loading && !error && filteredRows.length === 0 ? (
          <EmptyState title="No candidates found" body="Upload CVs under a job posting to populate this list." />
        ) : null}
        {!loading && !error && filteredRows.length > 0 ? (
          <div className="space-y-3">
            {filteredRows.map((candidate, index) => (
              <div key={candidate.id} className="grid gap-3 rounded-xl border border-slate-200 px-4 py-3 lg:grid-cols-[56px_1.2fr_1fr_130px_140px_230px] lg:items-center">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 font-semibold text-slate-700">{index + 1}</div>
                <div>
                  <div className="font-semibold text-slate-900">{candidate.display_name}</div>
                  <div className="text-xs text-slate-500">Applicant for: {candidate.job_posting_title}</div>
                </div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{candidate.current_score_type} score</div>
                <div className="flex lg:justify-center">
                  <ScoreRing score={candidate.current_score_type === "triage" ? (candidate.current_score / 80) * 100 : candidate.current_score} />
                </div>
                <div>{candidate.recommendation ? <RecommendationBadge recommendation={candidate.recommendation} /> : <span className="text-xs text-slate-500">Pending</span>}</div>
                <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                  {candidate.analysis_status !== "processing" && candidate.analysis_status !== "queued" ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => triggerRun(candidate.id)}
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                    >
                      Run analysis
                    </button>
                  ) : (
                    <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-accent">Running...</span>
                  )}
                  <Link
                    href={candidate.report_ready ? `/candidates/${candidate.id}/report` : `/candidates/${candidate.id}`}
                    className="rounded-lg border border-accent px-3 py-1.5 text-xs font-semibold text-accent"
                  >
                    {candidate.report_ready ? "View report" : "Open"}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </Panel>
    </AppShell>
  );
}
