"use client";

import { AppShell } from "@/components/app-shell";
import { EmptyState, Panel, PrimaryButton, SecondaryButton } from "@/components/ui";
import { createDemoRun, createHiringRun, getReport, getShortlist, runHiringPipeline, parsePdf } from "@/lib/api";
import { demoRun } from "@/lib/demo-data";
import { saveRunLocal } from "@/lib/storage";
import { CandidateInput, CandidateRecord, TopCandidate } from "@/lib/types";
import { AlertCircle, Check, Loader2, Plus, Trash2, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type CandidateForm = {
  id: string;
  name: string;
  resume_text: string;
  profile_summary: string;
};

const blankCandidate = (): CandidateForm => ({
  id: Math.random().toString(36).substring(7),
  name: "",
  resume_text: "",
  profile_summary: "",
});

type UploadProgress = {
  id: string;
  name: string;
  size: number;
  status: "idle" | "uploading" | "parsing" | "completed" | "error";
  progress: number;
  error?: string;
};

export default function NewRunPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>("");
  const [uploadQueue, setUploadQueue] = useState<UploadProgress[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    
    const syntheticEvent = {
      target: {
        files: files
      }
    } as unknown as React.ChangeEvent<HTMLInputElement>;
    
    await handleFileSelect(syntheticEvent);
  }

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    
    // Add all to upload queue
    const newItems = fileList.map((file) => ({
      id: Math.random().toString(36).substring(7),
      name: file.name,
      size: file.size,
      status: "uploading" as const,
      progress: 10,
    }));

    setUploadQueue((current) => [...current, ...newItems]);

    // Define parsing task for a single file
    async function processFile(file: File, queueItemId: string) {
      // Step 1: Uploading progress simulation
      setUploadQueue((current) =>
        current.map((item) => (item.id === queueItemId ? { ...item, progress: 40, status: "uploading" } : item)),
      );

      try {
        // Step 2: Call parsePdf api
        setUploadQueue((current) =>
          current.map((item) => (item.id === queueItemId ? { ...item, progress: 70, status: "parsing" } : item)),
        );

        const parsed = await parsePdf(file);

        // Step 3: Populate candidate list
        setCandidates((current) => {
          // If the list only contains one empty candidate, overwrite it
          const firstIsEmpty =
            current.length === 1 &&
            !current[0].name.trim() &&
            !current[0].resume_text.trim() &&
            !current[0].profile_summary.trim();

          const newCandidate: CandidateForm = {
            id: Math.random().toString(36).substring(7),
            name: parsed.candidate_name,
            resume_text: parsed.resume_text,
            profile_summary: `Parsed from uploaded resume PDF: ${file.name}.`,
          };

          if (firstIsEmpty) {
            return [newCandidate];
          } else {
            return [...current, newCandidate];
          }
        });

        // Step 4: Mark complete in queue
        setUploadQueue((current) =>
          current.map((item) => (item.id === queueItemId ? { ...item, progress: 100, status: "completed" } : item)),
        );
      } catch (err) {
        // Step 5: Mark failed in queue
        const errMsg = err instanceof Error ? err.message : "Parsing failed";
        setUploadQueue((current) =>
          current.map((item) =>
            item.id === queueItemId ? { ...item, progress: 100, status: "error", error: errMsg } : item,
          ),
        );
      }
    }

    // Launch all processes in parallel!
    fileList.forEach((file, index) => {
      processFile(file, newItems[index].id);
    });
  }

  const [mode, setMode] = useState<"live" | "demo">("live");
  const [title, setTitle] = useState("Senior Sales Engineer");
  const [jobDescription, setJobDescription] = useState(demoRun.job_description);
  const [hiringContext, setHiringContext] = useState(demoRun.hiring_context);
  const [companyPriority, setCompanyPriority] = useState(demoRun.company_priority ?? "");
  const [mustHaveSkills, setMustHaveSkills] = useState(demoRun.must_have_skills.join(", "));
  const [niceToHaveSkills, setNiceToHaveSkills] = useState(demoRun.nice_to_have_skills.join(", "));
  const [candidates, setCandidates] = useState<CandidateForm[]>(
    demoRun.candidates.slice(0, 3).map((candidate) => ({
      id: Math.random().toString(36).substring(7),
      name: candidate.name,
      resume_text: candidate.resume_text,
      profile_summary:
        candidate.professional_links?.portfolio ??
        candidate.professional_links?.linkedin ??
        candidate.professional_links?.github ??
        "",
    })),
  );

  function updateCandidate(id: string, key: keyof CandidateForm, value: string) {
    setCandidates((current) => current.map((item) => (item.id === id ? { ...item, [key]: value } : item)));
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
        id: Math.random().toString(36).substring(7),
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
        saveRunLocal({
          ...created.run,
          status: "draft",
        });
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
              {/* Batch PDF Upload Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`rounded-[1.75rem] border-2 border-dashed p-6 text-center transition ${
                  isDragging
                    ? "border-accent bg-blue-50/50 scale-[0.99] border-solid"
                    : "border-slate-200 bg-slate-50/40 hover:border-accent hover:bg-slate-50"
                }`}
              >
                <div className="flex flex-col items-center justify-center">
                  <UploadCloud className="h-10 w-10 text-slate-400" />
                  <h3 className="mt-3 font-semibold text-slate-900">Batch Upload PDF Resumes</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Drag & drop multiple PDF resumes here, or{" "}
                    <label className="cursor-pointer font-semibold text-accent hover:underline">
                      browse files
                      <input
                        type="file"
                        multiple
                        accept=".pdf"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                    </label>
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">PDF formats up to 10MB each</p>
                </div>

                {/* Uploading Status list */}
                {uploadQueue.length > 0 && (
                  <div className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white p-3 text-left">
                    {uploadQueue.map((item) => (
                      <div key={item.id} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                        <div className="min-w-0 flex-1 pr-3">
                          <div className="flex items-center justify-between text-xs">
                            <span className="truncate font-medium text-slate-800">{item.name}</span>
                            <span className="text-[10px] font-semibold text-slate-400">
                              {(item.size / 1024).toFixed(0)} KB
                            </span>
                          </div>
                          {/* Progress bar */}
                          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full transition-all duration-300 ${
                                item.status === "error"
                                  ? "bg-red-500"
                                  : item.status === "completed"
                                  ? "bg-emerald-500"
                                  : "bg-accent animate-pulse"
                              }`}
                              style={{ width: `${item.progress}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {item.status === "completed" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                              <Check className="h-3.5 w-3.5" /> Parsed
                            </span>
                          ) : item.status === "error" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600" title={item.error}>
                              <AlertCircle className="h-3.5 w-3.5" /> Failed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-accent animate-pulse">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> {item.status === "uploading" ? "Uploading" : "Parsing"}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {candidates.map((candidate, index) => (
                <div key={candidate.id} className="rounded-[1.75rem] border border-slate-200 bg-slate-50/70 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="font-semibold text-slate-900">Candidate {index + 1}</div>
                    {candidates.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => setCandidates((current) => current.filter((item) => item.id !== candidate.id))}
                        className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-500 cursor-pointer hover:bg-slate-100"
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
                        onChange={(event) => updateCandidate(candidate.id, "name", event.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-accent"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-slate-700">Resume text</span>
                      <textarea
                        rows={5}
                        value={candidate.resume_text}
                        onChange={(event) => updateCandidate(candidate.id, "resume_text", event.target.value)}
                        className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-accent"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-slate-700">Professional profile summary</span>
                      <textarea
                        rows={3}
                        value={candidate.profile_summary}
                        onChange={(event) => updateCandidate(candidate.id, "profile_summary", event.target.value)}
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
