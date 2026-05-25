"use client";

import { AppShell } from "@/components/app-shell";
import { Panel, RecommendationBadge, ScoreRing } from "@/components/ui";
import { getJobPosting, listCandidates, uploadCandidates } from "@/lib/api";
import { CandidateListItem, JobPostingRecord } from "@/lib/types";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export default function JobPostingDetailPage() {
  const params = useParams<{ id: string }>();
  const jobId = params.id;
  const [pending, startTransition] = useTransition();
  const [posting, setPosting] = useState<JobPostingRecord | null>(null);
  const [candidates, setCandidates] = useState<CandidateListItem[]>([]);
  const [error, setError] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [additionalUrls, setAdditionalUrls] = useState("");

  async function loadRows() {
    const [job, rows] = await Promise.all([getJobPosting(jobId), listCandidates(jobId)]);
    setPosting(job);
    setCandidates(rows);
  }

  useEffect(() => {
    let cancelled = false;
    let pollHandle: ReturnType<typeof setTimeout> | null = null;

    async function load() {
      try {
        const [job, rows] = await Promise.all([getJobPosting(jobId), listCandidates(jobId)]);
        if (cancelled) return;
        setPosting(job);
        setCandidates(rows);
        if (rows.some((item) => item.analysis_status === "queued" || item.analysis_status === "processing")) {
          pollHandle = setTimeout(() => {
            void load();
          }, 2500);
        }
      } catch (requestError) {
        if (cancelled) return;
        setError(requestError instanceof Error ? requestError.message : "Failed loading posting.");
      }
    }
    void load();
    return () => {
      cancelled = true;
      if (pollHandle) clearTimeout(pollHandle);
    };
  }, [jobId]);

  function upload() {
    if (selectedFiles.length === 0) {
      setError("Please select one or more PDF files.");
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        await uploadCandidates(jobId, selectedFiles, additionalUrls);
        await loadRows();
        setSelectedFiles([]);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Upload failed.");
      }
    });
  }

  return (
    <AppShell
      title={posting?.title ?? "Job posting"}
      subtitle={posting?.hiring_context ?? "Loading job posting..."}
      actions={<Link href="/jobs/new" className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white">New posting</Link>}
    >
      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Panel title="Upload CVs" subtitle="Resume extraction and triage ranking run on upload. Full analysis runs only when you trigger it per candidate.">
          <div className="space-y-4">
            <input
              type="file"
              multiple
              accept="application/pdf,.pdf"
              onChange={(event) => setSelectedFiles(Array.from(event.target.files ?? []))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <textarea
              rows={4}
              value={additionalUrls}
              onChange={(event) => setAdditionalUrls(event.target.value)}
              placeholder={"Optional professional URLs\nhttps://github.com/user"}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-accent"
            />
            {error ? <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
            <button type="button" disabled={pending} onClick={upload} className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
              {pending ? "Uploading..." : "Upload and rank"}
            </button>
          </div>
        </Panel>

        <Panel title="Skills Rubric">
          <div className="space-y-3 text-sm text-slate-700">
            <div>
              <div className="mb-2 font-semibold text-slate-900">Must-have</div>
              <div className="flex flex-wrap gap-2">
                {posting?.must_have_skills.map((skill) => (
                  <span key={skill} className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-semibold text-accent">{skill}</span>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 font-semibold text-slate-900">Nice-to-have</div>
              <div className="flex flex-wrap gap-2">
                {posting?.nice_to_have_skills.map((skill) => (
                  <span key={skill} className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{skill}</span>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Candidates ranked by current score" subtitle="Candidates auto-rerank from triage score (0-80) to final analysis score (0-100) as runs complete.">
        <div className="space-y-3">
          {candidates.map((candidate, index) => (
            <div key={candidate.id} className="grid gap-3 rounded-xl border border-slate-200 px-4 py-3 lg:grid-cols-[56px_1.2fr_1fr_130px_140px_170px] lg:items-center">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 font-semibold text-slate-700">{index + 1}</div>
              <div>
                <div className="font-semibold text-slate-900">{candidate.display_name}</div>
                <div className="text-xs text-slate-500">{candidate.analysis_status}</div>
              </div>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{candidate.current_score_type} score {candidate.current_score_type === "triage" ? "/ 80" : "/ 100"}</div>
              <div className="flex lg:justify-center">
                <ScoreRing score={candidate.current_score_type === "triage" ? (candidate.current_score / 80) * 100 : candidate.current_score} />
              </div>
              <div>{candidate.recommendation ? <RecommendationBadge recommendation={candidate.recommendation} /> : <span className="text-xs text-slate-500">Pending</span>}</div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/candidates/${candidate.id}`} className="rounded-lg border border-accent px-3 py-1.5 text-xs font-semibold text-accent">
                  Open candidate
                </Link>
                {candidate.report_ready ? (
                  <Link href={`/candidates/${candidate.id}/report`} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white">
                    View report
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
          {candidates.length === 0 ? <div className="text-sm text-slate-500">No candidates uploaded yet.</div> : null}
        </div>
      </Panel>
    </AppShell>
  );
}
