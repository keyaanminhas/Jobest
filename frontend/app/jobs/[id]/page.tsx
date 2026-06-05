"use client";

import { AppShell } from "@/components/app-shell";
import { QrCode } from "@/components/qr-code";
import { Panel, RecommendationBadge, ScoreRing, TriageBandBadge } from "@/components/ui";
import { deleteCandidate, getJobPosting, listCandidates, updateJobPosting, uploadCandidates } from "@/lib/api";
import { CandidateListItem, JobPostingRecord } from "@/lib/types";
import { Copy, QrCode as QrCodeIcon, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { DragEvent, useMemo, useRef, useState, useTransition, useEffect } from "react";

function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export default function JobPostingDetailPage() {
  const params = useParams<{ id: string }>();
  const jobId = params.id;
  const [pending, startTransition] = useTransition();
  const [posting, setPosting] = useState<JobPostingRecord | null>(null);
  const [candidates, setCandidates] = useState<CandidateListItem[]>([]);
  const [error, setError] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [additionalUrls, setAdditionalUrls] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const shareUrl = posting?.public_application_url || "";
  const shareToken = useMemo(() => (shareUrl ? shareUrl.split("/").filter(Boolean).pop() || "" : ""), [shareUrl]);

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

  function removeCandidate(candidateId: string) {
    setError("");
    startTransition(async () => {
      try {
        await deleteCandidate(jobId, candidateId);
        await loadRows();
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Failed deleting candidate.");
      }
    });
  }

  function addFiles(files: File[]) {
    const pdfFiles = files.filter(isPdfFile);
    if (pdfFiles.length !== files.length) {
      setError("Only PDF files can be uploaded.");
    } else {
      setError("");
    }
    if (pdfFiles.length === 0) {
      return;
    }
    setSelectedFiles((current) => {
      const next = [...current];
      for (const file of pdfFiles) {
        if (!next.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) {
          next.push(file);
        }
      }
      return next;
    });
  }

  function onDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragActive(false);
    addFiles(Array.from(event.dataTransfer.files || []));
  }

  async function copyTextToClipboard(text: string) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      const successful = document.execCommand("copy");
      if (!successful) throw new Error("Fallback copy failed");
    } finally {
      document.body.removeChild(textArea);
    }
  }

  async function copyPublicUrl() {
    if (!shareUrl) {
      setError("Public application link is not ready for this posting yet.");
      return;
    }
    try {
      await copyTextToClipboard(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Failed to copy public application link.");
    }
  }

  function toggleSharing(enabled: boolean) {
    if (!posting) return;
    setError("");
    startTransition(async () => {
      try {
        const updated = await updateJobPosting(posting.id, { public_applications_enabled: enabled });
        setPosting(updated);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Failed updating public application access.");
      }
    });
  }

  return (
    <AppShell
      title={posting?.title ?? "Job posting"}
      subtitle={posting?.hiring_context ?? "Loading job posting..."}
      actions={
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (!shareUrl) {
                setError("Public application link is not ready for this posting yet. Refresh and try again.");
                return;
              }
              setShareOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <QrCodeIcon className="h-4 w-4 text-accent" />
            Share
          </button>
          <Link href="/jobs/new" className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white">New posting</Link>
        </div>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Panel title="Upload CVs" subtitle="Resume extraction and triage ranking run on upload. Full analysis runs only when you trigger it per candidate.">
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setDragActive(false);
              }}
              onDrop={onDrop}
              className={`w-full rounded-[1.5rem] border border-dashed px-5 py-8 text-left transition ${
                dragActive ? "border-accent bg-blue-50" : "border-slate-300 bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_55%,#f4f7fb_100%)] hover:border-accent/60 hover:bg-blue-50/60"
              }`}
            >
              <div className="flex flex-col items-center justify-center text-center">
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white shadow-sm">
                  <UploadCloud className="h-6 w-6 text-accent" />
                </div>
                <div className="mt-4 text-base font-semibold text-slate-900">Drag and drop CV PDFs here</div>
                <div className="mt-1 text-sm text-slate-500">or click to browse multiple PDF files</div>
                <div className="mt-4 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                  PDF only • triage runs on upload
                </div>
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="application/pdf,.pdf"
              onChange={(event) => addFiles(Array.from(event.target.files ?? []))}
              className="hidden"
            />
            {selectedFiles.length > 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Selected files</div>
                <div className="space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm">
                      <div className="min-w-0 truncate font-medium text-slate-700">{file.name}</div>
                      <button
                        type="button"
                        onClick={() => setSelectedFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                        className="text-xs font-semibold text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
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
            <div key={candidate.id} className="grid gap-3 rounded-xl border border-slate-200 px-4 py-3 lg:grid-cols-[56px_1.3fr_1fr_130px_150px_240px] lg:items-center">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 font-semibold text-slate-700">{index + 1}</div>
              <div>
                <div className="font-semibold text-slate-900">{candidate.display_name}</div>
                <div className="text-xs text-slate-500">{candidate.analysis_status}</div>
              </div>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                {candidate.current_score_type === "triage" ? "triage band" : "final score / 100"}
              </div>
              <div className="flex lg:justify-center">
                {candidate.current_score_type === "triage" ? (
                  <TriageBandBadge score={candidate.current_score} />
                ) : (
                  <ScoreRing score={candidate.current_score} />
                )}
              </div>
              <div>{candidate.recommendation ? <RecommendationBadge recommendation={candidate.recommendation} /> : <span className="text-xs text-slate-500">Pending</span>}</div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Link
                  href={`/candidates?jobId=${candidate.job_posting_id}&job=${encodeURIComponent(candidate.job_posting_title)}`}
                  className="inline-flex min-w-[110px] items-center justify-center rounded-lg border border-accent px-3 py-2 text-xs font-semibold text-accent transition-colors hover:bg-blue-50"
                >
                  Open
                </Link>
                <button
                  type="button"
                  onClick={() => removeCandidate(candidate.id)}
                  disabled={pending}
                  className="inline-flex min-w-[110px] items-center justify-center rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {candidates.length === 0 ? <div className="text-sm text-slate-500">No candidates uploaded yet.</div> : null}
        </div>
      </Panel>

      {shareOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Public application QR</div>
                <div className="mt-1 text-xl font-extrabold text-slate-950">{posting?.title}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShareOpen(false);
                  setCopied(false);
                }}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mt-5 flex justify-center">
              <QrCode value={shareUrl} size={220} />
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Public link</div>
              <div className="mt-2 break-all text-sm text-slate-700">{shareUrl || "Link unavailable."}</div>
              <div className="mt-2 text-xs font-medium text-slate-500">
                {posting?.public_applications_enabled ? "Applications are currently open." : "Applications are closed for this link."}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => void copyPublicUrl()}
                  disabled={!shareUrl}
                  className="inline-flex min-w-[132px] items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Copy className="h-4 w-4 text-accent" />
                  {copied ? "Copied" : "Copy link"}
                </button>
                {shareToken ? (
                  <Link
                    href={`/apply/${shareToken}/print`}
                    target="_blank"
                    className="inline-flex min-w-[168px] items-center justify-center whitespace-nowrap rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Print / Save as PDF
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="inline-flex min-w-[168px] items-center justify-center whitespace-nowrap rounded-xl bg-slate-300 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Print / Save as PDF
                  </button>
                )}
                <button
                  type="button"
                  disabled={pending || !posting}
                  onClick={() => toggleSharing(!(posting?.public_applications_enabled ?? true))}
                  className={`inline-flex min-w-[152px] items-center justify-center whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
                    posting?.public_applications_enabled
                      ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                      : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  }`}
                >
                  {posting?.public_applications_enabled ? "Stop sharing" : "Resume sharing"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
