"use client";

import { AppShell } from "@/components/app-shell";
import { EmptyState, Panel } from "@/components/ui";
import { listJobPostings } from "@/lib/api";
import { JobPostingRecord } from "@/lib/types";
import { BriefcaseBusiness, CalendarClock, Filter, ShieldCheck, Sparkles, Target } from "lucide-react";
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

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await listJobPostings();
        if (cancelled) return;
        setRows(data.postings);
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
                      <Link
                        href={`/jobs/${row.id}`}
                        className="rounded-lg border border-accent px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-blue-50"
                      >
                        Open posting
                      </Link>
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
                      <div>Updated {formatDate(row.updated_at)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </Panel>
      </div>
    </AppShell>
  );
}
