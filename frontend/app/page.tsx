import { AppShell } from "@/components/app-shell";
import { Panel, PrimaryButton, ScoreRing, SecondaryButton } from "@/components/ui";
import { demoRun, demoRunId } from "@/lib/demo-data";
import { BriefcaseBusiness, ShieldCheck, Target, UsersRound } from "lucide-react";

const pipeline = [
  { label: "Job\nDeconstructed", status: "Done" },
  { label: "Context\nAnalyzed", status: "Done" },
  { label: "Resumes\nParsed", status: "Done" },
  { label: "Skills\nMapped", status: "Done" },
  { label: "Footprint\nAnalyzed", status: "In Progress" },
  { label: "Risks\nAudited", status: "Pending" },
  { label: "Shortlist\nGenerated", status: "Pending" },
  { label: "Report\nReady", status: "Pending" },
];

const metrics = [
  { title: "Active Hiring Runs", value: "12", delta: "3 vs last 7 days", icon: BriefcaseBusiness, tint: "blue" },
  { title: "Candidates Processed", value: "1,248", delta: "18% vs last 7 days", icon: UsersRound, tint: "green" },
  { title: "Strong Shortlists", value: "128", delta: "14% vs last 7 days", icon: ShieldCheck, tint: "violet" },
  { title: "Avg Match Score", value: "78.6%", delta: "4.2 pts vs last 7 days", icon: Target, tint: "amber" },
];

const tintClass: Record<string, string> = {
  blue: "bg-blue-50 text-accent",
  green: "bg-emerald-50 text-emerald-600",
  violet: "bg-violet-50 text-violet-600",
  amber: "bg-amber-50 text-amber-600",
};

export default function HomePage() {
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
        {metrics.map((metric) => (
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

      <Panel title="AI Agent Pipeline" subtitle="Multi-agent intelligence in action" className="mt-4">
        <div className="overflow-x-auto">
          <div className="flex min-w-[980px] items-start gap-2 py-1">
            {pipeline.map((item, idx) => (
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
                {idx < pipeline.length - 1 ? <div className="mt-7 h-px flex-1 border-t border-dashed border-slate-200" /> : null}
              </div>
            ))}
          </div>
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.8fr_1fr]">
        <Panel title="Top Candidates / Shortlist">
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

        <Panel title="Recent Hiring Runs">
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
