"use client";

import { AppShell } from "@/components/app-shell";
import { RunLoader } from "@/components/run-loader";
import { Panel, RecommendationBadge, ScoreRing, SecondaryButton } from "@/components/ui";
import { slugify } from "@/lib/utils";
import { useParams } from "next/navigation";

export default function CandidatePage() {
  const params = useParams<{ id: string; candidateId: string }>();
  const id = params.id;
  const candidateId = params.candidateId;

  return (
    <AppShell
      title="Candidate Deep Dive"
      subtitle="Structured evidence, matches, risks, panel review, and interview questions for one candidate."
      actions={
        <div className="flex gap-3">
          <SecondaryButton href={`/runs/${id}/shortlist`}>Back to Shortlist</SecondaryButton>
          <SecondaryButton href={`/runs/${id}/report`}>View Full Report</SecondaryButton>
        </div>
      }
    >
      <RunLoader runId={id}>
        {({ run }) => {
          const candidate =
            run.results?.candidates?.find((item) => slugify(item.candidate.name) === candidateId) ??
            run.results?.candidates?.[0];

          if (!candidate) {
            return (
              <Panel title="Candidate not found">
                <p className="text-sm text-slate-600">This candidate is not available in the current run data.</p>
              </Panel>
            );
          }

          return (
            <div className="grid gap-6 xl:grid-cols-[1.6fr_0.8fr]">
              <div className="space-y-6">
                <Panel>
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h2 className="font-heading text-4xl font-extrabold text-slate-950">{candidate.candidate.name}</h2>
                      <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-500">
                        <span>{run.title}</span>
                        <span>|</span>
                        <span>{candidate.parsed_profile?.skills?.slice(0, 3).join(", ") || "Skills pending"}</span>
                      </div>
                      <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
                        {candidate.why_this_candidate ?? candidate.panel_review?.final_panel_recommendation ?? "Candidate explanation not available."}
                      </p>
                    </div>
                    <div className="flex items-center gap-6">
                      <ScoreRing score={candidate.score.final_score} />
                      <div>
                        <div className="text-sm text-slate-500">Recommendation</div>
                        <div className="mt-2">
                          <RecommendationBadge recommendation={candidate.score.recommendation} />
                        </div>
                      </div>
                    </div>
                  </div>
                </Panel>

                <Panel title="Evidence table" subtitle="Professional evidence tied to concrete skills and confidence levels.">
                  <div className="overflow-hidden rounded-[1.75rem] border border-slate-200">
                    <div className="grid grid-cols-[1fr_2fr_120px] gap-4 bg-slate-50 px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      <div>Requirement</div>
                      <div>Evidence</div>
                      <div>Confidence</div>
                    </div>
                    <div className="divide-y divide-slate-200">
                      {candidate.evidence?.evidence_items?.map((item) => (
                        <div key={`${item.skill}-${item.evidence}`} className="grid gap-4 px-5 py-4 md:grid-cols-[1fr_2fr_120px]">
                          <div className="font-semibold text-slate-900">{item.skill}</div>
                          <div className="text-sm leading-7 text-slate-600">{item.evidence}</div>
                          <div className="text-sm font-semibold capitalize text-slate-700">{item.confidence}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Panel>

                <div className="grid gap-6 lg:grid-cols-3">
                  <Panel title={`Exact matches (${candidate.transferable_skills?.exact_matches?.length ?? 0})`}>
                    <div className="space-y-3">
                      {candidate.transferable_skills?.exact_matches?.map((item) => (
                        <div key={`${item.requirement}-${item.candidate_skill}`} className="rounded-3xl bg-emerald-50 p-4">
                          <div className="font-semibold text-emerald-700">{item.requirement}</div>
                          <div className="mt-2 text-sm text-slate-600">{item.evidence}</div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                  <Panel title={`Transferable matches (${candidate.transferable_skills?.transferable_matches?.length ?? 0})`}>
                    <div className="space-y-3">
                      {candidate.transferable_skills?.transferable_matches?.map((item) => (
                        <div key={`${item.requirement}-${item.candidate_skill}`} className="rounded-3xl bg-blue-50 p-4">
                          <div className="font-semibold text-accent">{item.requirement}</div>
                          <div className="mt-2 text-sm text-slate-600">{item.reasoning || item.evidence}</div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                  <Panel title={`Missing requirements (${candidate.transferable_skills?.missing_requirements?.length ?? 0})`}>
                    <div className="space-y-3">
                      {candidate.transferable_skills?.missing_requirements?.map((item) => (
                        <div key={item.requirement} className="rounded-3xl bg-red-50 p-4">
                          <div className="font-semibold text-red-700">{item.requirement}</div>
                          <div className="mt-2 text-sm text-slate-600">{item.reason}</div>
                        </div>
                      ))}
                    </div>
                  </Panel>
                </div>

                <Panel title="Professional footprint analysis">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-3xl bg-slate-50 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Portfolio score</div>
                      <div className="mt-2 font-heading text-4xl font-extrabold text-slate-950">{candidate.professional_footprint?.portfolio_score ?? 50}</div>
                    </div>
                    <div className="rounded-3xl bg-slate-50 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">GitHub score</div>
                      <div className="mt-2 font-heading text-4xl font-extrabold text-slate-950">{candidate.professional_footprint?.github_score ?? 50}</div>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <div className="font-semibold text-slate-900">Professional evidence</div>
                      <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-600">
                        {(candidate.professional_footprint?.professional_evidence ?? ["No external evidence provided; treated as neutral, not negative."]).map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">Concerns</div>
                      <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-600">
                        {(candidate.professional_footprint?.concerns ?? ["No major professional footprint concerns logged."]).map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </Panel>
              </div>

              <div className="space-y-6">
                <Panel title="Risk flags">
                  <div className="space-y-3">
                    {(candidate.risk_audit?.risks ?? []).map((risk) => (
                      <div key={risk} className="rounded-3xl bg-amber-50 p-4 text-sm text-slate-700">
                        {risk}
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel title="Hiring panel review">
                  <div className="space-y-4 text-sm leading-7 text-slate-600">
                    <div><span className="font-semibold text-slate-900">Technical lead:</span> {candidate.panel_review?.technical_lead_view}</div>
                    <div><span className="font-semibold text-slate-900">HR recruiter:</span> {candidate.panel_review?.hr_recruiter_view}</div>
                    <div><span className="font-semibold text-slate-900">Hiring manager:</span> {candidate.panel_review?.hiring_manager_view}</div>
                    <div><span className="font-semibold text-slate-900">Risk auditor:</span> {candidate.panel_review?.risk_auditor_view}</div>
                  </div>
                </Panel>

                <Panel title="Interview pack">
                  <div className="space-y-5">
                    {[
                      { label: "Technical questions", items: candidate.interview_pack?.technical_questions ?? [] },
                      { label: "Behavioral questions", items: candidate.interview_pack?.behavioral_questions ?? [] },
                      { label: "Risk validation questions", items: candidate.interview_pack?.risk_validation_questions ?? [] },
                    ].map((section) => (
                      <div key={section.label}>
                        <div className="font-semibold text-slate-900">{section.label}</div>
                        <div className="mt-3 space-y-3">
                          {section.items.map((item) => (
                            <div key={item.question} className="rounded-3xl bg-slate-50 p-4">
                              <div className="font-medium text-slate-900">{item.question}</div>
                              <div className="mt-2 text-sm leading-7 text-slate-600">{item.what_to_listen_for}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel title="Why this candidate?">
                  <p className="text-sm leading-7 text-slate-600">{candidate.why_this_candidate}</p>
                </Panel>

                <Panel title="Why not this candidate?">
                  <p className="text-sm leading-7 text-slate-600">{candidate.why_not_this_candidate}</p>
                </Panel>
              </div>
            </div>
          );
        }}
      </RunLoader>
    </AppShell>
  );
}
