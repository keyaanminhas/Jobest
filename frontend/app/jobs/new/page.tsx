"use client";

import { AppShell } from "@/components/app-shell";
import { createJobPosting } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function NewJobPostingPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [title, setTitle] = useState("AI Software Engineer");
  const [jobDescription, setJobDescription] = useState("");
  const [hiringContext, setHiringContext] = useState("");
  const [companyPriority, setCompanyPriority] = useState("");
  const [mustHave, setMustHave] = useState("Python, FastAPI, LLM Integration, API Design, Software Engineering");
  const [niceToHave, setNiceToHave] = useState("Vector Databases, Prompt Engineering, Agent Orchestration, CI/CD, Cloud Deployment");

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
        setError(requestError instanceof Error ? requestError.message : "Failed creating posting.");
      }
    });
  }

  return (
    <AppShell
      title="Create Job Posting"
      subtitle="Define role context and skills rubric. CV uploads and triage happen on the posting detail page."
    >
      <div className="grid gap-4">
        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">Title</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-accent" />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">Job description</span>
          <textarea rows={7} value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-accent" />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">Hiring context</span>
          <textarea rows={5} value={hiringContext} onChange={(event) => setHiringContext(event.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-accent" />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">Company priority</span>
          <input value={companyPriority} onChange={(event) => setCompanyPriority(event.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-accent" />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">Must-have skills (comma-separated)</span>
          <input value={mustHave} onChange={(event) => setMustHave(event.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-accent" />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">Nice-to-have skills (comma-separated)</span>
          <input value={niceToHave} onChange={(event) => setNiceToHave(event.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-accent" />
        </label>
        {error ? <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        <button type="button" onClick={submit} disabled={pending} className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {pending ? "Creating..." : "Create posting"}
        </button>
      </div>
    </AppShell>
  );
}
