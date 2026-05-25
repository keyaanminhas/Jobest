"use client";

import { AppShell } from "@/components/app-shell";
import { RunLoader } from "@/components/run-loader";
import { JsonAccordion, Panel, PrimaryButton, SecondaryButton, StatusBadge } from "@/components/ui";
import { Check, FileText, Radar, ShieldAlert, Sparkles, UsersRound } from "lucide-react";
import { useParams } from "next/navigation";

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

function getRailStatus(key: string, stages: Array<{ stage: string; status: string }>) {
  const matching = stages.filter((stage) => stage.stage.startsWith(key));
  if (matching.length === 0) {
    return "pending";
  }
  if (matching.some((stage) => stage.status.includes("error"))) {
    return "error";
  }
  if (matching.some((stage) => stage.status.includes("warning"))) {
    return "warning";
  }
  if (matching.every((stage) => stage.status.startsWith("completed"))) {
    return "completed";
  }
  return "in_progress";
}

function getCurrentStage(stages: Array<{ stage: string; status: string }>) {
  const liveIndex = pipelineRail.findIndex((item) => getRailStatus(item.key, stages) !== "completed");
  return liveIndex === -1 ? pipelineRail[pipelineRail.length - 1].label.replace("\n", " ") : pipelineRail[liveIndex].label.replace("\n", " ");
}

function railTone(status: string, active: boolean) {
  if (status === "completed") {
    return "border-emerald-300 bg-emerald-50 text-emerald-600";
  }
  if (status === "error") {
    return "border-red-300 bg-red-50 text-red-600";
  }
  if (status === "warning") {
    return "border-amber-300 bg-amber-50 text-amber-600";
  }
  if (active) {
    return "border-blue-400 bg-blue-50 text-accent";
  }
  return "border-slate-200 bg-white text-slate-400";
}

export default function PipelinePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  return (
    <AppShell
      title="Hiring Pipeline"
      subtitle="Jobest is orchestrating specialized AI agents to evaluate candidates with evidence and context."
      actions={
        <div className="flex flex-wrap gap-3">
          <PrimaryButton href={`/runs/${id}/shortlist`}>Resume Run</PrimaryButton>
          <SecondaryButton href={`/runs/${id}/report`}>Use Cached Output</SecondaryButton>
        </div>
      }
    >
      <RunLoader runId={id}>
        {({ run, offline }) => {
          const stages = run.results?.pipeline ?? [];
          const currentStage = getCurrentStage(stages);

          return (
            <div className="space-y-4">
              <div className="text-[13px] text-slate-500">
                Hiring Runs &nbsp; &gt; &nbsp; {run.title} &nbsp; &gt; &nbsp; Pipeline
              </div>
              <Panel
                title="Hiring Pipeline"
                subtitle="Visible orchestration of specialized AI agents, modeled more closely on the reference pipeline screen."
              >
                <div className="overflow-x-auto pb-1">
                  <div className="flex min-w-[1180px] items-start justify-between gap-3">
                    {pipelineRail.map((step, index) => {
                      const status = getRailStatus(step.key, stages);
                      const active = currentStage === step.label.replace("\n", " ");
                      const Icon = step.icon;

                      return (
                        <div key={step.key} className="flex flex-1 items-start">
                          <div className="flex flex-1 flex-col items-center text-center">
                            <div className={`relative flex h-14 w-14 items-center justify-center rounded-full border-2 ${railTone(status, active)}`}>
                              {status === "completed" ? <Check className="h-6 w-6" /> : <Icon className="h-6 w-6" />}
                              <div className="absolute -bottom-2 grid h-5 w-5 place-items-center rounded-full border border-white bg-white text-[10px] font-bold text-slate-600 shadow-sm">
                                {index + 1}
                              </div>
                            </div>
                            <div className={`mt-4 text-[13px] font-semibold leading-5 ${active ? "text-accent" : "text-slate-700"}`}>
                              {step.label.split("\n").map((line) => (
                                <span key={line} className="block">
                                  {line}
                                </span>
                              ))}
                            </div>
                          </div>
                          {index < pipelineRail.length - 1 ? (
                            <div
                              className={`mt-7 hidden h-px flex-1 border-t border-dashed lg:block ${
                                status === "completed" ? "border-emerald-300" : "border-slate-200"
                              }`}
                            />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Panel>

              <div className="grid gap-6 xl:grid-cols-[1.5fr_0.85fr]">
                <Panel title="Agent Execution Timeline" subtitle="Each stage includes status, summary, and raw structured payload.">
                  <div className="space-y-4">
                    {stages.map((stage, index) => (
                      <div key={`${stage.stage}-${index}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-sm font-bold text-emerald-600">
                            {index + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-3">
                            <h3 className="font-heading text-lg font-bold text-slate-950">{stage.stage}</h3>
                              <StatusBadge status={stage.status} />
                            </div>
                            <p className="mt-1 text-[13px] leading-6 text-slate-500">{stage.summary}</p>
                            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                              <pre className="overflow-hidden text-xs leading-6 text-slate-500">
                                {JSON.stringify(stage.raw_output, null, 2).slice(0, 220)}
                                {JSON.stringify(stage.raw_output).length > 220 ? " ..." : ""}
                              </pre>
                            </div>
                            <div className="mt-4">
                              <JsonAccordion label="Expand raw JSON" value={stage.raw_output} />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>

                <div className="space-y-4">
                  <Panel title="Run Summary" subtitle="Operational context for the current orchestration pass.">
                    <dl className="space-y-4 text-sm">
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-slate-500">Job</dt>
                        <dd className="font-semibold text-slate-900">{run.title}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-slate-500">Hiring Run</dt>
                        <dd className="font-semibold text-slate-900">{run.id.slice(0, 12)}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-slate-500">Candidates</dt>
                        <dd className="font-semibold text-slate-900">{run.candidates.length}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-slate-500">Current Stage</dt>
                        <dd className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-accent">{currentStage}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-slate-500">Mode</dt>
                        <dd className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                          {offline ? "Demo" : "Live"}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-5 space-y-3">
                      <PrimaryButton href={`/runs/${id}/shortlist`} className="w-full">
                        Resume Run
                      </PrimaryButton>
                      <SecondaryButton href={`/runs/${id}/report`} className="w-full">
                        Use Cached Output
                      </SecondaryButton>
                    </div>
                  </Panel>

                  <Panel title="How Jobest Evaluates" subtitle="A clearer explanation card aligned with the original design direction.">
                    <div className="rounded-xl bg-slate-50 p-5">
                      <div className="mb-4 inline-flex rounded-2xl bg-blue-100 p-3 text-accent">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <div className="space-y-3 text-sm leading-7 text-slate-600">
                        <p>We reward candidates who demonstrate impact, not just experience. Agents prioritize evidence-backed skills and transferable signals to surface true potential.</p>
                        <p>This creates a fair, consistent, and bias-aware evaluation across every candidate.</p>
                        <p>Requirement match, evidence strength, professional footprint, and context fit are weighted in backend code. Risk is modeled separately as a penalty.</p>
                      </div>
                    </div>
                  </Panel>
                </div>
              </div>
            </div>
          );
        }}
      </RunLoader>
    </AppShell>
  );
}
