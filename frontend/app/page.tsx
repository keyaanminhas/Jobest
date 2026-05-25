"use client";

import { AppShell } from "@/components/app-shell";
import { Panel, PrimaryButton, ScoreRing, SecondaryButton } from "@/components/ui";
import { demoRun, demoRunId } from "@/lib/demo-data";
import { listHiringRuns } from "@/lib/api";
import { listRunsLocal } from "@/lib/storage";
import { HiringRunRecord } from "@/lib/types";
import { BriefcaseBusiness, ShieldCheck, Target, UsersRound, FileQuestion, ArrowRight, PlayCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { slugify } from "@/lib/utils";

const pipelineSteps = [
  { key: "jd_deconstruction", label: "Job\nDeconstructed" },
  { key: "hiring_context", label: "Context\nAnalyzed" },
  { key: "resume_parser", label: "Resumes\nParsed" },
  { key: "evidence_extractor", label: "Skills\nMapped" },
  { key: "transferable_skills", label: "Footprint\nAnalyzed" },
  { key: "risk_auditor", label: "Risks\nAudited" },
  { key: "panel_review", label: "Shortlist\nGenerated" },
  { key: "final_report", label: "Report\nReady" },
];

const tintClass: Record<string, string> = {
  blue: "bg-blue-50 text-accent",
  green: "bg-emerald-50 text-emerald-600",
  violet: "bg-violet-50 text-violet-600",
  amber: "bg-amber-50 text-amber-600",
};

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const [runs, setRuns] = useState<HiringRunRecord[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>("");

  useEffect(() => {
    // Load Demo Mode status
    const isDemo = localStorage.getItem("jobest-demo-mode") === "true";
    setDemoMode(isDemo);

    async function loadData() {
      let loadedRuns: HiringRunRecord[] = [];
      try {
        // Fetch live runs from the backend
        loadedRuns = await listHiringRuns();
      } catch (err) {
        // Fallback to local storage if backend is unavailable
        loadedRuns = listRunsLocal();
      }

      setRuns(loadedRuns);
      
      if (loadedRuns.length > 0) {
        const storedId = localStorage.getItem("jobest-selected-run-id");
        if (storedId && loadedRuns.some(r => r.id === storedId)) {
          setSelectedRunId(storedId);
        } else {
          setSelectedRunId(loadedRuns[0].id);
          localStorage.setItem("jobest-selected-run-id", loadedRuns[0].id);
        }
      }
      setLoading(false);
    }

    loadData();
  }, []);

  const selectedRun = runs.find((r) => r.id === selectedRunId) || null;

  // 1. DEMO MODE ACTIVE - Load Static Scenarios
  if (demoMode) {
    const staticPipeline = [
      { label: "Job\nDeconstructed", status: "Done" },
      { label: "Context\nAnalyzed", status: "Done" },
      { label: "Resumes\nParsed", status: "Done" },
      { label: "Skills\nMapped", status: "Done" },
      { label: "Footprint\nAnalyzed", status: "In Progress" },
      { label: "Risks\nAudited", status: "Pending" },
      { label: "Shortlist\nGenerated", status: "Pending" },
      { label: "Report\nReady", status: "Pending" },
    ];

    const staticMetrics = [
      { title: "Active Hiring Runs", value: "12", delta: "3 vs last 7 days", icon: BriefcaseBusiness, tint: "blue" },
      { title: "Candidates Processed", value: "1,248", delta: "18% vs last 7 days", icon: UsersRound, tint: "green" },
      { title: "Strong Shortlists", value: "128", delta: "14% vs last 7 days", icon: ShieldCheck, tint: "violet" },
      { title: "Avg Match Score", value: "78.6%", delta: "4.2 pts vs last 7 days", icon: Target, tint: "amber" },
    ];

    return (
      <AppShell
        title="Welcome back, Arjun"
        subtitle="Here's what's happening with your hiring today."
        actions={
          <div className="flex gap-3">
            <PrimaryButton href="/runs/new">Create Hiring Run</PrimaryButton>
            <SecondaryButton href={`/runs/${demoRunId}/pipeline`}>Run Demo Scenario</SecondaryButton>
          </div>
        }
      >
        <div className="grid gap-4 lg:grid-cols-4">
          {staticMetrics.map((metric) => (
            <Panel key={metric.title} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className={`grid h-12 w-12 place-items-center rounded-xl ${tintClass[metric.tint]}`}>
                  <metric.icon className="h-5 w-5" />
                </div>
                <div className="text-right text-xs text-emerald-600">+ {metric.delta}</div>
              </div>
              <div className="mt-3 text-[13px] text-slate-500">{metric.title}</div>
              <div className="mt-1 font-heading text-[40px] font-extrabold leading-none text-slate-950">{metric.value}</div>
            </Panel>
          ))}
        </div>

        <Panel title="AI Agent Pipeline" subtitle="Multi-agent intelligence in action (Mock scenario)" className="mt-4">
          <div className="overflow-x-auto">
            <div className="flex min-w-[980px] items-start gap-2 py-1">
              {staticPipeline.map((item, idx) => (
                <div key={item.label} className="flex flex-1 items-start">
                  <div className="flex flex-col items-center text-center">
                    <div className={`grid h-14 w-14 place-items-center rounded-full border-2 ${idx < 4 ? "border-emerald-400 bg-emerald-50 text-emerald-600" : idx === 4 ? "border-blue-400 bg-blue-50 text-accent" : "border-slate-200 bg-white text-slate-400"}`}>
                      <span className="text-sm font-semibold">{idx + 1}</span>
                    </div>
                    <div className="mt-2 text-[12px] font-semibold leading-5 text-slate-700">
                      {item.label.split("\n").map((line) => (
                        <span key={line} className="block">{line}</span>
                      ))}
                    </div>
                    <span className={`mt-2 rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.status === "Done" ? "bg-emerald-100 text-emerald-700" : item.status === "In Progress" ? "bg-blue-100 text-accent" : "bg-slate-100 text-slate-500"}`}>
                      {item.status}
                    </span>
                  </div>
                  {idx < staticPipeline.length - 1 ? <div className="mt-7 h-px flex-1 border-t border-dashed border-slate-200" /> : null}
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.8fr_1fr]">
          <Panel title="Top Candidates / Shortlist (Mock)">
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-[58px_1.2fr_110px_130px_1fr] gap-3 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                <div>Rank</div>
                <div>Candidate</div>
                <div>Match Score</div>
                <div>Recommendation</div>
                <div>Top Strengths</div>
              </div>
              <div className="divide-y divide-slate-200">
                {demoRun.results?.top_candidates.slice(0, 4).map((candidate) => (
                  <a key={candidate.candidate_name} href={`/runs/${demoRunId}/candidates/${candidate.candidate_name.toLowerCase().replace(/\s+/g, "-")}`} className="grid grid-cols-[58px_1.2fr_110px_130px_1fr] gap-3 px-4 py-3">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 font-semibold text-slate-700">{candidate.rank}</div>
                    <div>
                      <div className="font-semibold text-slate-900">{candidate.candidate_name}</div>
                      <div className="text-[12px] text-slate-500">{demoRun.title}</div>
                    </div>
                    <div className="flex items-center"><ScoreRing score={candidate.final_score} /></div>
                    <div className="flex items-center"><span className={`rounded-full px-3 py-1 text-[12px] font-semibold ${candidate.recommendation.includes("Strong") ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{candidate.recommendation}</span></div>
                    <div className="flex flex-wrap items-center gap-2">
                      {candidate.top_strengths.slice(0, 3).map((skill) => (
                        <span key={skill} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">{skill}</span>
                      ))}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </Panel>

          <Panel title="Recent Hiring Runs (Mock)">
            <div className="space-y-3">
              {[
                { role: "Senior Sales Engineer", date: "May 20", status: "Active", strong: "12 Strong Shortlists" },
                { role: "Product Marketing Manager", date: "May 19", status: "Active", strong: "8 Strong Shortlists" },
                { role: "Data Scientist", date: "May 18", status: "Active", strong: "15 Strong Shortlists" },
              ].map((row) => (
                <div key={row.role} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
                  <div>
                    <div className="font-semibold text-slate-900">{row.role}</div>
                    <div className="text-[12px] text-slate-500">{row.strong}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[12px] text-emerald-600">Active: {row.status}</div>
                    <div className="text-[12px] text-slate-500">{row.date}</div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </AppShell>
    );
  }

  // 2. LIVE MODE - Loading State
  if (loading) {
    return (
      <AppShell title="Dashboard" subtitle="Synchronizing pipeline dashboard...">
        <div className="flex h-[320px] items-center justify-center rounded-3xl border border-slate-200 bg-white">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <Loader2 className="h-10 w-10 animate-spin text-accent" />
            <span className="text-sm font-semibold">Connecting to live API backend...</span>
          </div>
        </div>
      </AppShell>
    );
  }

  // 3. LIVE MODE - Empty State
  if (runs.length === 0) {
    return (
      <AppShell
        title="Dashboard"
        subtitle="Configure your multi-agent pipelines and start assessing talent."
        actions={<PrimaryButton href="/runs/new">Create Hiring Run</PrimaryButton>}
      >
        <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white py-16 px-6 text-center">
          <div className="rounded-full bg-blue-50 p-6 text-accent">
            <BriefcaseBusiness className="h-12 w-12" />
          </div>
          <h2 className="mt-5 font-heading text-2xl font-extrabold text-slate-900">No active hiring runs found</h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
            Get started by creating a hiring run, dropping PDF resumes, and letting Jobest's specialized AI agents evaluate them.
          </p>
          <div className="mt-8 flex gap-3">
            <PrimaryButton href="/runs/new">Create Hiring Run</PrimaryButton>
            <button
              onClick={() => {
                localStorage.setItem("jobest-demo-mode", "true");
                window.location.reload();
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <PlayCircle className="h-4 w-4" />
              Switch to Demo Mode
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  // 4. LIVE MODE - Dynamic Math/Metrics
  const activeCount = runs.length;
  const candidatesCount = runs.reduce((sum, r) => sum + r.candidates.length, 0);
  
  // Calculate strong shortlists (candidates with recommendation Strong Recommend / Recommend)
  let strongCount = 0;
  let totalScoreSum = 0;
  let totalScoredCandidates = 0;

  runs.forEach((r) => {
    const candidates = r.results?.candidates ?? [];
    candidates.forEach((c: any) => {
      const rec = c.score?.recommendation ?? "";
      if (rec.includes("Recommend") || rec.includes("Strong")) {
        strongCount += 1;
      }
      if (c.score?.final_score) {
        totalScoreSum += c.score.final_score;
        totalScoredCandidates += 1;
      }
    });
  });

  const avgScore = totalScoredCandidates > 0 ? (totalScoreSum / totalScoredCandidates).toFixed(1) + "%" : "0%";

  const dynamicMetrics = [
    { title: "Active Hiring Runs", value: activeCount.toString(), delta: "Live runs count", icon: BriefcaseBusiness, tint: "blue" },
    { title: "Candidates Processed", value: candidatesCount.toLocaleString(), delta: "PDF uploads", icon: UsersRound, tint: "green" },
    { title: "Strong Candidates", value: strongCount.toString(), delta: "Assessments approved", icon: ShieldCheck, tint: "violet" },
    { title: "Avg Match Score", value: avgScore, delta: "Dynamic aggregate", icon: Target, tint: "amber" },
  ];

  // Pipeline execution step mappings
  const stages = selectedRun?.results?.pipeline ?? [];
  const pipeline = pipelineSteps.map((step) => {
    const matching = stages.filter((stage) => stage.stage.startsWith(step.key) || stage.stage.toLowerCase().includes(step.key.replace("_", " ")));
    let status = "Pending";
    if (matching.length > 0) {
      if (matching.some((stage) => stage.status.includes("error"))) {
        status = "Failed";
      } else if (matching.every((stage) => stage.status.startsWith("completed"))) {
        status = "Done";
      } else {
        status = "In Progress";
      }
    } else if (selectedRun?.status === "completed") {
      status = "Done";
    }
    return { label: step.label, status };
  });

  // Shortlist candidates
  const shortlist = selectedRun?.results?.top_candidates ?? [];

  return (
    <AppShell
      title="Hiring Dashboard"
      subtitle="Operational oversight of live multi-agent assessments."
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-semibold text-slate-500">Selected Run:</span>
            <select
              value={selectedRunId}
              onChange={(e) => {
                const rid = e.target.value;
                setSelectedRunId(rid);
                localStorage.setItem("jobest-selected-run-id", rid);
              }}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-accent shadow-sm"
            >
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title} ({r.status})
                </option>
              ))}
            </select>
          </div>
          <PrimaryButton href="/runs/new">Create Hiring Run</PrimaryButton>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-4">
        {dynamicMetrics.map((metric) => (
          <Panel key={metric.title} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className={`grid h-12 w-12 place-items-center rounded-xl ${tintClass[metric.tint]}`}>
                <metric.icon className="h-5 w-5" />
              </div>
              <div className="text-right text-xs text-slate-500">{metric.delta}</div>
            </div>
            <div className="mt-3 text-[13px] text-slate-500">{metric.title}</div>
            <div className="mt-1 font-heading text-[40px] font-extrabold leading-none text-slate-950">{metric.value}</div>
          </Panel>
        ))}
      </div>

      <Panel
        title="AI Agent Pipeline"
        subtitle={`Visible progression: ${selectedRun?.title} (${selectedRun?.status})`}
        action={
          selectedRun ? (
            <a
              href={`/runs/${selectedRun.id}/pipeline`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
            >
              Open Pipeline Dashboard <ArrowRight className="h-3.5 w-3.5" />
            </a>
          ) : undefined
        }
        className="mt-4"
      >
        <div className="overflow-x-auto">
          <div className="flex min-w-[980px] items-start gap-2 py-1">
            {pipeline.map((item, idx) => (
              <div key={item.label} className="flex flex-1 items-start">
                <div className="flex flex-col items-center text-center">
                  <div className={`grid h-14 w-14 place-items-center rounded-full border-2 ${item.status === "Done" ? "border-emerald-400 bg-emerald-50 text-emerald-600" : item.status === "In Progress" ? "border-blue-400 bg-blue-50 text-accent animate-pulse" : item.status === "Failed" ? "border-red-400 bg-red-50 text-red-600" : "border-slate-200 bg-white text-slate-400"}`}>
                    <span className="text-sm font-semibold">{idx + 1}</span>
                  </div>
                  <div className="mt-2 text-[12px] font-semibold leading-5 text-slate-700">
                    {item.label.split("\n").map((line) => (
                      <span key={line} className="block">{line}</span>
                    ))}
                  </div>
                  <span className={`mt-2 rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.status === "Done" ? "bg-emerald-100 text-emerald-700" : item.status === "In Progress" ? "bg-blue-100 text-accent animate-pulse" : item.status === "Failed" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"}`}>
                    {item.status}
                  </span>
                </div>
                {idx < pipeline.length - 1 ? <div className="mt-7 h-px flex-1 border-t border-dashed border-slate-200" /> : null}
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.8fr_1fr]">
        <Panel
          title="Top Candidates / Shortlist"
          subtitle={selectedRun ? `Assessments for ${selectedRun.title}` : ""}
          action={
            selectedRun?.status === "completed" ? (
              <a
                href={`/runs/${selectedRun.id}/shortlist`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
              >
                Full Shortlist Analysis <ArrowRight className="h-3.5 w-3.5" />
              </a>
            ) : undefined
          }
        >
          {shortlist.length === 0 ? (
            <div className="flex h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-slate-500">
              <FileQuestion className="h-8 w-8 text-slate-400" />
              <h4 className="mt-2 font-semibold text-slate-800">Shortlist not generated yet</h4>
              <p className="mt-1 text-xs text-slate-400">
                {selectedRun?.status === "processing"
                  ? "The agent pipeline is currently running. Check the live progress above."
                  : "Start the pipeline deconstruction to begin candidate assessments."}
              </p>
              {selectedRun?.status === "processing" && (
                <a
                  href={`/runs/${selectedRun.id}/pipeline`}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                >
                  Watch Live Pipeline
                </a>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-[58px_1.2fr_110px_130px_1fr] gap-3 bg-slate-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                <div>Rank</div>
                <div>Candidate</div>
                <div>Match Score</div>
                <div>Recommendation</div>
                <div>Top Strengths</div>
              </div>
              <div className="divide-y divide-slate-200">
                {shortlist.slice(0, 4).map((candidate) => (
                  <a
                    key={candidate.candidate_name}
                    href={`/runs/${selectedRunId}/candidates/${slugify(candidate.candidate_name)}`}
                    className="grid grid-cols-[58px_1.2fr_110px_130px_1fr] gap-3 px-4 py-3 hover:bg-slate-50 transition"
                  >
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 font-semibold text-slate-700">
                      {candidate.rank}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">{candidate.candidate_name}</div>
                      <div className="text-[12px] text-slate-500">{selectedRun?.title}</div>
                    </div>
                    <div className="flex items-center">
                      <ScoreRing score={candidate.final_score} />
                    </div>
                    <div className="flex items-center">
                      <span
                        className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
                          candidate.recommendation.includes("Strong")
                            ? "bg-emerald-100 text-emerald-700"
                            : candidate.recommendation.includes("Reject")
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {candidate.recommendation}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {candidate.top_strengths.slice(0, 3).map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </Panel>

        <Panel title="Recent Hiring Runs">
          <div className="space-y-3">
            {runs.slice(0, 4).map((r) => {
              const count = r.results?.top_candidates?.length ?? 0;
              const hasReport = r.results?.report ? "Report Ready" : "No Report";
              return (
                <div
                  key={r.id}
                  onClick={() => {
                    setSelectedRunId(r.id);
                    localStorage.setItem("jobest-selected-run-id", r.id);
                  }}
                  className={`flex items-center justify-between rounded-xl border px-3 py-2.5 cursor-pointer transition ${
                    selectedRunId === r.id
                      ? "border-accent bg-blue-50/20"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-semibold text-slate-900 truncate">{r.title}</div>
                    <div className="text-[12px] text-slate-500">
                      {count > 0 ? `${count} Candidates Assessed` : "Assessment pending"}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`text-[12px] font-semibold ${
                        r.status === "completed"
                          ? "text-emerald-600"
                          : r.status === "processing"
                          ? "text-accent animate-pulse"
                          : r.status === "error"
                          ? "text-red-600"
                          : "text-slate-500"
                      }`}
                    >
                      {r.status.toUpperCase()}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {r.created_at ? new Date(r.created_at).toLocaleDateString() : "Just now"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
