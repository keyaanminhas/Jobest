"use client";

import { AppShell } from "@/components/app-shell";
import { RunLoader } from "@/components/run-loader";
import { Panel, PrimaryButton, RecommendationBadge, ScoreRing, SecondaryButton } from "@/components/ui";
import { slugify } from "@/lib/utils";
import { Search } from "lucide-react";
import { useParams } from "next/navigation";

function riskTone(risk: string) {
  if (risk.toLowerCase().includes("high")) return "text-red-600";
  if (risk.toLowerCase().includes("medium")) return "text-amber-600";
  return "text-emerald-600";
}

export default function ShortlistPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  return (
    <AppShell
      title="Top Candidates / Shortlist"
      subtitle="Evidence-backed recommendations based on multi-agent analysis and risk assessment."
      actions={
        <div className="flex gap-3">
          <PrimaryButton href="/runs/new">Create Hiring Run</PrimaryButton>
          <SecondaryButton href={`/runs/${id}/pipeline`}>Run Demo Scenario</SecondaryButton>
        </div>
      }
    >
      <RunLoader runId={id}>
        {({ run }) => (
          <div className="space-y-4">
            <Panel>
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_1.8fr]">
                {[
                  { label: "Role", value: run.title },
                  { label: "Recommendation", value: "All" },
                  { label: "Risk Level", value: "All" },
                ].map((filter) => (
                  <div key={filter.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{filter.label}</div>
                    <div className="mt-1 text-[15px] font-semibold text-slate-900">{filter.value}</div>
                  </div>
                ))}
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-[14px] text-slate-400">
                  <Search className="h-4 w-4" />
                  Search candidates...
                </div>
              </div>
            </Panel>

            <div className="grid gap-4 xl:grid-cols-[1.8fr_0.95fr]">
              <Panel title="Ranked shortlist">
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="hidden grid-cols-[56px_1.2fr_1fr_110px_145px_1fr_0.9fr_120px] gap-3 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 lg:grid">
                    <div>Rank</div>
                    <div>Candidate</div>
                    <div>Role</div>
                    <div>Final Score</div>
                    <div>Recommendation</div>
                    <div>Top Strengths</div>
                    <div>Key Risk</div>
                    <div>Action</div>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {run.results?.top_candidates.map((candidate) => {
                      const keyRisk = candidate.key_risks[0] ?? "Low";
                      return (
                        <div key={candidate.candidate_name} className="grid gap-4 px-4 py-3 lg:grid-cols-[56px_1.2fr_1fr_110px_145px_1fr_0.9fr_120px] lg:items-center">
                          <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 font-semibold text-slate-700">{candidate.rank}</div>
                          <div>
                            <div className="font-semibold text-slate-900">{candidate.candidate_name}</div>
                            <div className="text-[12px] text-slate-500">{candidate.candidate_name.toLowerCase().replace(/\s+/g, ".")}@email.com</div>
                          </div>
                          <div className="text-[13px] text-slate-700">{run.title}</div>
                          <div className="flex lg:justify-center"><ScoreRing score={candidate.final_score} /></div>
                          <div><RecommendationBadge recommendation={candidate.recommendation} /></div>
                          <div className="flex flex-wrap gap-1.5">
                            {candidate.top_strengths.slice(0, 3).map((strength) => (
                              <span key={strength} className="rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-semibold text-accent">{strength}</span>
                            ))}
                          </div>
                          <div className={`text-[13px] font-semibold ${riskTone(keyRisk)}`}>Risk: {keyRisk}</div>
                          <a href={`/runs/${id}/candidates/${slugify(candidate.candidate_name)}`} className="inline-flex justify-center rounded-xl border border-accent px-3 py-2 text-[12px] font-semibold text-accent">
                            View Details
                          </a>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 text-[13px] text-slate-500">
                    <span>Showing 1 to {run.results?.top_candidates.length ?? 0} of {run.results?.top_candidates.length ?? 0} candidates</span>
                    <span>Rows per page 10</span>
                  </div>
                </div>
              </Panel>

              <div className="space-y-4">
                <Panel title="Score Distribution">
                  <div className="flex items-center gap-6">
                    <div className="relative h-36 w-36 rounded-full bg-[conic-gradient(#22c55e_0_40%,#facc15_40%_80%,#ef4444_80%_100%)]">
                      <div className="absolute inset-8 rounded-full bg-white" />
                    </div>
                    <div className="space-y-2 text-[13px] text-slate-600">
                      <div>80-100 (2)</div>
                      <div>60-79 (2)</div>
                      <div>40-59 (1)</div>
                      <div>0-39 (0)</div>
                    </div>
                  </div>
                </Panel>

                <Panel title="Shortlist Insight">
                  <p className="text-[14px] leading-7 text-slate-600">
                    Our system prioritizes verifiable impact, transferable skills, and lower risk to help you hire with confidence.
                  </p>
                  <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-[13px] font-semibold text-emerald-700">
                    100% of shortlisted candidates meet your minimum bar.
                  </div>
                </Panel>
              </div>
            </div>
          </div>
        )}
      </RunLoader>
    </AppShell>
  );
}
