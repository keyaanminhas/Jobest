"use client";

import { AppShell } from "@/components/app-shell";
import { JsonAccordion, Panel, RecommendationBadge, ScoreRing, StatusBadge } from "@/components/ui";
import { analyzeCandidate, getCandidate, getCandidateAnalysis, getCandidateResumeBlob } from "@/lib/api";
import { CandidateAnalysisResponse, CandidateDetail } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  Activity,
  ArrowRight,
  Check,
  Clock3,
  FileText,
  Loader2,
  Play,
  Radar,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

const pipelineRail = [
  { key: "JD Deconstruction Agent", label: "JD\nDeconstructed", icon: FileText },
  { key: "Hiring Context Agent", label: "Hiring Context\nAnalyzed", icon: UsersRound },
  { key: "Resume Parsing Agent", label: "Resume\nParsed", icon: FileText },
  { key: "Candidate Evidence Agent", label: "Evidence\nExtracted", icon: FileText },
  { key: "Transferable Skill Agent", label: "Transferable Skills\nMapped", icon: Radar },
  { key: "Professional Footprint Agent", label: "Professional Footprint\nAnalyzed", icon: Sparkles },
  { key: "Risk & Contradiction Agent", label: "Risks\nAudited", icon: ShieldAlert },
  { key: "Score Aggregation Engine", label: "Scores\nAggregated", icon: FileText },
  { key: "Hiring Panel Review Agent", label: "Hiring Panel\nGenerated", icon: UsersRound },
  { key: "Final Shortlist Report Agent", label: "Final Report\nReady", icon: FileText },
];

type StageRow = CandidateAnalysisResponse["stages"][number];
type RailStatus = "pending" | "in_progress" | "completed" | "warning" | "error";

function getRailStatus(key: string, stages: StageRow[]): RailStatus {
  const matching = stages.filter((stage) => stage.stage.startsWith(key));
  if (matching.length === 0) return "pending";
  if (matching.some((stage) => stage.status.includes("error"))) return "error";
  if (matching.some((stage) => stage.status.includes("warning"))) return "warning";
  if (matching.every((stage) => stage.status.startsWith("completed"))) return "completed";
  return "in_progress";
}

function getCurrentStage(stages: StageRow[]) {
  const liveIndex = pipelineRail.findIndex((item) => getRailStatus(item.key, stages) !== "completed");
  return liveIndex === -1 ? pipelineRail[pipelineRail.length - 1] : pipelineRail[Math.max(liveIndex, 0)];
}

function railTone(status: RailStatus, active: boolean) {
  if (status === "completed") return "border-emerald-300 bg-emerald-50 text-emerald-600";
  if (status === "error") return "border-red-300 bg-red-50 text-red-600";
  if (status === "warning") return "border-amber-300 bg-amber-50 text-amber-600";
  if (active || status === "in_progress") return "border-blue-400 bg-blue-50 text-accent shadow-[0_0_0_6px_rgba(37,99,235,0.08)]";
  return "border-slate-200 bg-white text-slate-400";
}

function stageTone(status: RailStatus) {
  if (status === "completed") return "border-emerald-200 bg-emerald-50";
  if (status === "error") return "border-red-200 bg-red-50";
  if (status === "warning") return "border-amber-200 bg-amber-50";
  if (status === "in_progress") return "border-blue-200 bg-blue-50";
  return "border-slate-200 bg-white";
}

function StageStatusIcon({ status, active }: { status: RailStatus; active: boolean }) {
  if (status === "completed") return <Check className="h-4 w-4 text-emerald-600" />;
  if (status === "error") return <ShieldAlert className="h-4 w-4 text-red-600" />;
  if (status === "warning") return <ShieldAlert className="h-4 w-4 text-amber-600" />;
  if (active || status === "in_progress") return <Loader2 className="h-4 w-4 animate-spin text-accent" />;
  return <Clock3 className="h-4 w-4 text-slate-400" />;
}

function formatScore(value: number | null | undefined, fallback = "-") {
  return typeof value === "number" ? value.toFixed(1) : fallback;
}

function compactId(value: string) {
  return value.length > 12 ? value.slice(0, 12) : value;
}

export default function CandidatePage() {
  const params = useParams<{ id: string }>();
  const candidateId = params.id;
  const [pending, startTransition] = useTransition();
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [analysis, setAnalysis] = useState<CandidateAnalysisResponse | null>(null);
  const [resumeBlobUrl, setResumeBlobUrl] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState("");

  const loadCandidateData = useCallback(async () => {
    try {
      const [candidateRow, analysisRow] = await Promise.all([getCandidate(candidateId), getCandidateAnalysis(candidateId)]);
      setCandidate(candidateRow);
      setAnalysis(analysisRow);
      setLastUpdatedAt(new Date());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed loading candidate.");
    }
  }, [candidateId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (cancelled) return;
      await loadCandidateData();
    }

    void load();
    const handle = setInterval(() => {
      if (document.visibilityState === "visible") {
        void load();
      }
    }, 2500);

    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [loadCandidateData]);

  useEffect(() => {
    let cancelled = false;
    async function loadResume() {
      try {
        const blob = await getCandidateResumeBlob(candidateId);
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(blob);
        setResumeBlobUrl((previous) => {
          if (previous) URL.revokeObjectURL(previous);
          return objectUrl;
        });
      } catch {
        if (cancelled) return;
      }
    }
    void loadResume();
    return () => {
      cancelled = true;
      setResumeBlobUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return "";
      });
    };
  }, [candidateId]);

  function startAnalysis() {
    setError("");
    startTransition(async () => {
      try {
        await analyzeCandidate(candidateId);
        await loadCandidateData();
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Failed starting analysis.");
      }
    });
  }

  const stages = analysis?.stages ?? [];
  const isLive = analysis?.status === "processing" || analysis?.status === "queued" || pending;
  const completedCount = useMemo(
    () => pipelineRail.filter((step) => getRailStatus(step.key, stages) === "completed").length,
    [stages],
  );
  const currentStage = useMemo(() => getCurrentStage(stages), [stages]);
  const currentStageLabel = currentStage.label.replace("\n", " ");
  const progressPercent = Math.round((completedCount / pipelineRail.length) * 100);
  const currentScore =
    candidate?.current_score_type === "triage" ? ((candidate?.current_score ?? 0) / 80) * 100 : candidate?.current_score ?? 0;

  return (
    <AppShell
      title={candidate?.display_name ?? "Candidate"}
      subtitle={candidate?.triage_summary || "Loading candidate details..."}
      actions={
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={startAnalysis}
            disabled={pending || analysis?.status === "processing" || analysis?.status === "queued"}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {pending ? "Starting..." : "Run Full Analysis"}
          </button>
          {candidate?.report_ready ? (
            <Link
              href={`/candidates/${candidateId}/report`}
              className="inline-flex items-center gap-2 rounded-xl border border-accent px-4 py-3 text-sm font-semibold text-accent transition hover:bg-blue-50"
            >
              View report
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      }
    >
      {error ? <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="space-y-4">
        <Panel
          title="Analysis Pipeline"
          subtitle="Live agent orchestration with automatic refresh and per-stage execution state."
          action={
            <div className="flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 text-[12px] font-semibold text-slate-600">
              {isLive ? <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" /> : <RefreshCw className="h-3.5 w-3.5 text-slate-400" />}
              {isLive ? "Live updating" : "Auto refresh on"}
            </div>
          }
        >
          <div className="mb-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Current Stage</div>
              <div className="mt-1 font-heading text-[16px] font-bold text-slate-950">{currentStageLabel}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Progress</div>
              <div className="mt-1 font-heading text-[16px] font-bold text-slate-950">
                {completedCount}/{pipelineRail.length} stages
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Last Sync</div>
              <div className="mt-1 font-heading text-[16px] font-bold text-slate-950">
                {lastUpdatedAt ? lastUpdatedAt.toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit", second: "2-digit" }) : "-"}
              </div>
            </div>
          </div>

          <div className="mb-6 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${progressPercent}%` }} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {pipelineRail.map((step, index) => {
                const status = getRailStatus(step.key, stages);
                const active = currentStage.key === step.key && status !== "completed";
                const Icon = step.icon;

                return (
                  <div
                    key={step.key}
                    className={cn(
                      "relative min-h-[132px] rounded-xl border p-3 transition",
                      active ? "border-blue-300 bg-blue-50/80" : "border-slate-200 bg-white",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition ${railTone(status, active)}`}>
                        {status === "completed" ? <Check className="h-6 w-6" /> : active ? <Loader2 className="h-6 w-6 animate-spin" /> : <Icon className="h-6 w-6" />}
                        <div className="absolute -bottom-2 grid h-5 w-5 place-items-center rounded-full border border-white bg-white text-[10px] font-bold text-slate-600 shadow-sm">
                          {index + 1}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                      <div className={`text-[13px] font-semibold leading-5 ${active ? "text-accent" : "text-slate-800"}`}>
                        {step.label.split("\n").map((line) => (
                          <span key={line} className="block">
                            {line}
                          </span>
                        ))}
                      </div>
                        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-500">
                          <StageStatusIcon status={status} active={active} />
                          {active ? "running" : status.replace("_", " ")}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </Panel>

        <Panel title="Run Summary" subtitle="Candidate status, score, and orchestration context.">
          <div className="grid gap-4 lg:grid-cols-[280px_1fr_280px]">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Match Score</div>
                <div className="mt-1 font-heading text-3xl font-extrabold text-slate-950">
                  {formatScore(candidate?.current_score, "0.0")}
                  <span className="ml-1 text-sm font-semibold text-slate-400">
                    {candidate?.current_score_type === "triage" ? "/80" : "/100"}
                  </span>
                </div>
              </div>
              <ScoreRing score={currentScore} />
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${Math.min(currentScore, 100)}%` }} />
            </div>
          </div>

          <dl className="grid content-start gap-3 text-sm sm:grid-cols-2">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">Posting</dt>
              <dd className="max-w-[180px] truncate font-semibold text-slate-900">{candidate?.job_posting_title || "-"}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">Candidate ID</dt>
              <dd className="font-mono text-xs font-semibold text-slate-700">{compactId(candidateId)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">Analysis status</dt>
              <dd>
                <StatusBadge status={analysis?.status || candidate?.analysis_status || "not_started"} />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">Current stage</dt>
              <dd className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-accent">{currentStageLabel}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">Triage score</dt>
              <dd className="font-semibold text-slate-900">{formatScore(candidate?.triage_score, "0.0")} / 80</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">Final score</dt>
              <dd className="font-semibold text-slate-900">{formatScore(candidate?.final_score)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">Recommendation</dt>
              <dd>{candidate?.recommendation ? <RecommendationBadge recommendation={candidate.recommendation} /> : <span className="text-xs text-slate-500">Pending</span>}</dd>
            </div>
          </dl>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              <Activity className="h-4 w-4 text-accent" />
              Professional Links
            </div>
            <div className="space-y-1.5 text-xs text-slate-600">
              {Object.entries(candidate?.links ?? {}).length > 0 ? (
                Object.entries(candidate?.links ?? {}).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <span className="shrink-0 font-semibold text-slate-800">{key}:</span>
                    <span className="min-w-0 truncate">{String(value)}</span>
                  </div>
                ))
              ) : (
                <div className="text-slate-500">No professional links provided.</div>
              )}
            </div>
          </div>
          </div>
        </Panel>
      </div>

      <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <Panel title="Candidate Resume PDF" subtitle="Original uploaded CV as the primary reviewer artifact." className="min-w-0">
          {resumeBlobUrl ? (
            <iframe src={resumeBlobUrl} className="h-[520px] min-w-0 w-full rounded-xl border border-slate-200" />
          ) : (
            <div className="text-sm text-slate-500">Resume file unavailable.</div>
          )}
          <div className="mt-3">
            <JsonAccordion label="Extracted text snapshot" value={{ resume_text: candidate?.resume_text || "" }} />
          </div>
        </Panel>

        <Panel title="Agent Execution Timeline" subtitle="Every expected agent with live status and latest output." className="min-w-0">
          <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
              {isLive ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
              Currently Working On
            </div>
            <div className="mt-1 font-heading text-[15px] font-bold text-slate-950">{currentStageLabel}</div>
          </div>
          <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
            {pipelineRail.map((step, index) => {
              const status = getRailStatus(step.key, stages);
              const active = currentStage.key === step.key && status !== "completed";
              const stage = stages.find((item) => item.stage.startsWith(step.key));

              return (
                <div key={step.key} className={cn("rounded-xl border p-3 transition", stageTone(active ? "in_progress" : status))}>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-xs font-bold text-slate-700 shadow-sm">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <StageStatusIcon status={status} active={active} />
                          <h3 className="truncate font-heading text-[15px] font-bold text-slate-950">{stage?.stage ?? step.label.replace("\n", " ")}</h3>
                        </div>
                        <StatusBadge status={active ? "in_progress" : status} />
                      </div>
                      <p className="mt-1 text-[12.5px] leading-6 text-slate-600">
                        {stage?.summary || (active ? "Agent is preparing or running now." : "Waiting for upstream stage output.")}
                      </p>
                      {stage?.raw_output ? (
                        <div className="mt-3">
                          <JsonAccordion label="Expand raw JSON" value={stage.raw_output} />
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="mt-6">
        <Panel title="Raw Stage Summaries" subtitle="Expandable technical trace of raw structured stage outputs.">
          <div className="space-y-2">
            {stages.map((stage, index) => (
              <JsonAccordion key={`raw-${stage.stage}-${index}`} label={`${stage.stage} (${stage.status})`} value={stage.raw_output} />
            ))}
            {stages.length === 0 ? <div className="text-sm text-slate-500">No raw stage outputs available yet.</div> : null}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
