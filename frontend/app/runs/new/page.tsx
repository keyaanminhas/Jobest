"use client";

import { AppShell } from "@/components/app-shell";
import { EmptyState, Panel, PrimaryButton, SecondaryButton } from "@/components/ui";
import { createDemoRun, createHiringRun, getReport, getShortlist, runHiringPipeline } from "@/lib/api";
import { demoRun } from "@/lib/demo-data";
import { saveRunLocal } from "@/lib/storage";
import { CandidateInput, CandidateRecord, TopCandidate } from "@/lib/types";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type CandidateForm = {
  name: string;
  resume_text: string;
  profile_summary: string;
};

const blankCandidate = (): CandidateForm => ({
  name: "",
  resume_text: "",
  profile_summary: "",
});

export default function NewRunPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>("");
  const [mode, setMode] = useState<"live" | "demo">("live");
  const [title, setTitle] = useState("Senior Sales Engineer");
  const [jobDescription, setJobDescription] = useState(demoRun.job_description);
  const [hiringContext, setHiringContext] = useState(demoRun.hiring_context);
  const [companyPriority, setCompanyPriority] = useState(demoRun.company_priority ?? "");
  const [mustHaveSkills, setMustHaveSkills] = useState(demoRun.must_have_skills.join(", "));
  const [niceToHaveSkills, setNiceToHaveSkills] = useState(demoRun.nice_to_have_skills.join(", "));
  const [candidates, setCandidates] = useState<CandidateForm[]>(
    demoRun.candidates.slice(0, 3).map((candidate) => ({
      name: candidate.name,
      resume_text: candidate.resume_text,
      profile_summary:
        candidate.professional_links?.portfolio ??
        candidate.professional_links?.linkedin ??
        candidate.professional_links?.github ??
        "",
    })),
  );

  function updateCandidate(index: number, key: keyof CandidateForm, value: string) {
    setCandidates((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
  }

  function loadDemo() {
    setMode("demo");
    setTitle(demoRun.title);
    setJobDescription(demoRun.job_description);
    setHiringContext(demoRun.hiring_context);
    setCompanyPriority(demoRun.company_priority ?? "");
    setMustHaveSkills(demoRun.must_have_skills.join(", "));
    setNiceToHaveSkills(demoRun.nice_to_have_skills.join(", "));
    setCandidates(
      demoRun.candidates.map((candidate) => ({
        name: candidate.name,
        resume_text: candidate.resume_text,
        profile_summary:
          candidate.professional_links?.portfolio ??
          candidate.professional_links?.linkedin ??
          candidate.professional_links?.github ??
          "",
      })),
    );
  }

  async function onSubmit() {
    setError("");

    startTransition(async () => {
      const filteredCandidates = candidates
        .filter((candidate) => candidate.name.trim() || candidate.resume_text.trim())
        .map<CandidateInput>((candidate) => ({
          name: candidate.name.trim() || "Unnamed candidate",
          resume_text: candidate.resume_text.trim(),
          professional_links: {
            portfolio: candidate.profile_summary.trim() || null,
          },
        }));

      if (!title.trim() || !jobDescription.trim() || !hiringContext.trim() || filteredCandidates.length === 0) {
        setError("Add the role, job description, hiring context, and at least one candidate before running the pipeline.");
        return;
      }

      if (mode === "demo") {
        const run = await createDemoRun();
        router.push(`/runs/${run.id}/pipeline`);
        return;
      }

      const payload = {
        title: title.trim(),
        job_description: jobDescription.trim(),
        hiring_context: hiringContext.trim(),
        company_priority: companyPriority.trim(),
        must_have_skills: mustHaveSkills.split(",").map((value) => value.trim()).filter(Boolean),
        nice_to_have_skills: niceToHaveSkills.split(",").map((value) => value.trim()).filter(Boolean),
        candidates: filteredCandidates,
      };

      try {
        const created = await createHiringRun(payload);
        const runResponse = await runHiringPipeline(created.run_id);
        const [shortlistResponse, reportResponse] = await Promise.allSettled([
          getShortlist(created.run_id),
          getReport(created.run_id),
        ]);

        const shortlist =
          shortlistResponse.status === "fulfilled" ? shortlistResponse.value.shortlist : runResponse.top_candidates ?? [];
        const reportData =
          reportResponse.status === "fulfilled"
            ? reportResponse.value.report
            : {
                summary: runResponse.report,
                final_recommendation: runResponse.report,
                risks_to_verify: [],
                candidate_explanations: [],
                top_candidates: [],
              };

        const synthesizedCandidates: CandidateRecord[] = filteredCandidates.map((candidate) => {
          const matched = shortlist.find(
            (item: TopCandidate) => item.candidate_name.toLowerCase() === candidate.name.toLowerCase(),
          );
          return {
            candidate,
            status: matched?.status ?? "completed",
            score:
              matched?.score_breakdown ?? {
                requirement_match: 0,
                evidence_strength: 0,
                professional_footprint: 50,
                hiring_context_fit: 0,
                risk_penalty: 0,
                final_score: 0,
                recommendation: "Reject",
                score_explanation: "Detailed candidate output is unavailable from the live backend endpoints alone.",
              },
            evidence: {
              evidence_items: matched?.top_strengths.map((skill) => ({
                skill,
                evidence: "Summarized from shortlist output.",
                source: "shortlist",
                confidence: "medium" as const,
              })),
            },
            transferable_skills: {
              exact_matches: matched?.top_strengths.map((skill) => ({
                requirement: skill,
                candidate_skill: skill,
                evidence: "Summarized from shortlist output.",
                confidence: "medium",
              })),
              transferable_matches: [],
              missing_requirements: [],
            },
            risk_audit: {
              risk_level: matched?.key_risks.length ? "medium" : "low",
              risk_penalty: matched?.score_breakdown.risk_penalty ?? 0,
              risks: matched?.key_risks ?? [],
              recommended_interview_focus: matched?.key_risks ?? [],
            },
            panel_review: {
              final_panel_recommendation: matched?.why ?? "Use shortlist and report data to guide deeper review.",
            },
            interview_pack: {
              technical_questions: [],
              behavioral_questions: [],
              risk_validation_questions: [],
            },
            why_this_candidate: matched?.why ?? "Candidate rationale not available.",
            why_not_this_candidate: "Use the live shortlist and report together with backend deep-dive artifacts when available.",
          };
        });

        const localRun = {
          ...created.run,
          status: runResponse.status,
          results: {
            run_id: runResponse.run_id,
            status: runResponse.status,
            pipeline: runResponse.pipeline ?? [],
            top_candidates: shortlist,
            report: runResponse.report,
            report_data: reportData,
            candidates: synthesizedCandidates,
          },
        };

        saveRunLocal(localRun);
        router.push(`/runs/${created.run_id}/pipeline`);
      } catch {
        setError("Backend unavailable through the SSH tunnel. Switch to Demo Mode to continue the polished flow offline.");
      }
    });
  }

  return (
    <AppShell
      title="Create Hiring Run"
      subtitle="Define role context, add candidates, and review the run before orchestration starts."
      actions={
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={loadDemo}
            className="rounded-2xl border border-accent bg-white px-5 py-3 text-sm font-semibold text-accent"
          >
            Load Demo Scenario
          </button>
          <PrimaryButton href={`/runs/${demoRun.id}/pipeline`}>Open Existing Demo</PrimaryButton>
        </div>
      }
    >
      <div className="space-y-4">
        <Panel>
          <div className="flex items-center gap-4">
            {[
              { n: 1, label: "Job & Context", active: true },
              { n: 2, label: "Candidates", active: false },
              { n: 3, label: "Review & Run", active: false },
            ].map((step, idx) => (
              <div key={step.label} className="flex flex-1 items-center gap-3">
                <div className={`grid h-10 w-10 place-items-center rounded-full border-2 text-sm font-semibold ${step.active ? "border-accent text-accent" : "border-slate-300 text-slate-600"}`}>{step.n}</div>
                <span className="text-[15px] font-semibold text-slate-700">{step.label}</span>
                {idx < 2 ? <div className="ml-3 h-px flex-1 border-t border-slate-200" /> : null}
              </div>
            ))}
          </div>
        </Panel>
        <div className="grid gap-6 xl:grid-cols-[1.5fr_0.8fr]">
        <div className="space-y-6">
          <Panel title="Job Information" subtitle="Define the role and what success looks like.">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-slate-700">Job title</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-accent focus:bg-white"
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-slate-700">Job description</span>
                <textarea
                  rows={7}
                  value={jobDescription}
                  onChange={(event) => setJobDescription(event.target.value)}
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-accent focus:bg-white"
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-slate-700">Hiring context</span>
                <textarea
                  rows={6}
                  value={hiringContext}
                  onChange={(event) => setHiringContext(event.target.value)}
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-accent focus:bg-white"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Company priority</span>
                <input
                  value={companyPriority}
                  onChange={(event) => setCompanyPriority(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-accent focus:bg-white"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Run mode</span>
                <select
                  value={mode}
                  onChange={(event) => setMode(event.target.value as "live" | "demo")}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-accent focus:bg-white"
                >
                  <option value="live">Live backend via SSH tunnel</option>
                  <option value="demo">Demo / mock mode</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Must-have skills</span>
                <input
                  value={mustHaveSkills}
                  onChange={(event) => setMustHaveSkills(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-accent focus:bg-white"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Nice-to-have skills</span>
                <input
                  value={niceToHaveSkills}
                  onChange={(event) => setNiceToHaveSkills(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-accent focus:bg-white"
                />
              </label>
            </div>
          </Panel>

          <Panel
            title="Candidates"
            subtitle="Add candidate profile details for evaluation."
            action={
              <button
                type="button"
                onClick={() => setCandidates((current) => [...current, blankCandidate()])}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
              >
                <Plus className="h-4 w-4" />
                Add candidate
              </button>
            }
          >
            <div className="space-y-4">
              {candidates.map((candidate, index) => (
                <div key={`${candidate.name}-${index}`} className="rounded-[1.75rem] border border-slate-200 bg-slate-50/70 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="font-semibold text-slate-900">Candidate {index + 1}</div>
                    {candidates.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => setCandidates((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                        className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                  <div className="grid gap-4">
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-slate-700">Candidate name</span>
                      <input
                        value={candidate.name}
                        onChange={(event) => updateCandidate(index, "name", event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-accent"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-slate-700">Resume text</span>
                      <textarea
                        rows={5}
                        value={candidate.resume_text}
                        onChange={(event) => updateCandidate(index, "resume_text", event.target.value)}
                        className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-accent"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-slate-700">Professional profile summary</span>
                      <textarea
                        rows={3}
                        value={candidate.profile_summary}
                        onChange={(event) => updateCandidate(index, "profile_summary", event.target.value)}
                        className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-accent"
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="What happens next?">
            <div className="space-y-3 text-[14px] text-slate-700">
              <div>10 AI agents will analyze</div>
              <div>Evidence-based scoring</div>
              <div>Top 5 shortlist</div>
              <div>Interview packs</div>
            </div>
          </Panel>

          <Panel title="Run summary" subtitle="Review and launch pipeline.">
            <div className="space-y-4">
              <div className="rounded-3xl bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Candidates</div>
                <div className="mt-2 font-heading text-4xl font-extrabold text-slate-950">{candidates.length}</div>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Mode</div>
                <div className="mt-2 font-semibold text-slate-900">{mode === "live" ? "Live backend" : "Demo / mock"}</div>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {mode === "live"
                    ? "Uses the FastAPI backend over your SSH tunnel at localhost:8000."
                    : "Uses polished local demo data if the backend is unavailable."}
                </p>
              </div>
              <div className="rounded-3xl bg-blue-50 p-4">
                <div className="font-semibold text-accent">Run Agent Pipeline</div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Jobest will show visible orchestration, structured JSON, shortlist ranking, candidate drill-down, and final report screens.
                </p>
              </div>
              {error ? <div className="rounded-3xl bg-red-50 p-4 text-sm leading-6 text-red-700">{error}</div> : null}
              <button
                type="button"
                onClick={onSubmit}
                disabled={pending}
                className="w-full rounded-2xl bg-accent px-5 py-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {pending ? "Starting pipeline..." : "Run Agent Pipeline"}
              </button>
            </div>
          </Panel>

          <EmptyState
            title="Hackathon demo tip"
            body="Use Demo Mode for a guaranteed polished presentation, then switch to Live backend mode to show the actual SSH-tunneled FastAPI integration when the server is stable."
            action={<SecondaryButton href={`/runs/${demoRun.id}/shortlist`}>Preview Demo Shortlist</SecondaryButton>}
          />
        </div>
      </div>
      </div>
    </AppShell>
  );
}
