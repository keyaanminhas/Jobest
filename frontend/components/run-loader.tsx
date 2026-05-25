"use client";

import { AlertTriangle, ArrowLeft, Download, PlayCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createDemoRun, resolveRun } from "@/lib/api";
import { demoRunId } from "@/lib/demo-data";
import { HiringRunRecord } from "@/lib/types";
import { Panel, PrimaryButton } from "@/components/ui";

export function RunLoader({
  runId,
  children,
}: {
  runId: string;
  children: (data: { run: HiringRunRecord; offline: boolean }) => React.ReactNode;
}) {
  const [state, setState] = useState<{
    loading: boolean;
    run?: HiringRunRecord;
    offline?: boolean;
    error?: string;
  }>({ loading: true });

  useEffect(() => {
    let cancelled = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    async function load(poll = false) {
      try {
        const result = await resolveRun(runId);
        if (!cancelled) {
          setState({ loading: false, run: result.run, offline: result.offline });
          const status = result.run.results?.status ?? result.run.status;
          if (poll && (status === "processing" || status === "draft")) {
            timeoutHandle = setTimeout(() => {
              void load(true);
            }, 2000);
          }
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            loading: false,
            error: error instanceof Error ? error.message : "Unable to load run.",
          });
        }
      }
    }

    void load(true);
    return () => {
      cancelled = true;
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    };
  }, [runId]);

  if (state.loading) {
    return (
      <Panel>
        <div className="space-y-3">
          <div className="h-6 w-48 animate-pulse rounded-full bg-slate-200" />
          <div className="h-24 animate-pulse rounded-3xl bg-slate-100" />
          <div className="h-24 animate-pulse rounded-3xl bg-slate-100" />
        </div>
      </Panel>
    );
  }

  if (state.error || !state.run) {
    return (
      <Panel className="border-amber-200 bg-amber-50/40">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-xl font-bold text-slate-950">Backend or local run unavailable</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              {state.error ??
                "The requested hiring run could not be loaded. You can still use the polished demo flow while the SSH tunnel or backend is offline."}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={async () => {
                  const run = await createDemoRun();
                  window.location.href = `/runs/${run.id}/pipeline`;
                }}
                className="inline-flex items-center gap-2 rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white"
              >
                <PlayCircle className="h-4 w-4" />
                Load Demo Scenario
              </button>
              <Link
                href={`/runs/${demoRunId}/shortlist`}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
              >
                <Download className="h-4 w-4" />
                Open Demo Shortlist
              </Link>
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to dashboard
              </Link>
            </div>
          </div>
        </div>
      </Panel>
    );
  }

  return <>{children({ run: state.run, offline: Boolean(state.offline) })}</>;
}
