"use client";

import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/ui";
import { getAgentModels, getAgentSettings, updateAgentSettings } from "@/lib/api";
import { useEffect, useState } from "react";

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
    <AppShell title="Agent Settings" subtitle="Configure API key, model, concurrency, and retry behavior for your account.">
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
    </AppShell>
  );
}
