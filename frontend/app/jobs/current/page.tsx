"use client";

import { AppShell } from "@/components/app-shell";
import { EmptyState, Panel } from "@/components/ui";
import { listJobPostings } from "@/lib/api";
import { JobPostingRecord } from "@/lib/types";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

  return (
    <AppShell title="Current Job Postings" subtitle="Active roles with concise context, rubric signal, and quick access to applicant pipelines.">
      <Panel title="Active Roles" subtitle="Focused view for open positions and hiring context.">
        <div className="mb-4">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by title, status, priority, or description..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700 outline-none focus:border-accent focus:bg-white"
          />
        </div>
        {loading ? <div className="text-sm text-slate-500">Loading postings...</div> : null}
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        {!loading && !error && filtered.length === 0 ? (
          <EmptyState title="No postings found" body="Create a new posting to start receiving candidates." />
        ) : null}
        {!loading && !error && filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map((row) => (
              <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{row.title}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Status: <span className="font-semibold text-slate-700">{row.status}</span>
                    </div>
                  </div>
                  <Link href={`/jobs/${row.id}`} className="rounded-lg border border-accent px-3 py-1.5 text-xs font-semibold text-accent">
                    Open posting
                  </Link>
                </div>
                <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-600">{row.job_description}</p>
                <div className="mt-2 text-xs text-slate-500">{row.company_priority || "No company priority configured."}</div>
              </div>
            ))}
          </div>
        ) : null}
      </Panel>
    </AppShell>
  );
}
