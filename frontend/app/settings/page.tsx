"use client";

import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/ui";
import { getAgentModels, getAgentsStatus, getAgentSettings, updateAgentSettings } from "@/lib/api";
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

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [provider, setProvider] = useState("chutes");
  const [baseUrl, setBaseUrl] = useState("https://llm.chutes.ai/v1");
  const [model, setModel] = useState("Qwen/Qwen2.5-Coder-32B-Instruct-TEE");
  const [apiKey, setApiKey] = useState("");
  const [apiKeyLabel, setApiKeyLabel] = useState<string | null>(null);
  const [parallelAgents, setParallelAgents] = useState(1);
  const [retryAttempts, setRetryAttempts] = useState(0);
  const [retryDelaySeconds, setRetryDelaySeconds] = useState(30);
  const [models, setModels] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [agentsError, setAgentsError] = useState("");
  const [running, setRunning] = useState<RunningAgent[]>([]);
  const [queued, setQueued] = useState<RunningAgent[]>([]);
  const [activeAgents, setActiveAgents] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [settings, modelRows] = await Promise.all([getAgentSettings(), getAgentModels()]);
        if (cancelled) return;
        setProvider(settings.provider);
        setBaseUrl(settings.base_url);
        setModel(settings.model);
        setApiKeyLabel(settings.api_key_label || null);
        setParallelAgents(settings.parallel_agents_limit);
        setRetryAttempts(settings.retry_attempts);
        setRetryDelaySeconds(settings.retry_delay_seconds);
        setModels(modelRows.models || []);
      } catch (exc) {
        if (cancelled) return;
        setError(exc instanceof Error ? exc.message : "Failed to load settings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadAgents() {
      try {
        const status = await getAgentsStatus();
        if (cancelled) return;
        setRunning(status.running);
        setQueued(status.queued || []);
        setActiveAgents(status.active_agents);
        setAgentsError("");
      } catch (exc) {
        if (cancelled) return;
        setAgentsError(exc instanceof Error ? exc.message : "Failed to load active agents.");
      } finally {
        if (!cancelled) setAgentsLoading(false);
      }
    }
    void loadAgents();
    const handle = setInterval(() => {
      void loadAgents();
    }, 2500);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, []);

  async function onSave() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const saved = await updateAgentSettings({
        provider,
        base_url: baseUrl,
        model,
        api_key: apiKey.trim() || undefined,
        parallel_agents_limit: parallelAgents,
        retry_attempts: retryAttempts,
        retry_delay_seconds: retryDelaySeconds,
      });
      setApiKey("");
      setApiKeyLabel(saved.api_key_label || null);
      setMessage("Settings saved.");
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Settings" subtitle="Configure runtime behavior for your account and monitor live agent activity in one place.">
      <Panel title="Runtime Configuration" subtitle="These settings are account-scoped and apply to new queued analyses.">
        {loading ? <div className="text-sm text-slate-500">Loading...</div> : null}
        {error ? <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {message ? <div className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm">
            <div className="mb-1 font-semibold text-slate-700">Provider</div>
            <input
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 font-semibold text-slate-700">Base URL</div>
            <input
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm md:col-span-2">
            <div className="mb-1 font-semibold text-slate-700">Model</div>
            {models.length > 0 ? (
              <select
                value={model}
                onChange={(event) => setModel(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                {models.map((row) => (
                  <option key={row} value={row}>
                    {row}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={model}
                onChange={(event) => setModel(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            )}
          </label>
          <label className="text-sm md:col-span-2">
            <div className="mb-1 font-semibold text-slate-700">API key</div>
            <input
              type="password"
              value={apiKey}
              placeholder={apiKeyLabel ? `Current: ${apiKeyLabel}` : "Enter API key"}
              onChange={(event) => setApiKey(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 font-semibold text-slate-700">Parallel agents</div>
            <input
              type="number"
              min={1}
              max={10}
              value={parallelAgents}
              onChange={(event) => setParallelAgents(Number(event.target.value) || 1)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 font-semibold text-slate-700">Retry attempts</div>
            <input
              type="number"
              min={0}
              max={5}
              value={retryAttempts}
              onChange={(event) => setRetryAttempts(Number(event.target.value) || 0)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 font-semibold text-slate-700">Retry delay (seconds)</div>
            <input
              type="number"
              min={0}
              max={600}
              value={retryDelaySeconds}
              onChange={(event) => setRetryDelaySeconds(Number(event.target.value) || 0)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center justify-center rounded-xl bg-accent px-5 py-3 text-[14px] font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </Panel>

      <div id="agents" className="mt-6 scroll-mt-28">
        <Panel title="Live Agent Activity" subtitle="Current worker slots and queued candidates for this workspace.">
          {agentsLoading ? <div className="text-sm text-slate-500">Loading...</div> : null}
          {agentsError ? <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{agentsError}</div> : null}
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
      </div>
    </AppShell>
  );
}
