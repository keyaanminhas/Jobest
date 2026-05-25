"use client";

import { AppShell } from "@/components/app-shell";
import { JsonAccordion, Panel, RecommendationBadge, ScoreRing, StatusBadge } from "@/components/ui";
import { analyzeCandidate, getCandidate, getCandidateAnalysis, getCandidateResumeBlob } from "@/lib/api";
import { CandidateAnalysisResponse, CandidateDetail } from "@/lib/types";
import { Check, FileText, Radar, ShieldAlert, Sparkles, UsersRound } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

const pipelineRail = [
  { key: "JD Deconstruction Agent", label: "JD Deconstructed", icon: FileText },
  { key: "Hiring Context Agent", label: "Hiring Context Analyzed", icon: UsersRound },
  { key: "Resume Parsing Agent", label: "Resume Parsed", icon: FileText },
  { key: "Candidate Evidence Agent", label: "Evidence Extracted", icon: FileText },
  { key: "Transferable Skill Agent", label: "Transferable Skills Mapped", icon: Radar },
  { key: "Professional Footprint Agent", label: "Professional Footprint Analyzed", icon: Sparkles },
  { key: "Risk & Contradiction Agent", label: "Risks Audited", icon: ShieldAlert },
  { key: "Score Aggregation Engine", label: "Scores Aggregated", icon: FileText },
  { key: "Hiring Panel Review Agent", label: "Hiring Panel Generated", icon: UsersRound },
  { key: "Final Shortlist Report Agent", label: "Final Report Ready", icon: FileText },
];

function getRailStatus(key: string, stages: Array<{ stage: string; status: string }>) {
  const matching = stages.filter((stage) => stage.stage.startsWith(key));
  if (matching.length === 0) return "pending";
  if (matching.some((stage) => stage.status.includes("error"))) return "error";
  if (matching.some((stage) => stage.status.includes("warning"))) return "warning";
  if (matching.every((stage) => stage.status.startsWith("completed"))) return "completed";
  return "in_progress";
}

function railTone(status: string) {
  if (status === "completed") return "border-emerald-300 bg-emerald-50 text-emerald-600";
  if (status === "error") return "border-red-300 bg-red-50 text-red-600";
  if (status === "warning") return "border-amber-300 bg-amber-50 text-amber-600";
  if (status === "in_progress") return "border-blue-400 bg-blue-50 text-accent";
  return "border-slate-200 bg-white text-slate-400";
}

export default function CandidatePage() {
  const params = useParams<{ id: string }>();
  const candidateId = params.id;
  const [pending, startTransition] = useTransition();
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [analysis, setAnalysis] = useState<CandidateAnalysisResponse | null>(null);
  const [resumeBlobUrl, setResumeBlobUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let pollHandle: ReturnType<typeof setTimeout> | null = null;

    async function load(poll: boolean) {
      try {
        const [candidateRow, analysisRow] = await Promise.all([getCandidate(candidateId), getCandidateAnalysis(candidateId)]);
        if (cancelled) return;
        setCandidate(candidateRow);
        setAnalysis(analysisRow);
        if (poll && (analysisRow.status === "processing" || analysisRow.status === "queued")) {
          pollHandle = setTimeout(() => {
            void load(true);
          }, 2000);
        }
      } catch (requestError) {
        if (cancelled) return;
        setError(requestError instanceof Error ? requestError.message : "Failed loading candidate.");
      }
    }

    void load(true);
    return () => {
      cancelled = true;
      if (pollHandle) clearTimeout(pollHandle);
    };
  }, [candidateId]);

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
        const analysisRow = await getCandidateAnalysis(candidateId);
        setAnalysis(analysisRow);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Failed starting analysis.");
      }
    });
  }

  const stages = analysis?.stages ?? [];

  return (
    <AppShell
      title={candidate?.display_name ?? "Candidate"}
      subtitle={candidate?.triage_summary || "Loading candidate details..."}
      actions={
        <div className="flex gap-3">
          <button
            type="button"
            onClick={startAnalysis}
            disabled={pending || analysis?.status === "processing" || analysis?.status === "queued"}
            className="rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Starting..." : "Run Full Analysis"}
          </button>
          {candidate?.report_ready ? (
            <Link href={`/candidates/${candidateId}/report`} className="rounded-xl border border-accent px-4 py-3 text-sm font-semibold text-accent">
              View report
            </Link>
          ) : null}
        </div>
      }
    >
      {error ? <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      <Panel title="Analysis Pipeline Progress" subtitle="Live stage timeline with structured stage outputs.">
        <div className="overflow-x-auto pb-3">
          <div className="flex min-w-[980px] items-start gap-3">
            {pipelineRail.map((step, index) => {
              const status = getRailStatus(step.key, stages);
              const Icon = step.icon;
              return (
                <div key={step.key} className="flex items-start">
                  <div className="flex min-w-[150px] flex-col items-center text-center">
                    <div className={`relative flex h-12 w-12 items-center justify-center rounded-full border-2 ${railTone(status)}`}>
                      {status === "completed" ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                      <div className="absolute -bottom-2 grid h-5 w-5 place-items-center rounded-full border border-white bg-white text-[10px] font-bold text-slate-600">
                        {index + 1}
                      </div>
                    </div>
                    <div className="mt-4 text-xs font-semibold text-slate-700">{step.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-5 space-y-3">
          {stages.map((stage, index) => (
            <div key={`${stage.stage}-${index}`} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold text-slate-900">{stage.stage}</div>
                <StatusBadge status={stage.status} />
              </div>
              <p className="mt-1 text-xs text-slate-600">{stage.summary}</p>
            </div>
          ))}
          {stages.length === 0 ? (
            <div className="text-sm text-slate-500">No analysis stages yet. Start full analysis to run the agent pipeline.</div>
          ) : null}
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <Panel title="Candidate Resume PDF" subtitle="Original uploaded CV as the primary reviewer artifact.">
          {resumeBlobUrl ? (
            <iframe src={resumeBlobUrl} className="h-[520px] w-full rounded-xl border border-slate-200" />
          ) : (
            <div className="text-sm text-slate-500">Resume file unavailable.</div>
          )}
          <div className="mt-3">
            <JsonAccordion label="Extracted text snapshot" value={{ resume_text: candidate?.resume_text || "" }} />
          </div>
        </Panel>

        <Panel title="Run Summary">
          <div className="space-y-3 text-sm text-slate-700">
            <div className="flex items-center justify-between gap-4"><span>Posting</span><span className="font-semibold text-slate-900">{candidate?.job_posting_title || "-"}</span></div>
            <div className="flex items-center justify-between gap-4"><span>Analysis status</span><StatusBadge status={analysis?.status || candidate?.analysis_status || "not_started"} /></div>
            <div className="flex items-center justify-between gap-4"><span>Current score</span><span className="font-semibold text-slate-900">{candidate?.current_score.toFixed(1) ?? "0.0"}{candidate?.current_score_type === "triage" ? " / 80" : " / 100"}</span></div>
            <div className="flex items-center justify-between gap-4"><span>Score type</span><span className="font-semibold text-slate-900">{candidate?.current_score_type || "triage"}</span></div>
            <div className="flex items-center justify-between gap-4"><span>Triage score</span><span className="font-semibold text-slate-900">{candidate?.triage_score.toFixed(1) ?? "0.0"} / 80</span></div>
            <div className="flex items-center justify-between gap-4"><span>Final score</span><span className="font-semibold text-slate-900">{candidate?.final_score?.toFixed(1) || "-"}</span></div>
            <div className="flex items-center justify-between gap-4">
              <span>Recommendation</span>
              {candidate?.recommendation ? <RecommendationBadge recommendation={candidate.recommendation} /> : <span className="text-xs text-slate-500">Pending</span>}
            </div>
            <div className="pt-2">
              <div className="mb-1 font-semibold text-slate-900">Professional links</div>
              <div className="space-y-1 text-xs">
                {Object.entries(candidate?.links ?? {}).map(([key, value]) => (
                  <div key={key}>{key}: {value}</div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 flex justify-center">
            <ScoreRing score={candidate?.current_score_type === "triage" ? ((candidate?.current_score ?? 0) / 80) * 100 : candidate?.current_score ?? 0} />
          </div>
        </Panel>
      </div>

      <Panel title="Raw Stage Summaries" subtitle="Expandable technical trace of raw structured stage outputs.">
        <div className="space-y-2">
          {stages.map((stage, index) => (
            <JsonAccordion key={`raw-${stage.stage}-${index}`} label={`${stage.stage} (${stage.status})`} value={stage.raw_output} />
          ))}
          {stages.length === 0 ? <div className="text-sm text-slate-500">No raw stage outputs available yet.</div> : null}
        </div>
      </Panel>
    </AppShell>
  );
}
