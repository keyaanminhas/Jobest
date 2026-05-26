"use client";

import { AppShell } from "@/components/app-shell";
import { JsonAccordion, Panel, RecommendationBadge, StatusBadge } from "@/components/ui";
import { getCandidate, getCandidateAnalysis, getCandidateReport } from "@/lib/api";
import {
  CandidateAnalysisResponse,
  CandidateDetail,
  CandidateReportResponse,
  DeepDiveEvidenceRow,
  DeepDiveMatchBuckets,
  DeepDivePanelSummary,
} from "@/lib/types";
import { ArrowLeft, ArrowRightLeft, BadgeCheck, CircleCheck, CircleX, Download, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

// ── Local helpers ────────────────────────────────────────────────────────────

function initialsFromName(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

function ScoreRingLg({ score }: { score: number }) {
  const angle = Math.round((score / 100) * 360);
  return (
    <div
      className="grid h-24 w-24 place-items-center rounded-full shadow-sm"
      style={{ background: `conic-gradient(#1d4ed8 ${angle}deg, #e2e8f0 0deg)` }}
    >
      <div className="grid h-[74px] w-[74px] place-items-center rounded-full bg-white">
        <div className="text-center">
          <div className="font-heading text-[1.55rem] font-extrabold leading-none text-slate-950">
            {Math.round(score)}
          </div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">/ 100</div>
        </div>
      </div>
    </div>
  );
}

function confidenceBarColor(type: DeepDiveEvidenceRow["match_type"]): string {
  if (type === "exact") return "bg-emerald-500";
  if (type === "transferable") return "bg-blue-500";
  if (type === "missing") return "bg-red-400";
  return "bg-slate-400";
}

function matchTypeBadgeTone(type: DeepDiveEvidenceRow["match_type"]): string {
  if (type === "exact") return "rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700";
  if (type === "transferable") return "rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-accent";
  if (type === "missing") return "rounded-full bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700";
  return "rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600";
}

// ── Match Card ───────────────────────────────────────────────────────────────

function MatchCard({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "exact" | "transferable" | "missing";
  items: Array<{ requirement: string; detail: string }>;
}) {
  const palette = {
    exact: {
      header: "border-emerald-200 bg-emerald-50",
      title: "text-emerald-800",
      item: "border-emerald-100 bg-white",
      icon: "text-emerald-600",
    },
    transferable: {
      header: "border-blue-200 bg-blue-50",
      title: "text-blue-800",
      item: "border-blue-100 bg-white",
      icon: "text-accent",
    },
    missing: {
      header: "border-red-200 bg-red-50",
      title: "text-red-800",
      item: "border-red-100 bg-white",
      icon: "text-red-500",
    },
  }[tone];

  const Icon = tone === "missing" ? CircleX : tone === "exact" ? CircleCheck : ArrowRightLeft;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm print:break-inside-avoid">
      <div className={`rounded-t-xl border-b px-4 py-3 ${palette.header}`}>
        <div className={`flex items-center gap-2 text-[13px] font-bold ${palette.title}`}>
          <Icon className={`h-4 w-4 ${palette.icon}`} />
          {title}
        </div>
      </div>
      <div className="space-y-2 p-3">
        {items.length > 0 ? (
          items.slice(0, 6).map((item) => (
            <div key={`${item.requirement}-${item.detail}`} className={`rounded-lg border p-2.5 ${palette.item}`}>
              <div className="text-[12.5px] font-semibold text-slate-900">{item.requirement}</div>
              <div className="mt-1 text-[11.5px] leading-5 text-slate-500">{item.detail}</div>
            </div>
          ))
        ) : (
          <div className="rounded-lg bg-slate-50 p-3 text-[12.5px] text-slate-500">No items captured.</div>
        )}
      </div>
    </div>
  );
}

// ── Page Component ───────────────────────────────────────────────────────────

export default function CandidateReportPage() {
  const params = useParams<{ id: string }>();
  const candidateId = params.id;
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [analysis, setAnalysis] = useState<CandidateAnalysisResponse | null>(null);
  const [report, setReport] = useState<CandidateReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportError, setReportError] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [candidateResult, analysisResult, reportResult] = await Promise.allSettled([
          getCandidate(candidateId),
          getCandidateAnalysis(candidateId),
          getCandidateReport(candidateId),
        ]);
        if (cancelled) return;

        if (candidateResult.status === "fulfilled") {
          setCandidate(candidateResult.value);
        } else {
          setError(candidateResult.reason instanceof Error ? candidateResult.reason.message : "Failed loading candidate.");
        }

        if (analysisResult.status === "fulfilled") {
          setAnalysis(analysisResult.value);
        } else if (!error) {
          setError(analysisResult.reason instanceof Error ? analysisResult.reason.message : "Failed loading analysis.");
        }

        if (reportResult.status === "fulfilled") {
          setReport(reportResult.value);
          setReportError("");
        } else {
          const message = reportResult.reason instanceof Error ? reportResult.reason.message : "Candidate report not ready yet.";
          setReport(null);
          setReportError(message);
        }
      } catch (requestError) {
        if (cancelled) return;
        setError(requestError instanceof Error ? requestError.message : "Failed loading candidate report.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [candidateId]);

  const score = useMemo(() => asRecord(report?.score), [report]);
  const reportData = useMemo(() => asRecord(report?.report), [report]);
  const panel = useMemo(() => asRecord(report?.panel_review), [report]);
  const interview = useMemo(() => asRecord(report?.interview_pack), [report]);
  const stageArtifacts = useMemo(() => extractStageArtifacts(analysis), [analysis]);
  const view = useMemo(
    () => buildViewModel(candidate, score, reportData, panel, interview, stageArtifacts),
    [candidate, score, reportData, panel, interview, stageArtifacts],
  );

  const notReady = !loading && !report && !!candidate;

  return (
    <AppShell title="" subtitle="" noPageHeader>

      {/* ── Error / loading / not-ready states ─────────────────────────── */}
      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</div>
      ) : null}
      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] text-slate-600">
          Loading candidate report…
        </div>
      ) : null}
      {notReady ? (
        <Panel
          title="Report not ready"
          subtitle="Run or complete full analysis before this report can render the deep-dive dossier."
        >
          <div className="space-y-3">
            <div className="text-[13px] text-slate-700">{reportError || "Candidate report artifacts are not available yet."}</div>
            <div className="flex items-center gap-3">
              <StatusBadge status={analysis?.status || candidate?.analysis_status || "not_started"} />
              <Link
                href={`/candidates/${candidateId}`}
                className="rounded-lg border border-accent px-3 py-2 text-[12px] font-semibold text-accent hover:bg-blue-50 transition-colors"
              >
                Go to candidate analysis
              </Link>
            </div>
          </div>
        </Panel>
      ) : null}

      {/* ── Main report ─────────────────────────────────────────────────── */}
      {!loading && report && view ? (
        <div className="space-y-4 print:space-y-3">

          {/* ── Candidate Hero Card ────────────────────────────────────── */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">

            {/* Nav row */}
            <div className="mb-6 flex items-center justify-between print:hidden">
              <Link
                href={`/candidates/${candidateId}`}
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-600 transition-colors hover:text-accent"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Shortlist
              </Link>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-blue-700"
              >
                <Download className="h-4 w-4" />
                Download Report
              </button>
            </div>

            {/* Candidate info row */}
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">

              {/* Left: avatar + name + details + summary */}
              <div className="flex min-w-0 gap-5">

                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="grid h-[72px] w-[72px] place-items-center rounded-full bg-gradient-to-br from-accent to-blue-800 text-xl font-bold text-white shadow-sm">
                    {initialsFromName(view.candidate_name)}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white p-0.5 shadow-sm">
                    <BadgeCheck className="h-[18px] w-[18px] text-accent" />
                  </div>
                </div>

                {/* Text */}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="font-heading text-[1.55rem] font-extrabold text-slate-950">{view.candidate_name}</h1>
                    <BadgeCheck className="h-5 w-5 shrink-0 text-accent" />
                  </div>
                  <div className="mt-0.5 text-[14px] font-medium text-slate-500">{view.job_posting_title}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-slate-400">
                    <span>Location not provided</span>
                    <span className="text-slate-200">|</span>
                    <span>Notice not provided</span>
                    <span className="text-slate-200">|</span>
                    <span>Comp not provided</span>
                  </div>
                  <p className="mt-3 max-w-2xl text-[13.5px] leading-7 text-slate-600">{view.candidate_summary}</p>
                </div>
              </div>

              {/* Right: score ring + recommendation */}
              <div className="flex shrink-0 flex-col items-center gap-3 lg:ml-4">
                <ScoreRingLg score={view.final_score} />
                <div className="space-y-1.5 text-center">
                  {view.recommendation ? (
                    <RecommendationBadge recommendation={view.recommendation} />
                  ) : (
                    <span className="text-[13px] text-slate-500">Pending</span>
                  )}
                  <div className="text-[11px] uppercase tracking-[0.15em] text-slate-400">Overall Match</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Two-column body ────────────────────────────────────────── */}
          <div className="grid gap-4 xl:grid-cols-[1.6fr_0.64fr]">

            {/* Left column */}
            <div className="space-y-4">

              {/* Evidence Table */}
              <Panel
                title="Evidence Table"
                subtitle="Requirement-level evidence with normalized match type and confidence."
              >
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="grid grid-cols-[1.2fr_0.85fr_2fr_1fr] gap-3 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    <div>Requirement</div>
                    <div>Match Type</div>
                    <div>Evidence</div>
                    <div>Confidence</div>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {view.evidence_rows.length > 0 ? (
                      view.evidence_rows.map((row) => (
                        <div
                          key={`${row.requirement}-${row.evidence}`}
                          className="grid gap-3 px-4 py-3 md:grid-cols-[1.2fr_0.85fr_2fr_1fr]"
                        >
                          <div className="text-[13px] font-semibold text-slate-900">{row.requirement}</div>
                          <div>
                            <span className={matchTypeBadgeTone(row.match_type)}>{row.match_type}</span>
                          </div>
                          <div className="text-[13px] leading-6 text-slate-600">{row.evidence}</div>
                          <div className="flex flex-col justify-center gap-1.5">
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full ${confidenceBarColor(row.match_type)}`}
                                style={{ width: `${row.confidence_score}%` }}
                              />
                            </div>
                            <div className="text-[12px] font-semibold text-slate-700">
                              {row.confidence_score.toFixed(0)}%
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-[13px] text-slate-500">
                        No evidence rows available from stage outputs.
                      </div>
                    )}
                  </div>
                </div>
              </Panel>

              {/* Match cards */}
              <div className="grid gap-3 lg:grid-cols-3">
                <MatchCard
                  title={`Goal Matches (${view.matches.exact.length})`}
                  tone="exact"
                  items={view.matches.exact}
                />
                <MatchCard
                  title={`Transferable Matches (${view.matches.transferable.length})`}
                  tone="transferable"
                  items={view.matches.transferable}
                />
                <MatchCard
                  title={`Missing Requirements (${view.matches.missing.length})`}
                  tone="missing"
                  items={view.matches.missing}
                />
              </div>

              {/* Professional Footprint */}
              <Panel title="Professional Footprint Analysis" className="print:break-inside-avoid">
                <p className="text-[13.5px] leading-7 text-slate-700">{view.professional_footprint_summary}</p>
                {Object.entries(view.professional_links).length > 0 ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {Object.entries(view.professional_links).map(([key, value]) => (
                      <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{key}</div>
                        <a
                          href={value}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 block truncate text-[13px] font-semibold text-accent hover:underline"
                        >
                          {value}
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl bg-slate-50 p-3 text-[13px] text-slate-500">
                    No external links submitted.
                  </div>
                )}
              </Panel>
            </div>

            {/* Right column */}
            <div className="space-y-4">

              {/* Risk Flags */}
              <Panel title="Risk Flag" className="print:break-inside-avoid">
                <div className="space-y-2">
                  {view.risk_flags.length > 0 ? (
                    view.risk_flags.slice(0, 6).map((risk) => (
                      <div
                        key={risk}
                        className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3"
                      >
                        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                        <div className="text-[13px] leading-6 text-slate-700">{risk}</div>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                      <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <div className="text-[13px] text-slate-700">No material risks captured.</div>
                    </div>
                  )}
                </div>
              </Panel>

              {/* Hiring Panel Review */}
              <Panel title="Hiring Panel Review" className="print:break-inside-avoid">
                <div className="space-y-2.5">
                  {(
                    [
                      { label: "Technical Lead", value: view.panel.technical_lead_view },
                      { label: "HR Recruiter", value: view.panel.hr_recruiter_view },
                      { label: "Hiring Manager", value: view.panel.hiring_manager_view },
                      { label: "Risk Auditor", value: view.panel.risk_auditor_view },
                    ] as const
                  ).map(({ label, value }) => (
                    <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        {label}
                      </div>
                      <div className="text-[13px] leading-6 text-slate-700">{value || "Not provided."}</div>
                    </div>
                  ))}
                </div>
              </Panel>

              {/* Interview Pack */}
              <Panel title="Interview Pack" className="print:break-inside-avoid">
                <div className="space-y-2">
                  {view.interview_focus.length > 0 ? (
                    view.interview_focus.slice(0, 6).map((item, index) => (
                      <div key={item} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <div className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent text-[10px] font-bold text-white">
                          {index + 1}
                        </div>
                        <div className="text-[13px] leading-6 text-slate-700">{item}</div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl bg-slate-50 p-3 text-[13px] text-slate-500">
                      Interview focus areas unavailable.
                    </div>
                  )}
                </div>
              </Panel>

              {/* Why this candidate? */}
              <Panel title="Why this candidate?" className="print:break-inside-avoid">
                <div className="rounded-xl border-l-[3px] border-accent bg-blue-50/40 px-4 py-3 text-[13.5px] leading-7 text-slate-700">
                  {view.why_this_candidate}
                </div>
              </Panel>
            </div>
          </div>

          {/* Technical appendix */}
          <details className="rounded-xl border border-slate-200 bg-slate-50 p-4 print:hidden">
            <summary className="cursor-pointer text-[13px] font-semibold text-slate-800">
              Technical appendix (raw JSON)
            </summary>
            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              <JsonAccordion label="Score JSON" value={report.score} />
              <JsonAccordion label="Report JSON" value={report.report} />
              <JsonAccordion label="Panel JSON" value={report.panel_review} />
              <JsonAccordion label="Interview JSON" value={report.interview_pack} />
              <JsonAccordion label="Analysis Stages JSON" value={analysis?.stages ?? []} />
            </div>
          </details>
        </div>
      ) : null}
    </AppShell>
  );
}

// ── Data helpers (unchanged) ─────────────────────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function normalizeMatchType(value: string): DeepDiveEvidenceRow["match_type"] {
  if (value === "exact" || value === "transferable" || value === "missing") return value;
  return "unclassified";
}

function confidenceToPercent(value: string): number {
  const key = value.toLowerCase().trim();
  if (key === "high") return 95;
  if (key === "medium") return 75;
  if (key === "low") return 55;
  return 65;
}

function extractStageArtifacts(analysis: CandidateAnalysisResponse | null): {
  evidence: Record<string, unknown>;
  transferable: Record<string, unknown>;
  footprint: Record<string, unknown>;
  risk: Record<string, unknown>;
} {
  const stages = analysis?.stages ?? [];
  return {
    evidence: findStageRawOutput(stages, "Candidate Evidence Agent"),
    transferable: findStageRawOutput(stages, "Transferable Skill Agent"),
    footprint: findStageRawOutput(stages, "Professional Footprint Agent"),
    risk: findStageRawOutput(stages, "Risk & Contradiction Agent"),
  };
}

function findStageRawOutput(
  stages: Array<{ stage: string; raw_output: Record<string, unknown> }>,
  stagePrefix: string,
): Record<string, unknown> {
  for (let index = stages.length - 1; index >= 0; index -= 1) {
    const item = stages[index];
    if (item.stage.startsWith(stagePrefix)) {
      return asRecord(item.raw_output);
    }
  }
  return {};
}

function buildViewModel(
  candidate: CandidateDetail | null,
  score: Record<string, unknown>,
  reportData: Record<string, unknown>,
  panelData: Record<string, unknown>,
  interviewData: Record<string, unknown>,
  artifacts: {
    evidence: Record<string, unknown>;
    transferable: Record<string, unknown>;
    footprint: Record<string, unknown>;
    risk: Record<string, unknown>;
  },
) {
  if (!candidate) return null;

  const matches = normalizeMatchBuckets(artifacts.transferable);
  const evidenceRows = normalizeEvidenceRows(artifacts.evidence, matches);
  const riskFlags =
    asStringList(artifacts.risk.risks).length > 0
      ? asStringList(artifacts.risk.risks)
      : asStringList(reportData.risks_to_verify);
  const interviewFocus = [
    ...questionList(interviewData.technical_questions),
    ...questionList(interviewData.behavioral_questions),
    ...questionList(interviewData.risk_validation_questions),
  ];

  const panel: DeepDivePanelSummary = {
    technical_lead_view: asString(panelData.technical_lead_view),
    hr_recruiter_view: asString(panelData.hr_recruiter_view),
    hiring_manager_view: asString(panelData.hiring_manager_view),
    risk_auditor_view: asString(panelData.risk_auditor_view),
    final_panel_recommendation: asString(panelData.final_panel_recommendation),
  };

  const professionalFootprintSummary =
    asString(artifacts.footprint.claim_support) ||
    asStringList(artifacts.footprint.professional_evidence).join(" ") ||
    "No substantial external professional footprint was provided. Treated as neutral, not negative.";

  return {
    candidate_id: candidate.id,
    candidate_name: candidate.display_name || "Candidate",
    job_posting_title: candidate.job_posting_title || "Job posting",
    final_score: asNumber(score.final_score, candidate.final_score ?? candidate.current_score ?? 0),
    recommendation: asString(score.recommendation) || candidate.recommendation || "Pending",
    candidate_summary:
      asString(reportData.summary) ||
      candidate.triage_summary ||
      "Summary unavailable. Refer to evidence and panel sections below.",
    why_this_candidate:
      panel.final_panel_recommendation ||
      asString(score.score_explanation) ||
      "Candidate rationale unavailable in the current artifact set.",
    risk_flags: riskFlags,
    interview_focus: interviewFocus,
    evidence_rows: evidenceRows,
    matches,
    professional_footprint_summary: professionalFootprintSummary,
    professional_links: candidate.links ?? {},
    panel,
  };
}

function questionList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asRecord(item))
    .map((row) => asString(row.question))
    .filter((text) => text.length > 0);
}

function normalizeMatchBuckets(transferable: Record<string, unknown>): DeepDiveMatchBuckets {
  const exact = toMatchItems(transferable.exact_matches);
  const trans = toMatchItems(transferable.transferable_matches);
  const missing = toMissingItems(transferable.missing_requirements);
  return { exact, transferable: trans, missing };
}

function toMatchItems(value: unknown): Array<{ requirement: string; detail: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asRecord(item))
    .map((row) => ({
      requirement: asString(row.requirement) || asString(row.candidate_skill) || "Requirement",
      detail: asString(row.evidence) || asString(row.reasoning) || "No additional detail provided.",
    }))
    .filter((row) => row.requirement.length > 0);
}

function toMissingItems(value: unknown): Array<{ requirement: string; detail: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => asRecord(item))
    .map((row) => ({
      requirement: asString(row.requirement) || "Requirement",
      detail: asString(row.reason) || "Missing role-critical evidence.",
    }))
    .filter((row) => row.requirement.length > 0);
}

function normalizeEvidenceRows(
  evidenceRaw: Record<string, unknown>,
  matches: DeepDiveMatchBuckets,
): DeepDiveEvidenceRow[] {
  const exactSet = new Set(matches.exact.map((item) => item.requirement.toLowerCase()));
  const transferableSet = new Set(matches.transferable.map((item) => item.requirement.toLowerCase()));
  const missingSet = new Set(matches.missing.map((item) => item.requirement.toLowerCase()));

  const rows: DeepDiveEvidenceRow[] = [];
  const items = Array.isArray(evidenceRaw.evidence_items) ? evidenceRaw.evidence_items : [];
  for (const item of items) {
    const row = asRecord(item);
    const requirement = asString(row.skill) || "Unlabeled skill";
    const lower = requirement.toLowerCase();
    const match = exactSet.has(lower)
      ? "exact"
      : transferableSet.has(lower)
        ? "transferable"
        : missingSet.has(lower)
          ? "missing"
          : "unclassified";
    const confidenceLabel = asString(row.confidence) || "medium";
    rows.push({
      requirement,
      match_type: normalizeMatchType(match),
      evidence: asString(row.evidence) || "No evidence text provided.",
      confidence_label: confidenceLabel,
      confidence_score: confidenceToPercent(confidenceLabel),
    });
  }

  if (rows.length === 0) {
    for (const item of matches.missing) {
      rows.push({
        requirement: item.requirement,
        match_type: "missing",
        evidence: item.detail,
        confidence_label: "low",
        confidence_score: 35,
      });
    }
  }

  return rows;
}
