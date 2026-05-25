"use client";

import { AppShell } from "@/components/app-shell";
import { RunLoader } from "@/components/run-loader";
import { Panel, RecommendationBadge, ScoreRing } from "@/components/ui";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Printer, Share2 } from "lucide-react";

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [toastMessage, setToastMessage] = useState("");

  const triggerPrint = () => {
    window.print();
  };

  const shareReport = () => {
    navigator.clipboard.writeText(window.location.href);
    setToastMessage("Report link copied to clipboard!");
    setTimeout(() => setToastMessage(""), 3000);
  };

  return (
    <AppShell
      title="Hiring Report"
      subtitle="Final evidence-backed shortlist and recommendations for recruiter review."
      actions={
        <div className="flex flex-wrap gap-3">
          <button
            onClick={triggerPrint}
            className="inline-flex items-center gap-2 rounded-xl border border-accent bg-white px-5 py-3 text-[14px] font-semibold text-accent transition hover:bg-blue-50"
          >
            <Printer className="h-4 w-4" />
            Export PDF
          </button>
          <button
            onClick={shareReport}
            className="inline-flex items-center gap-2 rounded-xl border border-accent bg-white px-5 py-3 text-[14px] font-semibold text-accent transition hover:bg-blue-50"
          >
            <Share2 className="h-4 w-4" />
            Share Report
          </button>
        </div>
      }
    >
      <RunLoader runId={id}>
        {({ run }) => {
          const report = run.results?.report_data;

          return (
            <div className="space-y-6">
              <div className="grid gap-5 xl:grid-cols-4">
                <Panel className="bg-white">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Job title</div>
                  <div className="mt-3 font-heading text-3xl font-extrabold text-slate-950">{run.title}</div>
                  <div className="mt-2 text-sm text-slate-500">{run.company_priority || "Standard Priority"}</div>
                </Panel>
                <Panel className="bg-white">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Hiring context</div>
                  <div className="mt-3 text-sm leading-7 text-slate-600 truncate-3-lines">{report?.hiring_context_summary ?? run.hiring_context}</div>
                </Panel>
                <Panel className="bg-white">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Candidates evaluated</div>
                  <div className="mt-3 font-heading text-3xl font-extrabold text-slate-950">{run.results?.candidates?.length ?? run.candidates.length}</div>
                  <div className="mt-2 text-sm text-slate-500">Across the current hiring run</div>
                </Panel>
                <Panel className="bg-white">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Recommendation</div>
                  <div className="mt-3 text-sm leading-7 text-slate-600 truncate-3-lines">{report?.final_recommendation ?? run.results?.report ?? "Analysis pending."}</div>
                </Panel>
              </div>

              <Panel title="Top shortlist" subtitle="Recruiter-facing summary of the pipeline decisions, candidate scores, and verified signals.">
                <div className="overflow-hidden rounded-[1.75rem] border border-slate-200">
                  <div className="hidden grid-cols-[70px_1.2fr_120px_160px_1.5fr] gap-4 bg-slate-50 px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 lg:grid">
                    <div>Rank</div>
                    <div>Candidate</div>
                    <div>Match score</div>
                    <div>Recommendation</div>
                    <div>Key reason</div>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {(run.results?.top_candidates || []).map((candidate) => (
                      <div key={candidate.candidate_name} className="grid gap-5 px-5 py-5 lg:grid-cols-[70px_1.2fr_120px_160px_1.5fr] lg:items-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-lg font-bold text-slate-700">{candidate.rank}</div>
                        <div>
                          <div className="font-semibold text-slate-950">{candidate.candidate_name}</div>
                          <div className="mt-1 text-sm text-slate-500">{run.title}</div>
                        </div>
                        <div className="flex lg:justify-center">
                          <ScoreRing score={candidate.final_score} />
                        </div>
                        <div>
                          <RecommendationBadge recommendation={candidate.recommendation} />
                        </div>
                        <div className="text-sm leading-7 text-slate-600">{candidate.why}</div>
                      </div>
                    ))}
                    {(!run.results?.top_candidates || run.results.top_candidates.length === 0) && (
                      <div className="p-8 text-center text-slate-500 text-sm">
                        No candidates shortlisted yet. Open active pipeline to run deconstruction.
                      </div>
                    )}
                  </div>
                </div>
              </Panel>

              <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
                <Panel title="Candidate explanations & final recommendation">
                  <div className="space-y-4">
                    {(report?.candidate_explanations ?? []).map((candidate, index) => (
                      <div key={candidate.candidate_name} className="rounded-[1.75rem] border border-slate-200 bg-slate-50/70 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="font-semibold text-slate-900">
                            {index + 1}. {candidate.candidate_name}
                          </div>
                        </div>
                        <p className="text-sm leading-7 text-slate-600">{candidate.explanation}</p>
                      </div>
                    ))}
                    {(!report?.candidate_explanations || report.candidate_explanations.length === 0) && (
                      <div className="rounded-[1.75rem] border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
                        Detailed candidate justifications will be displayed here once generated.
                      </div>
                    )}
                    <div className="rounded-[1.75rem] bg-ink p-5 text-white">
                      <div className="font-semibold">Final recommendation</div>
                      <p className="mt-3 text-sm leading-7 text-slate-200">
                        {report?.final_recommendation ?? run.results?.report ?? "Final recommendation pending."}
                      </p>
                    </div>
                  </div>
                </Panel>

                <div className="space-y-6">
                  <Panel title="Risks to verify">
                    <div className="space-y-3">
                      {(report?.risks_to_verify ?? []).map((risk) => (
                        <div key={risk} className="rounded-3xl bg-amber-50 p-4 text-sm text-slate-700">
                          {risk}
                        </div>
                      ))}
                      {(!report?.risks_to_verify || report.risks_to_verify.length === 0) && (
                        <div className="rounded-3xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
                          No outstanding risk items flagged for verification.
                        </div>
                      )}
                    </div>
                  </Panel>

                  <Panel title="Report summary">
                    <p className="text-sm leading-7 text-slate-600">
                      {report?.summary ?? "Structured decision-support report generated."}
                    </p>
                    <div className="mt-5 rounded-3xl bg-blue-50 p-4 text-sm leading-7 text-slate-700">
                      {report?.suggested_next_action ?? "Proceed with structured interviews for the top-ranked candidates."}
                    </div>
                  </Panel>
                </div>
              </div>

              {/* Toast message for dynamic clipboard response */}
              {toastMessage && (
                <div className="fixed bottom-5 right-5 z-50 rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-semibold text-white shadow-2xl animate-fade-in-up border border-slate-700">
                  {toastMessage}
                </div>
              )}
            </div>
          );
        }}
      </RunLoader>
    </AppShell>
  );
}
