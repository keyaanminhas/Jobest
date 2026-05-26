"use client";

import { AppShell } from "@/components/app-shell";
import { EmptyState, RecommendationBadge, ScoreRing } from "@/components/ui";
import { listAllCandidates, listJobPostings, listReports } from "@/lib/api";
import { CandidateListItem, CandidateReportListItem, JobPostingRecord } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Download,
  FileBarChart2,
  MessageSquareText,
  Search,
  Share2,
  ShieldAlert,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

/* ── Helpers ── */

const avatarGradients = [
  "from-blue-500 to-blue-700",
  "from-emerald-500 to-emerald-700",
  "from-violet-500 to-violet-700",
  "from-amber-500 to-amber-700",
  "from-rose-500 to-rose-700",
  "from-cyan-500 to-cyan-700",
  "from-indigo-500 to-indigo-700",
  "from-pink-500 to-pink-700",
];

function avatarGradient(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
  return avatarGradients[hash % avatarGradients.length];
}

function initialsFrom(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

function rankBadgeClass(rank: number) {
  if (rank === 1) return "bg-accent text-white";
  if (rank === 2) return "bg-blue-100 text-accent";
  if (rank === 3) return "bg-emerald-100 text-emerald-700";
  return "bg-slate-100 text-slate-600";
}

function ScoreDonut({
  high,
  mid,
  low,
  label,
}: {
  high: number;
  mid: number;
  low: number;
  label: string;
}) {
  const total = high + mid + low || 1;
  const highPct = (high / total) * 100;
  const midPct = (mid / total) * 100;
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-[72px] w-[72px] shrink-0">
        <div
          className="h-full w-full rounded-full"
          style={{
            background: `conic-gradient(#22c55e 0% ${highPct}%, #f59e0b ${highPct}% ${highPct + midPct}%, #ef4444 ${highPct + midPct}% 100%)`,
          }}
        />
        <div className="absolute inset-[10px] grid place-items-center rounded-full bg-white">
          <span className="font-heading text-[22px] font-extrabold leading-none text-slate-900">
            {high + mid + low}
          </span>
        </div>
      </div>
      <div className="space-y-1 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-slate-500">75+ ({high})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          <span className="text-slate-500">50-74 ({mid})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          <span className="text-slate-500">&lt;50 ({low})</span>
        </div>
      </div>
    </div>
  );
}

/* ── Page ── */

export default function ReportsIndexPage() {
  const [reports, setReports] = useState<CandidateReportListItem[]>([]);
  const [jobs, setJobs] = useState<JobPostingRecord[]>([]);
  const [candidates, setCandidates] = useState<CandidateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string>("all");
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [reportData, jobData, candidateData] = await Promise.all([
          listReports(),
          listJobPostings(),
          listAllCandidates(),
        ]);
        if (cancelled) return;
        setReports(reportData);
        setJobs(jobData.postings);
        setCandidates(candidateData);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed loading reports.");
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  /* derived data */

  /* Jobs that have at least one completed report */
  const jobsWithReports = useMemo(() => {
    const jobIds = new Set(reports.map((r) => r.job_posting_id));
    return jobs.filter((j) => jobIds.has(j.id));
  }, [reports, jobs]);

  /* Reports filtered by selected job posting */
  const filtered = useMemo(
    () =>
      selectedJobId === "all"
        ? reports
        : reports.filter((r) => r.job_posting_id === selectedJobId),
    [reports, selectedJobId],
  );

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => (b.final_score ?? 0) - (a.final_score ?? 0)),
    [filtered],
  );
  const top5 = useMemo(() => sorted.slice(0, 5), [sorted]);

  const candidateMap = useMemo(() => {
    const m: Record<string, CandidateListItem> = {};
    for (const c of candidates) m[c.id] = c;
    return m;
  }, [candidates]);

  const primaryJob = useMemo(() => {
    if (selectedJobId !== "all") return jobs.find((j) => j.id === selectedJobId) ?? null;
    if (filtered.length === 0 || jobs.length === 0) return null;
    return jobs.find((j) => j.id === filtered[0].job_posting_id) ?? jobs[0] ?? null;
  }, [filtered, jobs, selectedJobId]);
  const isAllPostingsView = selectedJobId === "all";

  const scoreDist = useMemo(() => {
    const d = { high: 0, mid: 0, low: 0 };
    for (const r of filtered) {
      const s = r.final_score ?? 0;
      if (s >= 75) d.high++;
      else if (s >= 50) d.mid++;
      else d.low++;
    }
    return d;
  }, [filtered]);

  const avgScore = useMemo(() => {
    if (filtered.length === 0) return 0;
    return Math.round(filtered.reduce((s, r) => s + (r.final_score ?? 0), 0) / filtered.length);
  }, [filtered]);

  const latestDate = useMemo(() => {
    const dates = filtered.map((r) => r.completed_at).filter(Boolean) as string[];
    if (dates.length === 0) return null;
    return dates.sort().reverse()[0];
  }, [filtered]);

  const interviewFocusAreas = useMemo(() => {
    const areas: string[] = [];
    if (primaryJob) {
      for (const skill of primaryJob.must_have_skills.slice(0, 4)) {
        areas.push(`Validate depth of ${skill} experience`);
      }
    }
    if (areas.length === 0) {
      areas.push("Assess technical depth and problem-solving");
      areas.push("Evaluate cultural fit and team collaboration");
      areas.push("Verify claimed project outcomes with specifics");
    }
    return areas;
  }, [primaryJob]);

  const notesToVerify = useMemo(() => {
    const notes: string[] = [];
    for (const r of top5.slice(0, 4)) {
      const cand = candidateMap[r.candidate_id];
      notes.push(
        `Confirm ${r.candidate_name}'s ${cand?.triage_summary ? "key experience claims" : "professional background"}`,
      );
    }
    return notes.length > 0 ? notes : ["No candidates to verify yet"];
  }, [top5, candidateMap]);

  const handleExportPdf = () => {
    window.print();
  };

  const handleShareReport = async () => {
    const shareUrl = window.location.href;
    const shareTitle = "Hiring Report";
    const shareText = "Review this hiring report.";

    try {
      if (navigator.share) {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
        setActionMessage("Report share dialog opened.");
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      setActionMessage("Report link copied to clipboard.");
    } catch {
      setActionMessage("Unable to share automatically. Copy the URL from your browser.");
    }
  };

  /* ── Loading / Error / Empty ── */

  if (loading) return <div className="min-h-screen bg-[#f7f9fc]" />;

  if (error) {
    return (
      <AppShell title="Hiring Report" subtitle="Final evidence-backed shortlist and recommendations.">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      </AppShell>
    );
  }

  if (reports.length === 0) {
    return (
      <AppShell title="Hiring Report" subtitle="Final evidence-backed shortlist and recommendations.">
        <EmptyState
          title="No completed reports yet"
          body="Run full analysis on candidates to generate report artifacts."
        />
      </AppShell>
    );
  }

  /* ── Render ── */

  return (
    <AppShell
      title="Hiring Report"
      subtitle="Final evidence-backed shortlist and recommendations."
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-[13px] font-semibold text-slate-600 transition-colors duration-150 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Export PDF
          </button>
          <button
            type="button"
            onClick={() => void handleShareReport()}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-[13px] font-semibold text-white transition-colors duration-150 hover:bg-blue-700"
          >
            <Share2 className="h-4 w-4" />
            Share Report
          </button>
          {actionMessage ? <span className="text-[12px] text-slate-500">{actionMessage}</span> : null}
        </div>
      }
    >
      <div className="space-y-6">
        {/* ── Job Posting Selector ── */}
        {jobsWithReports.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-700">
              <Briefcase className="h-4 w-4 text-accent" />
              Viewing reports for:
            </div>
            <div className="relative">
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-4 pr-10 text-[14px] font-semibold text-slate-900 shadow-sm outline-none transition-all duration-150 focus:border-accent focus:ring-2 focus:ring-accent/10"
              >
                <option value="all">All Job Postings ({reports.length} reports)</option>
                {jobsWithReports.map((job) => {
                  const count = reports.filter((r) => r.job_posting_id === job.id).length;
                  return (
                    <option key={job.id} value={job.id}>
                      {job.title} ({count} report{count !== 1 ? "s" : ""})
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
            {selectedJobId !== "all" && (
              <button
                type="button"
                onClick={() => setSelectedJobId("all")}
                className="cursor-pointer text-[12px] font-semibold text-accent hover:underline"
              >
                Clear filter
              </button>
            )}
          </div>
        )}

        {/* ── Summary cards row ── */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* Job Title */}
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-accent">
              <Briefcase className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                {isAllPostingsView ? "Hiring Scope" : "Job Title"}
              </div>
              <div className="mt-0.5 truncate text-[15px] font-semibold text-slate-900">
                {isAllPostingsView ? "All job postings" : primaryJob?.title ?? reports[0].job_posting_title}
              </div>
              <div className="mt-0.5 truncate text-[12px] text-slate-500">
                {isAllPostingsView
                  ? `${jobsWithReports.length} postings with completed reports`
                  : primaryJob?.company_priority ?? "Recruiting"}
              </div>
            </div>
          </div>

          {/* Hiring Context */}
          <div className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-accent">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Hiring Context Summary
              </div>
              <p className="mt-1 line-clamp-3 text-[12px] leading-5 text-slate-600">
                {isAllPostingsView
                  ? "Portfolio-wide hiring view across completed reports, candidate comparisons, and shortlist outcomes."
                  : primaryJob?.hiring_context || "Evidence-backed review for shortlisting and scoring."}
              </p>
            </div>
          </div>

          {/* Score Distribution Donut */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Candidates Analyzed
            </div>
            <ScoreDonut
              high={scoreDist.high}
              mid={scoreDist.mid}
              low={scoreDist.low}
              label="Total"
            />
          </div>

          {/* Date */}
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-accent">
              <Calendar className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Report Date
              </div>
              <div className="mt-0.5 text-[15px] font-semibold text-slate-900">
                {latestDate
                  ? new Date(latestDate).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "Pending"}
              </div>
              <div className="mt-0.5 text-[12px] text-slate-500">
                Hiring Run &middot; {filtered.length} report{filtered.length !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
        </div>

        {/* ── Top 5 Shortlist + Sidebar ── */}
        <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          {/* Left: Top 5 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[16px] font-semibold text-slate-900">
                <Target className="h-5 w-5 text-accent" />
                Top 5 Shortlist
              </h2>
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Ranked by final score
              </span>
            </div>
            <div className="space-y-2">
              {top5.map((report, index) => {
                const rank = index + 1;
                const cand = candidateMap[report.candidate_id];
                return (
                  <div
                    key={report.candidate_id}
                    className="grid items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 transition-colors duration-150 hover:border-slate-200 hover:bg-slate-50 lg:grid-cols-[40px_44px_1.2fr_80px_130px_1.6fr]"
                  >
                    {/* Rank */}
                    <div
                      className={cn(
                        "grid h-8 w-8 place-items-center rounded-full text-[13px] font-bold",
                        rankBadgeClass(rank),
                      )}
                    >
                      {rank}
                    </div>

                    {/* Avatar */}
                    <div
                      className={cn(
                        "grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br text-[12px] font-bold text-white",
                        avatarGradient(report.candidate_name),
                      )}
                    >
                      {initialsFrom(report.candidate_name)}
                    </div>

                    {/* Name */}
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-semibold text-slate-900">
                        {report.candidate_name}
                      </div>
                      <div className="truncate text-[11px] text-slate-400">
                        {report.job_posting_title}
                      </div>
                    </div>

                    {/* Score */}
                    <div className="flex justify-center">
                      <ScoreRing score={report.final_score ?? 0} />
                    </div>

                    {/* Recommendation */}
                    <div>
                      {report.recommendation ? (
                        <RecommendationBadge recommendation={report.recommendation} />
                      ) : (
                        <span className="text-[12px] text-slate-400">Pending</span>
                      )}
                    </div>

                    {/* Evidence / Triage summary */}
                    <div className="line-clamp-2 text-[12px] leading-5 text-slate-500">
                      {cand?.triage_summary ||
                        "Completed multi-agent analysis. View full report for detailed evidence."}
                    </div>
                  </div>
                );
              })}
              {top5.length === 0 && (
                <div className="py-6 text-center text-[13px] text-slate-400">
                  No shortlisted candidates yet.
                </div>
              )}
            </div>
          </div>

          {/* Right sidebar: Interview Focus + Score summary */}
          <div className="space-y-4">
            {/* Interview Focus Areas */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-900">
                <Search className="h-4 w-4 text-accent" />
                Interview Focus Areas
              </h3>
              <div className="space-y-2.5">
                {interviewFocusAreas.map((area, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent text-[10px] font-bold text-white">
                      {i + 1}
                    </div>
                    <span className="text-[13px] leading-5 text-slate-600">{area}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Reporting Summary */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-slate-900">
                <FileBarChart2 className="h-4 w-4 text-accent" />
                Reporting Summary
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-[12px] text-slate-500">Total analyzed</span>
                  <span className="text-[13px] font-semibold text-slate-900">{filtered.length}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-[12px] text-slate-500">Average score</span>
                  <span className="text-[13px] font-semibold text-slate-900">{avgScore}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-[12px] text-slate-500">Shortlisted</span>
                  <span className="text-[13px] font-semibold text-emerald-700">
                    {filtered.filter((r) => r.recommendation === "Strong Shortlist" || r.recommendation === "Shortlist").length}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <span className="text-[12px] text-slate-500">Rejected</span>
                  <span className="text-[13px] font-semibold text-red-600">
                    {filtered.filter((r) => r.recommendation === "Reject").length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Candidate Explanations & Final Recommendation ── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 flex items-center gap-2 text-[16px] font-semibold text-slate-900">
            <Users className="h-5 w-5 text-accent" />
            Candidate Explanations & Final Recommendation
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {sorted.map((report) => {
              const score = report.final_score ?? 0;
              return (
                <Link
                  key={report.candidate_id}
                  href={`/candidates/${report.candidate_id}/report`}
                  className="group flex w-[190px] shrink-0 cursor-pointer flex-col items-center rounded-2xl border border-slate-200 bg-white p-4 transition-all duration-150 hover:border-accent hover:shadow-md"
                >
                  <div
                    className={cn(
                      "grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br text-[16px] font-bold text-white",
                      avatarGradient(report.candidate_name),
                    )}
                  >
                    {initialsFrom(report.candidate_name)}
                  </div>
                  <div className="mt-3 text-center text-[13px] font-semibold text-slate-900 group-hover:text-accent">
                    {report.candidate_name}
                  </div>
                  <div
                    className={cn(
                      "mt-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                      score >= 75
                        ? "bg-emerald-50 text-emerald-700"
                        : score >= 50
                          ? "bg-amber-50 text-amber-700"
                          : "bg-red-50 text-red-600",
                    )}
                  >
                    {score}% Match
                  </div>
                  {report.recommendation ? (
                    <div className="mt-2">
                      <RecommendationBadge recommendation={report.recommendation} />
                    </div>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>

        {/* ── Bottom row: Notes to Verify + Final Recommendation ── */}
        <div className="grid gap-4 xl:grid-cols-3">
          {/* Notes to Verify */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-slate-900">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              Notes to Verify
            </h3>
            <div className="space-y-2">
              {notesToVerify.map((note, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <span className="text-[12px] leading-5 text-slate-600">{note}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Final Recommendation */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-slate-900">
              <Sparkles className="h-4 w-4 text-accent" />
              Final Recommendation
            </h3>
            <p className="text-[13px] leading-6 text-slate-600">
              {isAllPostingsView
                ? `Based on completed evaluations across ${filtered.length} candidate${filtered.length !== 1 ? "s" : ""}, this view highlights the strongest interview-ready profiles across all tracked job postings. Use it to compare shortlist quality, review repeated strengths, and prioritize next recruiter actions.`
                : `Based on completed evidence review across ${filtered.length} candidate${filtered.length !== 1 ? "s" : ""}, the top shortlisted candidates demonstrate strong alignment with core role requirements. Proceed with structured interviews focusing on verified strengths and flagged risk areas.`}
            </p>
            {top5.length > 0 && (
              <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-[13px] font-semibold text-emerald-700">
                {top5.filter((r) => r.recommendation === "Strong Shortlist" || r.recommendation === "Shortlist").length}{" "}
                of {top5.length} top candidates recommended for interview.
              </div>
            )}
          </div>

          {/* Rejection Support */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
            <h3 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-slate-900">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              Rejection Support Note
            </h3>
            <p className="text-[13px] leading-6 text-slate-600">
              Candidates not shortlisted were evaluated fairly across all criteria. Scores are derived
              from structured, deterministic evidence review rather than opaque ranking logic. Each
              candidate&apos;s full report provides transparent reasoning that can support compliant
              rejection communication.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

