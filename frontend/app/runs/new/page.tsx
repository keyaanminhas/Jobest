"use client";

import { AppShell } from "@/components/app-shell";
import { Panel, PrimaryButton, SecondaryButton } from "@/components/ui";
import { createDemoRun, uploadSingleCvRun } from "@/lib/api";
import { demoRun } from "@/lib/demo-data";
import { saveRunLocal } from "@/lib/storage";
import { FileText, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

const preset = {
  title: "AI Software Engineer",
  jobDescription:
    "Design, build, and ship AI-powered product features using Python and modern backend frameworks. Own end-to-end implementation across LLM integration, agent orchestration, evaluation, observability, and production API delivery for customer-facing workflows.",
  hiringContext:
    "Fast-moving product team building AI-native workflows for hiring and talent operations. Need engineers who can ship pragmatic LLM systems, balance reliability with speed, and collaborate closely with product and design under tight hackathon-like timelines.",
  mustHaveSkills: ["Python", "FastAPI", "LLM Integration", "API Design", "Software Engineering"],
  niceToHaveSkills: ["Vector Databases", "Prompt Engineering", "Agent Orchestration", "CI/CD", "Cloud Deployment"],
};

export default function NewRunPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [candidateNameOverride, setCandidateNameOverride] = useState("");
  const [additionalUrls, setAdditionalUrls] = useState("");

  const fileSummary = useMemo(() => {
    if (!selectedFile) {
      return "No file selected";
    }
    const sizeMb = (selectedFile.size / (1024 * 1024)).toFixed(2);
    return `${selectedFile.name} (${sizeMb} MB)`;
  }, [selectedFile]);

  function runSingleCv() {
    setError("");

    if (!selectedFile) {
      setError("Please upload a CV PDF file.");
      return;
    }
    if (!selectedFile.name.toLowerCase().endsWith(".pdf")) {
      setError("Only PDF files are supported for the first run.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await uploadSingleCvRun(selectedFile, candidateNameOverride, additionalUrls);
        saveRunLocal(response.run);
        router.push(`/runs/${response.run_id}/pipeline`);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Backend upload failed. Check tunnel/backend health or use demo mode.",
        );
      }
    });
  }

  return (
    <AppShell
      title="First CV Analysis Run"
      subtitle="Upload one PDF CV to run the full Jobest multi-agent pipeline against the seeded role preset."
      actions={
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={async () => {
              const run = await createDemoRun();
              router.push(`/runs/${run.id}/pipeline`);
            }}
            className="rounded-2xl border border-accent bg-white px-5 py-3 text-sm font-semibold text-accent"
          >
            Load Demo Scenario
          </button>
          <PrimaryButton href={`/runs/${demoRun.id}/pipeline`}>Open Existing Demo</PrimaryButton>
        </div>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
        <Panel title="Seeded Role Preset" subtitle="This first-run path is locked to one stable role/context for reliable live testing.">
          <div className="space-y-5">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Role</div>
              <h2 className="mt-2 font-heading text-3xl font-extrabold text-slate-950">{preset.title}</h2>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Job Description</div>
                <p className="mt-2 text-sm leading-7 text-slate-700">{preset.jobDescription}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Hiring Context</div>
                <p className="mt-2 text-sm leading-7 text-slate-700">{preset.hiringContext}</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Must-have Skills</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {preset.mustHaveSkills.map((skill) => (
                    <span key={skill} className="rounded-xl bg-blue-50 px-3 py-1 text-[12px] font-semibold text-accent">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Nice-to-have Skills</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {preset.niceToHaveSkills.map((skill) => (
                    <span key={skill} className="rounded-xl bg-slate-100 px-3 py-1 text-[12px] font-semibold text-slate-700">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Upload Candidate CV" subtitle="PDF only. Jobest extracts resume text and runs the full 11-stage pipeline.">
            <div className="space-y-4">
              <label className="block rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                />
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-accent shadow-sm">
                  <Upload className="h-5 w-5" />
                </div>
                <div className="mt-3 text-sm font-semibold text-slate-900">Select CV PDF</div>
                <div className="mt-2 text-xs text-slate-500">{fileSummary}</div>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Candidate name override (optional)</span>
                <input
                  value={candidateNameOverride}
                  onChange={(event) => setCandidateNameOverride(event.target.value)}
                  placeholder="Leave blank to auto-detect from CV"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Additional professional URLs (optional)</span>
                <textarea
                  rows={4}
                  value={additionalUrls}
                  onChange={(event) => setAdditionalUrls(event.target.value)}
                  placeholder={"One per line (GitHub, portfolio, LinkedIn, Kaggle, Scholar)\nhttps://github.com/username"}
                  className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-accent"
                />
              </label>

              <button
                type="button"
                onClick={runSingleCv}
                disabled={pending}
                className="w-full rounded-2xl bg-accent px-5 py-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {pending ? "Submitting CV..." : "Start Async CV Analysis"}
              </button>

              <p className="text-xs leading-6 text-slate-500">
                Submission returns immediately. You will be redirected to live pipeline progress while agents keep running in the background.
              </p>

              {error ? <div className="rounded-3xl bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
            </div>
          </Panel>

          <Panel title="Pipeline Output">
            <div className="space-y-3 text-sm text-slate-700">
              {[
                "JD Deconstruction Agent",
                "Hiring Context Agent",
                "Resume Parsing Agent",
                "Candidate Evidence Agent",
                "Transferable Skill Agent",
                "Professional Footprint Agent",
                "Risk & Contradiction Agent",
                "Score Aggregation Engine",
                "Hiring Panel Review Agent",
                "Interview Pack Generator Agent",
                "Final Shortlist Report Agent",
              ].map((stage) => (
                <div key={stage} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                  <FileText className="h-4 w-4 text-accent" />
                  <span>{stage}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Tunnel Target">
            <p className="text-sm leading-7 text-slate-600">
              This flow expects your backend at <code>http://localhost:8000</code> through SSH tunnel or local FastAPI.
              If unavailable, use demo mode to continue UX testing.
            </p>
            <div className="mt-4">
              <SecondaryButton href="/runs/new">Retry Upload Flow</SecondaryButton>
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
