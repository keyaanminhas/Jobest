"use client";

import { AppShell } from "@/components/app-shell";
import { EmptyState, Panel } from "@/components/ui";
import { QrCode } from "@/components/qr-code";
import { listAllCandidates, listJobPostings, updateJobPosting } from "@/lib/api";
import { CandidateListItem, JobPostingRecord } from "@/lib/types";
import { BriefcaseBusiness, CalendarClock, Copy, Filter, QrCode as QrCodeIcon, ShieldCheck, Sparkles, Target } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function isOpenStatus(status: string) {
  const normalized = status.trim().toLowerCase();
  return !["closed", "archived", "filled", "inactive"].includes(normalized);
}

export default function CurrentPostingsPage() {
  const [rows, setRows] = useState<JobPostingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [allCandidates, setAllCandidates] = useState<CandidateListItem[]>([]);
  const [sharePosting, setSharePosting] = useState<JobPostingRecord | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [data, candidates] = await Promise.all([listJobPostings(), listAllCandidates()]);
        if (cancelled) return;
        setRows(data.postings);
        setAllCandidates(candidates);
      } catch (requestError) {
        if (cancelled) return;
        setError(requestError instanceof Error ? requestError.message : "Failed loading job postings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => [row.title, row.status, row.company_priority || "", row.job_description].join(" ").toLowerCase().includes(q));
  }, [query, rows]);

  const metrics = useMemo(() => {
    const openRoles = rows.filter((row) => isOpenStatus(row.status)).length;
    const withPriority = rows.filter((row) => (row.company_priority || "").trim().length > 0).length;
    const avgMustHave =
      rows.length === 0
        ? 0
        : rows.reduce((sum, row) => sum + row.must_have_skills.length, 0) / rows.length;
    return {
      total: rows.length,
      openRoles,
      withPriority,
      avgMustHave,
      filtered: filtered.length,
    };
  }, [filtered.length, rows]);

  const memberCountByPosting = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of allCandidates) {
      counts[item.job_posting_id] = (counts[item.job_posting_id] || 0) + 1;
    }
    return counts;
  }, [allCandidates]);

  const shareUrl = sharePosting?.public_application_url || "";
  const shareToken = shareUrl ? shareUrl.split("/").filter(Boolean).pop() || "" : "";

  async function copyPublicUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Failed to copy public application link.");
    }
  }

  function setShareState(nextPosting: JobPostingRecord) {
    setRows((current) => current.map((row) => (row.id === nextPosting.id ? nextPosting : row)));
    setSharePosting(nextPosting);
  }

  function toggleSharing(posting: JobPostingRecord, enabled: boolean) {
    setError("");
    void (async () => {
      try {
        const updated = await updateJobPosting(posting.id, { public_applications_enabled: enabled });
        setShareState(updated);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Failed updating public application access.");
      }
    })();
  }

  return (
    <AppShell
      title="Current Job Postings"
      subtitle="Data-dense role control center for active pipelines, hiring context quality, and fast routing into candidate workflows."
      actions={
        <Link
          href="/jobs/new"
          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          Create Posting
        </Link>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Total Roles</div>
            <div className="mt-2 flex items-center gap-2 text-2xl font-extrabold text-slate-950">
              <BriefcaseBusiness className="h-5 w-5 text-accent" />
              {metrics.total}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Open Roles</div>
            <div className="mt-2 flex items-center gap-2 text-2xl font-extrabold text-emerald-700">
              <ShieldCheck className="h-5 w-5" />
              {metrics.openRoles}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Priority Set</div>
            <div className="mt-2 flex items-center gap-2 text-2xl font-extrabold text-slate-950">
              <Target className="h-5 w-5 text-amber-500" />
              {metrics.withPriority}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Avg Must-Have</div>
            <div className="mt-2 flex items-center gap-2 text-2xl font-extrabold text-slate-950">
              <Sparkles className="h-5 w-5 text-accent" />
              {metrics.avgMustHave.toFixed(1)}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-50 via-white to-slate-50 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Visible (Filter)</div>
            <div className="mt-2 flex items-center gap-2 text-2xl font-extrabold text-slate-950">
              <Filter className="h-5 w-5 text-accent" />
              {metrics.filtered}
            </div>
          </div>
        </div>

        <Panel title="Role Explorer" subtitle="Search postings by title, context, status, and hiring priority.">
          <div className="mb-5">
            <label className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Quick Filter
            </label>
            <div className="flex gap-2">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Type title, status, priority, or role context..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-accent focus:bg-white"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          <input
            type="hidden"
            value={query}
            readOnly
          />

          {loading ? <div className="text-sm text-slate-500">Loading postings...</div> : null}
          {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
          {!loading && !error && filtered.length === 0 ? (
            <EmptyState title="No postings found" body="Create a new posting to start receiving candidates." />
          ) : null}
          {!loading && !error && filtered.length > 0 ? (
            <div className="space-y-3">
              {filtered.map((row) => {
                const open = isOpenStatus(row.status);
                return (
                  <div key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-bold text-slate-900">{row.title}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                          <span
                            className={`rounded-full px-2 py-1 font-semibold ${
                              open ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {row.status}
                          </span>
                          <span className="rounded-full bg-blue-50 px-2 py-1 font-semibold text-accent">
                            Must-have {row.must_have_skills.length}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                            Nice-to-have {row.nice_to_have_skills.length}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (!row.public_application_url) {
                              setError("Public application link is not ready for this posting yet. Refresh and try again.");
                              return;
                            }
                            setSharePosting(row);
                          }}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                          title="Share public application link"
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <QrCodeIcon className="h-3.5 w-3.5 text-accent" />
                            Share
                          </span>
                        </button>
                        <Link
                          href={`/jobs/${row.id}`}
                          className="rounded-lg border border-accent px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-blue-50"
                        >
                          Open posting
                        </Link>
                      </div>
                    </div>

                    <p className="line-clamp-3 text-sm leading-6 text-slate-600">{row.job_description}</p>

                    <div className="mt-3 grid gap-2 lg:grid-cols-[1.2fr_1fr]">
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Hiring Priority
                        </div>
                        <div className="text-sm text-slate-700">
                          {row.company_priority || "No company priority configured."}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          Must-have Focus
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {row.must_have_skills.slice(0, 4).map((skill) => (
                            <span key={skill} className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-slate-700">
                              {skill}
                            </span>
                          ))}
                          {row.must_have_skills.length > 4 ? (
                            <span className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-slate-500">
                              +{row.must_have_skills.length - 4} more
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
                      <div className="inline-flex items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5" />
                        Created {formatDate(row.created_at)}
                      </div>
                      <div className="flex items-center gap-3">
                        <span>Updated {formatDate(row.updated_at)}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                          Members {memberCountByPosting[row.id] || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </Panel>
      </div>

      {sharePosting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Public application QR</div>
                <div className="mt-1 text-xl font-extrabold text-slate-950">{sharePosting.title}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSharePosting(null);
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
                {sharePosting.public_applications_enabled ? "Applications are currently open." : "Applications are closed for this link."}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => void copyPublicUrl(shareUrl)}
                  disabled={!shareUrl}
                  className="inline-flex min-w-[132px] items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
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
                  onClick={() => toggleSharing(sharePosting, !sharePosting.public_applications_enabled)}
                  className={`inline-flex min-w-[152px] items-center justify-center whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${
                    sharePosting.public_applications_enabled
                      ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                      : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  }`}
                >
                  {sharePosting.public_applications_enabled ? "Stop sharing" : "Resume sharing"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
