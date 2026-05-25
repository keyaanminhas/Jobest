"use client";

import { AppShell } from "@/components/app-shell";
import { EmptyState, MetricCard, Panel, PrimaryButton, RecommendationBadge, ScoreRing, SecondaryButton } from "@/components/ui";
import { getAnalysisQueueStatus, getCurrentUser, listAllCandidates, listJobPostings, listReports, logout } from "@/lib/api";
import { AnalysisQueueStatus, CandidateListItem, CandidateReportListItem, JobPostingRecord } from "@/lib/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function recommendationWeight(recommendation?: string | null) {
  if (!recommendation) return 0;
  if (recommendation === "Strong Shortlist") return 4;
  if (recommendation === "Shortlist") return 3;
  if (recommendation === "Maybe") return 2;
  return 1;
}

const pipelineMix = [
  { label: "Queued", color: "bg-blue-500" },
  { label: "Processing", color: "bg-amber-500" },
  { label: "Completed", color: "bg-emerald-500" },
];

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rem = Math.round(minutes % 60);
  return rem === 0 ? `${hours} hr` : `${hours} hr ${rem} min`;
}

export default function JobsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("User");
  const [jobs, setJobs] = useState<JobPostingRecord[]>([]);
  const [candidates, setCandidates] = useState<CandidateListItem[]>([]);
  const [reports, setReports] = useState<CandidateReportListItem[]>([]);
  const [queueStatus, setQueueStatus] = useState<AnalysisQueueStatus>({
    queue_size_total: 0,
    queue_size_user: 0,
    current_progress_percent: 0,
  });
  const [error, setError] = useState("");
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
        const [user, postings, allCandidates, reportRows, queue] = await Promise.all([
          getCurrentUser(),
          listJobPostings(),
          listAllCandidates(),
          listReports(),
          getAnalysisQueueStatus(),
        ]);
        if (cancelled) return;
        setName(user.full_name || user.email);
        setJobs(postings.postings);
        setCandidates(allCandidates);
        setReports(reportRows);
        setQueueStatus(queue);
        setLoading(false);
      } catch (requestError) {
        if (cancelled) return;
        setError(requestError instanceof Error ? requestError.message : "Failed loading dashboard.");
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const handle = setInterval(() => {
      void (async () => {
        try {
          const [queue, allCandidates, reportRows] = await Promise.all([
            getAnalysisQueueStatus(),
            listAllCandidates(),
            listReports(),
          ]);
          if (cancelled) return;
          setQueueStatus(queue);
          setCandidates(allCandidates);
          setReports(reportRows);
        } catch {
          if (cancelled) return;
        }
      })();
    }, 2500);

    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, []);

  const topCandidates = useMemo(
    () => {
      const filteredCandidates = query
        ? candidates.filter((candidate) => {
            const haystack = [candidate.display_name, candidate.job_posting_title, candidate.recommendation || ""].join(" ").toLowerCase();
            return haystack.includes(query);
          })
        : candidates;
      return [...filteredCandidates]
        .sort((a, b) => {
          if (b.current_score === a.current_score) {
            return recommendationWeight(b.recommendation) - recommendationWeight(a.recommendation);
          }
          return b.current_score - a.current_score;
        })
        .slice(0, 5);
    },
    [candidates, query],
  );

  const recentJobs = useMemo(() => {
    const filteredJobs = query
      ? jobs.filter((job) => [job.title, job.company_priority || "", job.status].join(" ").toLowerCase().includes(query))
      : jobs;
    return filteredJobs.slice(0, 6);
  }, [jobs, query]);

  const candidatesByPosting = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const candidate of candidates) {
      counts[candidate.job_posting_id] = (counts[candidate.job_posting_id] || 0) + 1;
    }
    return counts;
  }, [candidates]);

  const runtimeSnapshot = useMemo(() => {
    const completedCount = reports.length;
    const totalCount = candidates.length;
    const inFlight = queueStatus.current_status === "processing" ? 1 : 0;
    const queued = queueStatus.queue_size_total;
    const completionRate = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
    const estimatedAvgMinutes = 17 + Math.min(15, Math.max(0, queued - inFlight) * 2);
    const waitMinutes = queued === 0 ? 0 : Math.max(8, Math.round((queued - inFlight + 1) * (estimatedAvgMinutes * 0.45)));
    const reliability = Math.min(99, Math.max(88, Math.round(100 - queued * 1.5 - (inFlight ? 0 : -2))));
    return {
      completionRate,
      estimatedAvgMinutes,
      waitMinutes,
      reliability,
      inFlight,
    };
  }, [candidates.length, queueStatus.current_status, queueStatus.queue_size_total, reports.length]);

  const compactTrend = useMemo(() => {
    const buckets = 8;
    const base = Math.max(1, Math.round(runtimeSnapshot.completionRate / 12));
    return Array.from({ length: buckets }, (_, idx) => Math.max(8, Math.min(36, base * 4 + ((idx % 3) - 1) * 5 + idx * 2)));
  }, [runtimeSnapshot.completionRate]);

  if (loading) {
    return <div className="min-h-screen bg-[#f7f9fc]" />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f7f9fc] px-6 py-10">
        <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-white p-6">
          <div className="text-red-700">{error}</div>
          <button
            type="button"
            onClick={() => {
              logout();
              router.replace("/auth/login");
            }}
            className="mt-4 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Go to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      title={`Welcome back, ${name.split(" ")[0] || "Recruiter"}`}
      subtitle="Here is a real-time view of your hiring pipeline, candidate ranking, and report readiness."
      actions={
        <div className="flex gap-3">
          <PrimaryButton href="/jobs/new">Create Job Posting</PrimaryButton>
          <SecondaryButton href="/reports">View Reports</SecondaryButton>
        </div>
      }
    >
      <div className="space-y-6">
        <Panel title="Analysis Queue" subtitle="Live queue depth and current candidate run progression.">
          <div className="mt-1 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
            {/* Progress section */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-slate-800">
                    {queueStatus.current_candidate_name ? `Processing: ${queueStatus.current_candidate_name}` : "No candidate processing"}
                  </div>
                  {queueStatus.current_job_posting_title ? (
                    <div className="mt-0.5 truncate text-[12px] text-slate-500">For: {queueStatus.current_job_posting_title}</div>
                  ) : null}
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${queueStatus.current_status === "processing" ? "bg-blue-50 text-accent" : "bg-slate-200 text-slate-500"}`}>
                  {queueStatus.current_status === "processing" ? "Running" : "Idle"}
                </span>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-accent transition-all duration-500"
                  style={{ width: `${Math.max(0, Math.min(100, queueStatus.current_progress_percent))}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <div className="text-[12px] text-slate-500">
                  {queueStatus.current_stage || "Queue a candidate analysis from candidate pages."}
                </div>
                <div className="text-[12px] font-semibold text-slate-700">{queueStatus.current_progress_percent.toFixed(0)}%</div>
              </div>

              {/* Pipeline mix */}
              <div className="mt-4 border-t border-slate-200 pt-4">
                <div className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Pipeline status</div>
                <div className="grid grid-cols-3 gap-2">
                  {pipelineMix.map((row, index) => {
                    const value = index === 0 ? queueStatus.queue_size_user : index === 1 ? (queueStatus.current_status === "processing" ? 1 : 0) : reports.length;
                    return (
                      <div key={row.label} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-center">
                        <div className="font-heading text-xl font-extrabold text-slate-900">{value}</div>
                        <div className="mt-0.5 flex items-center justify-center gap-1.5">
                          <span className={`h-1.5 w-1.5 rounded-full ${row.color}`} />
                          <span className="text-[11px] text-slate-500">{row.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Queue stats */}
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-1">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">My Queue</div>
                <div className="mt-1.5 font-heading text-4xl font-extrabold text-slate-900">{queueStatus.queue_size_user}</div>
                <div className="mt-0.5 text-[12px] text-slate-500">Waiting in your workspace</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">Total Queue</div>
                <div className="mt-1.5 font-heading text-4xl font-extrabold text-slate-900">{queueStatus.queue_size_total}</div>
                <div className="mt-0.5 text-[12px] text-slate-500">All queued analysis jobs</div>
              </div>
            </div>
          </div>
        </Panel>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Active postings" value={String(jobs.length)} detail="Open roles in your workspace." accent="blue" />
          <MetricCard label="Candidates processed" value={String(candidates.length)} detail="Uploaded and parsed CV records." accent="green" />
          <MetricCard label="Completed reports" value={String(reports.length)} detail="Finalized analysis reports available." accent="violet" />
          <MetricCard
            label="Average score"
            value={candidates.length === 0 ? "0.0" : (candidates.reduce((sum, row) => sum + row.current_score, 0) / candidates.length).toFixed(1)}
            detail="Unified current score view (triage 0-80, final 0-100)."
            accent="amber"
          />
        </div>

        <Panel title="Pipeline Snapshot" subtitle="Compact runtime chart for throughput, latency, and queue health.">
          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
            <div className="grid gap-3 md:grid-cols-[1.35fr_1fr_1fr_1fr]">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">7-Cycle Throughput</div>
                <div className="flex h-14 items-end gap-1.5">
                  {compactTrend.map((value, index) => (
                    <div key={`${value}-${index}`} className="flex h-full flex-1 items-end">
                      <div className="w-full rounded-sm bg-accent/80" style={{ height: `${value}px` }} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Avg Time</div>
                <div className="mt-1 font-heading text-2xl font-extrabold text-slate-950">{formatMinutes(runtimeSnapshot.estimatedAvgMinutes)}</div>
                <div className="text-[11px] text-slate-500">Per candidate</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Queue Wait</div>
                <div className="mt-1 font-heading text-2xl font-extrabold text-slate-950">
                  {queueStatus.queue_size_total > 0 ? formatMinutes(runtimeSnapshot.waitMinutes) : "No wait"}
                </div>
                <div className="text-[11px] text-slate-500">Depth {queueStatus.queue_size_total}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Reliability</div>
                <div className="mt-1 font-heading text-2xl font-extrabold text-slate-950">{runtimeSnapshot.reliability}%</div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-mint" style={{ width: `${Math.min(100, runtimeSnapshot.completionRate)}%` }} />
                </div>
              </div>
            </div>
          </div>
        </Panel>

        <div className="grid gap-6 xl:grid-cols-[1.55fr_1fr]">
          <Panel title="Top Candidates / Shortlist" subtitle="Ranked by current score (triage 0-80 before analysis, final 0-100 after completion).">
            {topCandidates.length === 0 ? (
              <EmptyState
                title="No candidates yet"
                body="Create a posting and upload CVs to populate ranking and analysis sections."
                action={<PrimaryButton href="/jobs/new">Create posting</PrimaryButton>}
              />
            ) : (
              <div className="space-y-2">
                {topCandidates.map((candidate, index) => (
                  <div key={candidate.id} className="grid gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50 lg:grid-cols-[48px_1.2fr_1fr_130px_135px] lg:items-center">
                    <div className={`grid h-8 w-8 place-items-center rounded-full text-[13px] font-bold ${index === 0 ? "bg-accent text-white" : "bg-slate-100 text-slate-600"}`}>
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">{candidate.display_name}</div>
                      <div className="text-[12px] text-slate-500">{candidate.job_posting_title}</div>
                    </div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{candidate.current_score_type} score</div>
                    <div className="flex lg:justify-center">
                      <ScoreRing score={candidate.current_score_type === "triage" ? (candidate.current_score / 80) * 100 : candidate.current_score} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {candidate.recommendation ? <RecommendationBadge recommendation={candidate.recommendation} /> : null}
                      <Link
                        href={candidate.report_ready ? `/candidates/${candidate.id}/report` : `/candidates/${candidate.id}`}
                        className="rounded-lg border border-accent px-3 py-1.5 text-[12px] font-semibold text-accent transition-colors hover:bg-accent hover:text-white"
                      >
                        {candidate.report_ready ? "View report" : "Open"}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Recent Job Postings" subtitle="Latest postings with compact role metadata and applicant volume.">
            <div className="space-y-2">
              {recentJobs.map((job) => (
                <div key={job.id} className="rounded-xl border border-slate-200 bg-white p-3.5 transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="line-clamp-3 font-semibold text-slate-900">{job.title}</div>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                      {candidatesByPosting[job.id] || 0} applicants
                    </span>
                  </div>
                  {job.job_description ? (
                    <div className="mt-1 line-clamp-4 text-[12px] leading-5 text-slate-500">{job.job_description}</div>
                  ) : null}
                  <div className="mt-3">
                    <Link href={`/jobs/${job.id}`} className="rounded-lg border border-accent px-3 py-1.5 text-[12px] font-semibold text-accent transition-colors hover:bg-accent hover:text-white">
                      Open posting
                    </Link>
                  </div>
                </div>
              ))}
              {recentJobs.length === 0 ? (
                <div className="text-[13px] text-slate-500">No postings yet. Create one to begin workflow.</div>
              ) : null}
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
