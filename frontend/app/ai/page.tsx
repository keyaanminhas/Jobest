"use client";

import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/ui";
import {
  cancelAgentAction,
  confirmAgentAction,
  createAgentChatSession,
  getAgentChatSession,
  listAgentChatSessions,
  listJobPostings,
  sendAgentChatMessage,
  uploadCandidates,
} from "@/lib/api";
import { AgentChatSession, AgentChatSessionSummary, JobPostingRecord } from "@/lib/types";
import { Bot, CheckCircle2, FileUp, Plus, Send, ShieldCheck, Sparkles, Wrench, XCircle } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

const suggestions = [
  "List all job postings in this workspace.",
  "Show candidates for this posting.",
  "Find candidates with Docker evidence.",
  "Run triage for this posting.",
  "Analyze all candidates for this posting.",
  "Increase parallel agents to 3.",
];

export default function AiCopilotPage() {
  const [pending, startTransition] = useTransition();
  const [jobs, setJobs] = useState<JobPostingRecord[]>([]);
  const [sessions, setSessions] = useState<AgentChatSessionSummary[]>([]);
  const [session, setSession] = useState<AgentChatSession | null>(null);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");

  async function loadBase() {
    const [postingRows, sessionRows] = await Promise.all([listJobPostings(), listAgentChatSessions()]);
    setJobs(postingRows.postings);
    setSessions(sessionRows);
    if (!session && sessionRows[0]) {
      setSession(await getAgentChatSession(sessionRows[0].id));
      setSelectedJobId(sessionRows[0].job_posting_id || "");
    }
  }

  useEffect(() => {
    void loadBase().catch((exc) => setError(exc instanceof Error ? exc.message : "Failed loading AI copilot."));
  }, []);

  function newSession() {
    setError("");
    startTransition(async () => {
      try {
        const created = await createAgentChatSession({
          title: selectedJobId ? `Copilot: ${jobs.find((job) => job.id === selectedJobId)?.title || "Posting"}` : "Workspace Recruiter Copilot",
          job_posting_id: selectedJobId || null,
        });
        setSession(created);
        setSessions(await listAgentChatSessions());
      } catch (exc) {
        setError(exc instanceof Error ? exc.message : "Failed creating session.");
      }
    });
  }

  function openSession(sessionId: string) {
    setError("");
    startTransition(async () => {
      try {
        const opened = await getAgentChatSession(sessionId);
        setSession(opened);
        setSelectedJobId(opened.job_posting_id || "");
      } catch (exc) {
        setError(exc instanceof Error ? exc.message : "Failed opening session.");
      }
    });
  }

  function send() {
    const text = message.trim();
    if (!text && files.length === 0) return;
    setError("");
    startTransition(async () => {
      try {
        let active = session;
        if (!active) {
          active = await createAgentChatSession({
            title: selectedJobId ? `Copilot: ${jobs.find((job) => job.id === selectedJobId)?.title || "Posting"}` : "Workspace Recruiter Copilot",
            job_posting_id: selectedJobId || null,
          });
        }
        let uploadNote = "";
        if (files.length > 0) {
          if (!selectedJobId) throw new Error("Select a job posting before attaching candidate PDFs.");
          if (!window.confirm(`Upload ${files.length} candidate PDF file(s) to the selected posting?`)) return;
          const uploaded = await uploadCandidates(selectedJobId, files);
          uploadNote = ` Uploaded ${uploaded.uploaded_count} candidate PDF file(s) to the selected posting.`;
        }
        const turn = await sendAgentChatMessage(active.id, `${text || "Review the attached candidate PDFs."}${uploadNote}`);
        setSession(turn.session);
        setMessage("");
        setFiles([]);
        setSessions(await listAgentChatSessions());
      } catch (exc) {
        setError(exc instanceof Error ? exc.message : "Copilot request failed.");
      }
    });
  }

  function resolveAction(actionId: string, approve: boolean) {
    setError("");
    startTransition(async () => {
      try {
        if (approve) {
          const turn = await confirmAgentAction(actionId);
          setSession(turn.session);
        } else {
          setSession(await cancelAgentAction(actionId));
        }
      } catch (exc) {
        setError(exc instanceof Error ? exc.message : "Failed resolving action.");
      }
    });
  }

  return (
    <AppShell
      title="AI Recruiter Copilot"
      subtitle="A guarded tool-using agent for workspace search, posting setup, resume triage, analysis orchestration, and safe runtime control."
      actions={
        <button type="button" onClick={newSession} disabled={pending} className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          <Plus className="h-4 w-4" /> New session
        </button>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[250px_1fr_330px]">
        <div className="space-y-4">
          <Panel title="Context" subtitle="New sessions use the selected posting.">
            <select value={selectedJobId} onChange={(event) => setSelectedJobId(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <option value="">Workspace-wide</option>
              {jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}
            </select>
          </Panel>
          <Panel title="Sessions">
            <div className="space-y-2">
              {sessions.map((row) => (
                <button key={row.id} type="button" onClick={() => openSession(row.id)} className={`w-full rounded-lg border px-3 py-2 text-left text-xs ${session?.id === row.id ? "border-blue-300 bg-blue-50 text-accent" : "border-slate-200 text-slate-600"}`}>
                  <div className="font-semibold">{row.title}</div>
                  <div className="mt-1 text-[10px] opacity-70">{new Date(row.updated_at).toLocaleString()}</div>
                </button>
              ))}
              {sessions.length === 0 ? <div className="text-xs text-slate-500">Start a new workspace session.</div> : null}
            </div>
          </Panel>
        </div>

        <Panel className="min-h-[680px]">
          <div className="flex h-full flex-col">
            <div className="mb-4 flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-accent"><Bot className="h-5 w-5" /></div>
              <div>
                <div className="font-semibold text-slate-900">{session?.title || "Start a copilot session"}</div>
                <div className="text-xs text-slate-500">Reads run immediately. Workspace changes wait for your approval.</div>
              </div>
            </div>
            <div className="flex-1 space-y-3 overflow-auto pr-1">
              {session?.messages.map((row) => (
                <div key={row.id} className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${row.role === "user" ? "ml-auto bg-accent text-white" : "border border-slate-200 bg-slate-50 text-slate-700"}`}>
                  <div className="whitespace-pre-wrap">{row.content}</div>
                </div>
              ))}
              {!session?.messages.length ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-600">
                  Ask the copilot to inspect workspace data or prepare an action. It uses typed tools and records every execution.
                </div>
              ) : null}
              {session?.pending_actions.map((action) => (
                <div key={action.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-amber-800"><ShieldCheck className="h-4 w-4" /> Confirmation required</div>
                  <div className="mt-2 text-xs leading-6 text-amber-900">{action.summary}</div>
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => resolveAction(action.id, true)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"><CheckCircle2 className="h-3.5 w-3.5" /> Confirm</button>
                    <button type="button" onClick={() => resolveAction(action.id, false)} className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800"><XCircle className="h-3.5 w-3.5" /> Cancel</button>
                  </div>
                </div>
              ))}
            </div>
            {error ? <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div> : null}
            <div className="mt-4 border-t border-slate-100 pt-4">
              {files.length > 0 ? <div className="mb-2 text-xs text-slate-500">{files.length} PDF attachment(s) ready for upload.</div> : null}
              <div className="flex gap-2">
                <label className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">
                  <FileUp className="h-4 w-4" />
                  <input type="file" multiple accept=".pdf,application/pdf" className="hidden" onChange={(event) => setFiles(Array.from(event.target.files || []))} />
                </label>
                <input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") send(); }} placeholder="Ask Jobest to search, plan, or run an action..." className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-accent" />
                <button type="button" disabled={pending} onClick={send} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-white disabled:opacity-60"><Send className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Suggested prompts">
            <div className="space-y-2">
              {suggestions.map((item) => <button key={item} type="button" onClick={() => setMessage(item)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-xs leading-5 text-slate-600 hover:bg-slate-50">{item}</button>)}
            </div>
          </Panel>
          <Panel title="Tool trace" subtitle="Visible proof of agent decisions.">
            <div className="space-y-2">
              {session?.traces.map((trace) => (
                <div key={trace.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-800"><Wrench className="h-3.5 w-3.5 text-accent" /> {trace.tool_name}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-slate-500">{trace.risk_class} / {trace.status}</div>
                </div>
              ))}
              {!session?.traces.length ? <div className="text-xs text-slate-500">Tool executions appear here.</div> : null}
            </div>
          </Panel>
          <Panel title="Guardrails">
            <div className="space-y-2 text-xs leading-5 text-slate-600">
              <div className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> Credentials are outside agent control.</div>
              <div className="flex gap-2"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> Resume text is treated as untrusted data.</div>
              <div className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /> Writes require recruiter confirmation.</div>
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
