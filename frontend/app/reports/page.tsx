"use client";

import { AppShell } from "@/components/app-shell";
import { EmptyState, Panel, RecommendationBadge, ScoreRing } from "@/components/ui";
import { listReports } from "@/lib/api";
import { CandidateReportListItem } from "@/lib/types";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function ReportsIndexPage() {
  const [rows, setRows] = useState<CandidateReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await listReports();
        if (cancelled) return;
        setRows(data);
        setLoading(false);
      } catch (requestError) {
        if (cancelled) return;
        setError(requestError instanceof Error ? requestError.message : "Failed loading reports.");
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell title="Reports" subtitle="Completed candidate analysis reports ready for recruiter review and PDF export.">
      <Panel title="Completed Reports">
        {loading ? <div className="text-sm text-slate-500">Loading reports...</div> : null}
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        {!loading && !error && rows.length === 0 ? (
          <EmptyState title="No completed reports yet" body="Run full analysis on candidates to generate report artifacts." />
        ) : null}
        {!loading && !error && rows.length > 0 ? (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.candidate_id} className="grid gap-3 rounded-xl border border-slate-200 px-4 py-3 lg:grid-cols-[1.4fr_1fr_120px_150px_120px] lg:items-center">
                <div>
                  <div className="font-semibold text-slate-900">{row.candidate_name}</div>
                  <div className="text-xs text-slate-500">{row.job_posting_title}</div>
                </div>
                <div className="text-sm text-slate-500">{row.completed_at ? new Date(row.completed_at).toLocaleString() : "Completed"}</div>
                <div className="flex lg:justify-center">
                  <ScoreRing score={row.final_score ?? 0} />
                </div>
                <div>{row.recommendation ? <RecommendationBadge recommendation={row.recommendation} /> : null}</div>
                <div className="flex justify-start lg:justify-end">
                  <Link href={`/candidates/${row.candidate_id}/report`} className="rounded-lg border border-accent px-3 py-1.5 text-xs font-semibold text-accent">
                    View report
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </Panel>
    </AppShell>
  );
}
