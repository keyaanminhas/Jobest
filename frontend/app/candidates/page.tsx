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
  const [statusFilter, setStatusFilter] = useState("all");
  const [scoreTypeFilter, setScoreTypeFilter] = useState("all");
  const [recommendationFilter, setRecommendationFilter] = useState("all");
  const [postingFilter, setPostingFilter] = useState("all");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const urlParams = new URLSearchParams(window.location.search);
    setQuery((urlParams.get("q") || "").trim().toLowerCase());
    const jobId = (urlParams.get("jobId") || "").trim();
    if (jobId) {
      setPostingFilter(jobId);
    }
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
    return rows.filter((candidate) => {
      if (statusFilter !== "all" && candidate.analysis_status !== statusFilter) return false;
      if (scoreTypeFilter !== "all" && candidate.current_score_type !== scoreTypeFilter) return false;
      if (recommendationFilter !== "all" && (candidate.recommendation || "none") !== recommendationFilter) return false;
      if (postingFilter !== "all" && candidate.job_posting_id !== postingFilter) return false;
      if (!query) return true;
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
  }, [postingFilter, query, recommendationFilter, rows, scoreTypeFilter, statusFilter]);

  const postingOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const candidate of rows) {
      map.set(candidate.job_posting_id, candidate.job_posting_title);
    }
    return [...map.entries()];
  }, [rows]);

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
      subtitle={
        postingFilter !== "all"
          ? "Applicant operations view filtered to a single job posting with triage/final score tracking and one-click analysis."
          : "Applicant operations view across job postings with triage/final score tracking and one-click analysis."
      }
    >
      <Panel title="Candidate Operations" subtitle="Current score uses triage (0-80) until full analysis completes, then switches to final score (0-100).">
        <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search candidate, role, recommendation..."
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-accent focus:bg-white"
          />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-accent focus:bg-white">
            <option value="all">All statuses</option>
            <option value="not_started">Not started</option>
            <option value="queued">Queued</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="error">Error</option>
          </select>
          <select value={scoreTypeFilter} onChange={(event) => setScoreTypeFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-accent focus:bg-white">
            <option value="all">All score types</option>
            <option value="triage">Triage (0-80)</option>
            <option value="final">Final (0-100)</option>
          </select>
          <select value={recommendationFilter} onChange={(event) => setRecommendationFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-accent focus:bg-white">
            <option value="all">All recommendations</option>
            <option value="Strong Shortlist">Strong Shortlist</option>
            <option value="Shortlist">Shortlist</option>
            <option value="Maybe">Maybe</option>
            <option value="Reject">Reject</option>
            <option value="none">Pending recommendation</option>
          </select>
          <select value={postingFilter} onChange={(event) => setPostingFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-accent focus:bg-white">
            <option value="all">All postings</option>
            {postingOptions.map(([id, title]) => (
              <option key={id} value={id}>{title}</option>
            ))}
          </select>
        </div>
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
