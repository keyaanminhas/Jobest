"use client";

import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/ui";
import { getAgentsStatus } from "@/lib/api";
import { RunningAgent } from "@/lib/types";
import { useEffect, useState } from "react";

function AgentCard({ item }: { item: RunningAgent }) {
  const width = Math.max(0, Math.min(100, item.progress_percent || 0));
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-900">{item.candidate_name}</div>
        <div className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-accent">
          Agent {item.worker_slot_index ?? "-"}
        </div>
      </div>
      <div className="mt-1 text-xs text-slate-500">{item.job_posting_title || "Unknown posting"}</div>
      <div className="mt-2 text-xs text-slate-600">{item.current_stage || "Processing"}</div>
      <div className="mt-1 text-xs text-slate-500">{item.stage_summary || "Running pipeline stage..."}</div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${width}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
        <span>{width.toFixed(0)}%</span>
        <span>{item.provider_used || "provider"} / {item.model_used || "model"}</span>
      </div>
      <div className="mt-1 text-[11px] text-slate-500">
        Attempt {item.attempt_count}/{Math.max(item.max_attempts, 0) + 1}
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [running, setRunning] = useState<RunningAgent[]>([]);
  const [queued, setQueued] = useState<RunningAgent[]>([]);
  const [activeAgents, setActiveAgents] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const status = await getAgentsStatus();
        if (cancelled) return;
        setRunning(status.running);
        setQueued(status.queued || []);
        setActiveAgents(status.active_agents);
        setError("");
      } catch (exc) {
        if (cancelled) return;
        setError(exc instanceof Error ? exc.message : "Failed to load active agents.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    const handle = setInterval(() => {
      void load();
    }, 2500);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, []);

  return (
    <AppShell title="Active Agents" subtitle="Live status of currently running parallel agents only.">
      <Panel title="Current Workers" subtitle="Each card represents one active worker slot and its candidate stage progress.">
        {loading ? <div className="text-sm text-slate-500">Loading...</div> : null}
        {error ? <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <div className="mb-3 text-sm font-semibold text-slate-700">Active agents: {activeAgents}</div>
        {running.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            No agents are currently running.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {running.map((item) => (
              <AgentCard key={item.analysis_run_id} item={item} />
            ))}
          </div>
        )}
        <div className="mt-6 border-t border-slate-200 pt-4">
          <div className="mb-2 text-sm font-semibold text-slate-700">Queued Candidates: {queued.length}</div>
          {queued.length === 0 ? (
            <div className="text-sm text-slate-500">No queued candidates.</div>
          ) : (
            <div className="space-y-2">
              {queued.map((item) => (
                <div key={item.analysis_run_id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <div className="font-semibold text-slate-900">{item.candidate_name}</div>
                  <div className="text-xs text-slate-500">{item.job_posting_title || "Unknown posting"}</div>
                  <div className="text-xs text-slate-500">Status: {item.status}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Panel>
    </AppShell>
  );
}
