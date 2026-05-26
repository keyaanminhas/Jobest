"use client";

import { AppShell } from "@/components/app-shell";
import { createJobPosting } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  ClipboardList,
  MessageSquareText,
  Sparkles,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const wizardSteps = [
  { label: "Job & Context", icon: Briefcase },
  { label: "Candidates", icon: Users },
  { label: "Criteria", icon: ClipboardList },
  { label: "Review & Run", icon: CheckCircle2 },
];

const whatHappensNext = [
  "AI agents analyze every CV",
  "Evidence-based scoring",
  "Transparent shortlist with trails",
];

export default function NewJobPostingPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [title, setTitle] = useState("AI Software Engineer");
  const [jobDescription, setJobDescription] = useState("");
  const [hiringContext, setHiringContext] = useState("");
  const [companyPriority, setCompanyPriority] = useState("");
  const [mustHave, setMustHave] = useState("");
  const [niceToHave, setNiceToHave] = useState("");

  function loadDemo() {
    setTitle("Senior SaaS Engineer");
    setJobDescription(
      "We are looking for a Senior SaaS Engineer to join our core platform team. You will design, build, and scale multi-tenant services that power thousands of customers. The ideal candidate has deep backend expertise, a product-quality mindset, and thrives in a fast-moving startup environment.\n\nResponsibilities:\n- Own end-to-end feature development from design to production\n- Mentor mid-level engineers and drive code-review culture\n- Collaborate with product and design on technical feasibility\n- Improve CI/CD pipelines and observability tooling\n\nRequirements:\n- 5+ years in a SaaS or platform engineering role\n- Strong TypeScript / Node.js and React experience\n- Production PostgreSQL and REST API design\n- Comfortable with cloud infrastructure (AWS or GCP)",
    );
    setHiringContext(
      "Our platform team is scaling from 8 to 14 engineers this year. We need someone who can own end-to-end features, mentor mid-level devs, and drive architectural decisions. The team ships weekly and values pragmatic engineering over over-engineering.",
    );
    setCompanyPriority("Ship reliable features fast while maintaining platform stability");
    setMustHave("TypeScript, React, Node.js, PostgreSQL, REST APIs");
    setNiceToHave("GraphQL, Kubernetes, Terraform, CI/CD, Observability");
  }

  function submit() {
    setError("");
    startTransition(async () => {
      try {
        const posting = await createJobPosting({
          title: title.trim(),
          job_description: jobDescription.trim(),
          hiring_context: hiringContext.trim(),
          company_priority: companyPriority.trim(),
          must_have_skills: splitCsv(mustHave),
          nice_to_have_skills: splitCsv(niceToHave),
        });
        router.replace(`/jobs/${posting.id}`);
      } catch (requestError) {
        setError(
          requestError instanceof Error ? requestError.message : "Failed creating posting.",
        );
      }
    });
  }

  return (
    <AppShell title="Create Hiring Run" subtitle="" noPageHeader>
      <div className="space-y-6">
        {/* ── Page heading ── */}
        <h1 className="font-heading text-[32px] font-extrabold tracking-tight text-slate-950">
          Create Hiring Run
        </h1>

        {/* ── Wizard stepper ── */}
        <div className="flex items-start justify-center gap-0 pb-2">
          {wizardSteps.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === 0;
            return (
              <div key={step.label} className="flex items-center">
                <div className="flex flex-col items-center gap-2">
                  <div
                    className={cn(
                      "grid h-10 w-10 place-items-center rounded-full transition-colors",
                      isActive
                        ? "bg-accent text-white shadow-sm shadow-accent/25"
                        : "border-2 border-slate-200 bg-white text-slate-400",
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </div>
                  <span
                    className={cn(
                      "whitespace-nowrap text-[13px] font-semibold",
                      isActive ? "text-accent" : "text-slate-400",
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                {index < wizardSteps.length - 1 && (
                  <div className="mx-5 mb-6 h-0 w-20 border-t-2 border-dashed border-slate-200" />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Main content: 3-column grid ── */}
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr_310px]">
          {/* ▸ Left: Job Information */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-accent">
                <Briefcase className="h-[18px] w-[18px]" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-slate-900">Job Information</h3>
                <p className="text-[12px] leading-5 text-slate-500">
                  Define the role and what success looks like.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-[13px] font-semibold text-slate-700">Job Title</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Senior SaaS Engineer"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/10"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-[13px] font-semibold text-slate-700">
                  Job Description <span className="text-red-400">*</span>
                </span>
                <textarea
                  rows={9}
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the full job description or role responsibilities, requirements, and qualifications."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] leading-6 text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/10"
                />
                <div className="text-right text-[11px] text-slate-400">
                  {jobDescription.length} / 4000
                </div>
              </label>
            </div>
          </div>

          {/* ▸ Middle: Hiring Context */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-accent">
                <MessageSquareText className="h-[18px] w-[18px]" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-slate-900">Hiring Context</h3>
                <p className="text-[12px] leading-5 text-slate-500">
                  Inform the agents, goals, deal breakers, and hiring bar for the teams.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="text-[13px] font-semibold text-slate-700">
                  Context & Additional Notes
                </span>
                <textarea
                  rows={5}
                  value={hiringContext}
                  onChange={(e) => setHiringContext(e.target.value)}
                  placeholder="Describe team structure, challenges, must-have skills, culture fit, anything that helps agents evaluate candidates more accurately."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] leading-6 text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/10"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-[13px] font-semibold text-slate-700">Company Priority</span>
                <input
                  value={companyPriority}
                  onChange={(e) => setCompanyPriority(e.target.value)}
                  placeholder="e.g. Ship fast, maintain quality"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/10"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-[13px] font-semibold text-slate-700">Must-Have Skills</span>
                <input
                  value={mustHave}
                  onChange={(e) => setMustHave(e.target.value)}
                  placeholder="e.g. Python, React (comma-separated)"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/10"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-[13px] font-semibold text-slate-700">
                  Nice-to-Have Skills
                </span>
                <input
                  value={niceToHave}
                  onChange={(e) => setNiceToHave(e.target.value)}
                  placeholder="e.g. GraphQL, Kubernetes (comma-separated)"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/10"
                />
              </label>
            </div>
          </div>

          {/* ▸ Right: Sidebar */}
          <div className="space-y-4">
            {/* What happens next? */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-slate-900">
                <Sparkles className="h-4 w-4 text-accent" />
                What happens next?
              </h3>
              <div className="space-y-3">
                {whatHappensNext.map((item, index) => (
                  <div key={item} className="flex items-start gap-3">
                    <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-bold text-white">
                      {index + 1}
                    </div>
                    <span className="text-[13px] leading-5 text-slate-600">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Load Demo Scenario */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h3 className="mb-1 text-[15px] font-semibold text-slate-900">
                Load Demo Scenario
              </h3>
              <p className="mb-4 text-[12px] leading-5 text-slate-500">
                Explore a simulated example to see the full pipeline in action.
              </p>
              <button
                type="button"
                onClick={loadDemo}
                className="w-full cursor-pointer rounded-xl border-2 border-accent px-4 py-2.5 text-[13px] font-semibold text-accent transition-colors duration-150 hover:bg-accent hover:text-white"
              >
                Load Demo Scenario
              </button>
            </div>
          </div>
        </div>

        {/* ── Error alert ── */}
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] leading-5 text-red-700">
            {error}
          </div>
        ) : null}

        {/* ── Bottom bar ── */}
        <div className="flex items-center justify-between border-t border-slate-200 pt-5">
          <button
            type="button"
            onClick={() => router.back()}
            className="cursor-pointer text-[14px] font-semibold text-slate-500 transition-colors duration-150 hover:text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !title.trim()}
            className="group inline-flex cursor-pointer items-center gap-2 rounded-xl bg-accent px-6 py-3 text-[14px] font-semibold text-white transition-colors duration-150 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Creating...
              </>
            ) : (
              <>
                Next: Add Candidates
                <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
