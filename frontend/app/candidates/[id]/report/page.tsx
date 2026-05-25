"use client";

import { AppShell } from "@/components/app-shell";
import { JsonAccordion, Panel, RecommendationBadge, ScoreRing } from "@/components/ui";
import { getCandidate, getCandidateReport } from "@/lib/api";
import { CandidateDetail, CandidateReportResponse } from "@/lib/types";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

function arrayOfStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export default function CandidateReportPage() {
  const params = useParams<{ id: string }>();
  const candidateId = params.id;
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [report, setReport] = useState<CandidateReportResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [candidateRow, reportRow] = await Promise.all([getCandidate(candidateId), getCandidateReport(candidateId)]);
        if (cancelled) return;
        setCandidate(candidateRow);
        setReport(reportRow);
      } catch (requestError) {
        if (cancelled) return;
        setError(requestError instanceof Error ? requestError.message : "Failed loading report.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [candidateId]);

  const score = useMemo(() => (report?.score ?? {}) as Record<string, unknown>, [report]);
  const reportData = useMemo(() => (report?.report ?? {}) as Record<string, unknown>, [report]);
  const panel = useMemo(() => (report?.panel_review ?? {}) as Record<string, unknown>, [report]);
  const interview = useMemo(() => (report?.interview_pack ?? {}) as Record<string, unknown>, [report]);

  return (
    <AppShell
      title={`${candidate?.display_name ?? "Candidate"} Report`}
      subtitle="Final evidence-backed analysis summary with recruiter-focused decision support."
      actions={
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-xl border border-accent px-4 py-3 text-sm font-semibold text-accent print:hidden"
        >
          Export PDF
        </button>
      }
    >
      {error ? <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      <div className="space-y-6 print:space-y-4">
        <div className="grid gap-4 xl:grid-cols-4">
          <Panel>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Candidate</div>
            <div className="mt-2 font-heading text-3xl font-extrabold text-slate-900">{candidate?.display_name || "-"}</div>
            <div className="text-sm text-slate-500">{candidate?.job_posting_title || "-"}</div>
          </Panel>
          <Panel>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Final score</div>
            <div className="mt-3 flex items-center gap-3">
              <ScoreRing score={Number(score.final_score ?? 0)} />
              <div className="font-heading text-4xl font-extrabold text-slate-900">{Number(score.final_score ?? 0).toFixed(1)}</div>
            </div>
          </Panel>
          <Panel>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Recommendation</div>
            <div className="mt-3">{typeof score.recommendation === "string" ? <RecommendationBadge recommendation={score.recommendation} /> : "Pending"}</div>
          </Panel>
          <Panel>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Report Summary</div>
            <p className="mt-2 text-sm leading-7 text-slate-600">{(reportData.summary as string) || "Summary unavailable."}</p>
          </Panel>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <Panel title="Candidate Explanations & Final Recommendation">
            <div className="space-y-4">
              {asString(reportData.top_5_summary) ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{asString(reportData.top_5_summary)}</div>
              ) : null}
              {Array.isArray(reportData.candidate_explanations)
                ? (reportData.candidate_explanations as Array<Record<string, unknown>>).map((row) => {
                    const name = asString(row.candidate_name);
                    const explanation = asString(row.explanation);
                    return (
                      <div key={`${name}-${explanation.slice(0, 12)}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                        <div className="font-semibold text-slate-900">{name || "Candidate"}</div>
                        <div className="mt-1">{explanation}</div>
                      </div>
                    );
                  })
                : null}
              <div className="rounded-xl bg-ink p-4 text-sm text-white">
                {asString(reportData.final_recommendation) || asString(score.score_explanation) || "Final recommendation narrative unavailable."}
              </div>
            </div>
          </Panel>

          <Panel title="Risks to Verify">
            <div className="space-y-3">
              {arrayOfStrings(reportData.risks_to_verify).map((risk) => (
                <div key={risk} className="rounded-xl bg-amber-50 p-3 text-sm text-slate-700">{risk}</div>
              ))}
              {arrayOfStrings(reportData.risks_to_verify).length === 0 ? (
                <div className="text-sm text-slate-500">No additional risk items captured.</div>
              ) : null}
            </div>
          </Panel>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <Panel title="Panel Insights">
            <div className="space-y-3 text-sm leading-7 text-slate-700">
              <div><span className="font-semibold text-slate-900">Technical Lead:</span> {(panel.technical_lead_view as string) || "-"}</div>
              <div><span className="font-semibold text-slate-900">HR Recruiter:</span> {(panel.hr_recruiter_view as string) || "-"}</div>
              <div><span className="font-semibold text-slate-900">Hiring Manager:</span> {(panel.hiring_manager_view as string) || "-"}</div>
              <div><span className="font-semibold text-slate-900">Risk Auditor:</span> {(panel.risk_auditor_view as string) || "-"}</div>
            </div>
          </Panel>

          <Panel title="Interview Focus">
            <div className="space-y-3 text-sm text-slate-700">
              {["technical_questions", "behavioral_questions", "risk_validation_questions"].map((key) => {
                const rows = Array.isArray(interview[key]) ? (interview[key] as Array<Record<string, string>>) : [];
                return (
                  <div key={key}>
                    <div className="mb-2 font-semibold text-slate-900">{key.replaceAll("_", " ")}</div>
                    <div className="space-y-2">
                      {rows.slice(0, 3).map((item) => (
                        <div key={item.question} className="rounded-xl bg-slate-50 p-3">
                          <div className="font-medium text-slate-900">{item.question}</div>
                          <div className="mt-1 text-xs text-slate-500">{item.what_to_listen_for}</div>
                        </div>
                      ))}
                      {rows.length === 0 ? <div className="text-xs text-slate-500">No questions generated.</div> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="Score Breakdown">
            <div className="space-y-2 text-sm text-slate-700">
              <div>Requirement match: <span className="font-semibold">{Number(score.requirement_match ?? 0).toFixed(1)}</span></div>
              <div>Evidence strength: <span className="font-semibold">{Number(score.evidence_strength ?? 0).toFixed(1)}</span></div>
              <div>Professional footprint: <span className="font-semibold">{Number(score.professional_footprint ?? 0).toFixed(1)}</span></div>
              <div>Hiring context fit: <span className="font-semibold">{Number(score.hiring_context_fit ?? 0).toFixed(1)}</span></div>
              <div>Risk penalty: <span className="font-semibold">{Number(score.risk_penalty ?? 0).toFixed(1)}</span></div>
            </div>
          </Panel>
        </div>

        <Panel title="Debug JSON" className="print:hidden" subtitle="Secondary technical view for validation and troubleshooting.">
          <div className="grid gap-4 xl:grid-cols-2">
            <JsonAccordion label="Score JSON" value={report?.score ?? {}} />
            <JsonAccordion label="Report JSON" value={report?.report ?? {}} />
            <JsonAccordion label="Panel Review JSON" value={report?.panel_review ?? {}} />
            <JsonAccordion label="Interview Pack JSON" value={report?.interview_pack ?? {}} />
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
