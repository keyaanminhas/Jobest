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
import { AgentChatMessage, AgentChatSession, AgentChatSessionSummary, JobPostingRecord } from "@/lib/types";
import {
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileUp,
  LoaderCircle,
  Plus,
  Send,
  ShieldCheck,
  Wrench,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";

const suggestions = [
  "List all job postings in this workspace.",
  "Show candidates for this posting.",
  "Find candidates with Docker evidence.",
  "Run triage for this posting.",
  "Analyze all candidates for this posting.",
  "Increase parallel agents to 3.",
];

const quickStarts = [
  { label: "Search resumes", prompt: "Find candidates with Docker evidence." },
  { label: "Run triage", prompt: "Run triage for this posting." },
  { label: "Analyze batch", prompt: "Analyze all candidates for this posting." },
];

function sessionTitleFor(jobId: string, jobs: JobPostingRecord[]) {
  const title = jobs.find((job) => job.id === jobId)?.title;
  return title ? `Copilot: ${title}` : "Workspace Recruiter Copilot";
}

function messageBubble(row: AgentChatMessage) {
  return row.role === "user"
    ? "bg-accent text-white shadow-[0_18px_40px_rgba(29,78,216,0.18)]"
    : "border border-slate-200 bg-slate-50 text-slate-700";
}

function senderRail(row: AgentChatMessage) {
  return row.role === "user" ? "justify-end" : "justify-start";
}

function traceStatusTone(status: string) {
  if (status === "completed") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (status === "awaiting_confirmation") return "bg-amber-50 text-amber-800 ring-1 ring-amber-200";
  if (status === "error") return "bg-red-50 text-red-700 ring-1 ring-red-200";
  return "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
}

export default function AiCopilotPage() {
  const [pending, startTransition] = useTransition();
  const [jobs, setJobs] = useState<JobPostingRecord[]>([]);
  const [sessions, setSessions] = useState<AgentChatSessionSummary[]>([]);
  const [session, setSession] = useState<AgentChatSession | null>(null);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [toolTraceOpen, setToolTraceOpen] = useState(false);
  const [optimisticMessages, setOptimisticMessages] = useState<AgentChatMessage[]>([]);
  const [isResponding, setIsResponding] = useState(false);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const historyRef = useRef<HTMLDivElement | null>(null);
  const contextRef = useRef<HTMLDivElement | null>(null);

  async function refreshSessionList() {
    setSessions(await listAgentChatSessions());
  }

  async function loadBase() {
    const [postingRows, sessionRows] = await Promise.all([listJobPostings(), listAgentChatSessions()]);
    setJobs(postingRows.postings);
    setSessions(sessionRows);
    if (!session && sessionRows[0]) {
      const opened = await getAgentChatSession(sessionRows[0].id);
      setSession(opened);
      setSelectedJobId(opened.job_posting_id || "");
    }
  }

  useEffect(() => {
    void loadBase().catch((exc) => setError(exc instanceof Error ? exc.message : "Failed loading AI copilot."));
  }, []);

  useEffect(() => {
    const viewport = messagesViewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
  }, [session, optimisticMessages, isResponding]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (historyRef.current && !historyRef.current.contains(event.target as Node)) {
        setHistoryOpen(false);
      }
      if (contextRef.current && !contextRef.current.contains(event.target as Node)) {
        setContextOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  function newSession() {
    setError("");
    setHistoryOpen(false);
    startTransition(async () => {
      try {
        const created = await createAgentChatSession({
          title: sessionTitleFor(selectedJobId, jobs),
          job_posting_id: selectedJobId || null,
        });
        setSession(created);
        setOptimisticMessages([]);
        await refreshSessionList();
      } catch (exc) {
        setError(exc instanceof Error ? exc.message : "Failed creating session.");
      }
    });
  }

  function openSession(sessionId: string) {
    setError("");
    setHistoryOpen(false);
    startTransition(async () => {
      try {
        const opened = await getAgentChatSession(sessionId);
        setSession(opened);
        setSelectedJobId(opened.job_posting_id || "");
        setOptimisticMessages([]);
      } catch (exc) {
        setError(exc instanceof Error ? exc.message : "Failed opening session.");
      }
    });
  }

  function visibleMessages() {
    return [...(session?.messages || []), ...optimisticMessages];
  }

  function latestAssistantToolSteps() {
    const messages = session?.messages || [];
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const row = messages[index];
      if (row.role !== "assistant") continue;
      const steps = Number(row.metadata?.tool_steps || 0);
      if (Number.isFinite(steps) && steps > 0) return steps;
    }
    return 0;
  }

  function visibleTraceFeed() {
    const steps = latestAssistantToolSteps();
    return [...(session?.traces || [])].slice(0, steps > 0 ? steps : 0).reverse();
  }

  function currentToolStatus() {
    const traces = visibleTraceFeed();
    if (isResponding) {
      return {
        title: "Thinking",
        subtitle: "Jobest is planning the next tool step.",
      };
    }
    if (traces[0]) {
      return {
        title: traces[0].tool_name.replaceAll("_", " "),
        subtitle: `${traces.length} tool step${traces.length === 1 ? "" : "s"} in this answer`,
      };
    }
    return {
      title: "Tool activity",
      subtitle: "No tool steps yet",
    };
  }

  function pickSuggestion(index: number) {
    const normalized = ((index % suggestions.length) + suggestions.length) % suggestions.length;
    setSuggestionIndex(normalized);
    setMessage(suggestions[normalized]);
  }

  function shouldShowToolActivity(row: AgentChatMessage, rowIndex: number, messages: AgentChatMessage[]) {
    if (row.role !== "assistant") return false;
    if (rowIndex !== messages.length - 1) return false;
    if (row.metadata?.loading && isResponding) return true;
    return Number(row.metadata?.tool_steps || 0) > 0;
  }

  function send() {
    const text = message.trim();
    if (!text && files.length === 0) return;
    setError("");
    const now = new Date().toISOString();
    const optimisticUser: AgentChatMessage = {
      id: `optimistic-user-${Date.now()}`,
      role: "user",
      content: text || "Review the attached candidate PDFs.",
      metadata: { optimistic: true },
      created_at: now,
    };
    const optimisticAssistant: AgentChatMessage = {
      id: `optimistic-assistant-${Date.now()}`,
      role: "assistant",
      content: "Working on that...",
      metadata: { optimistic: true, loading: true },
      created_at: now,
    };
    setOptimisticMessages([optimisticUser, optimisticAssistant]);
    setIsResponding(true);
    setToolTraceOpen(false);

    startTransition(async () => {
      try {
        let active = session;
        if (!active) {
          active = await createAgentChatSession({
            title: sessionTitleFor(selectedJobId, jobs),
            job_posting_id: selectedJobId || null,
          });
        }
        let uploadNote = "";
        if (files.length > 0) {
          if (!selectedJobId) throw new Error("Select a job posting before attaching candidate PDFs.");
          if (!window.confirm(`Upload ${files.length} candidate PDF file(s) to the selected posting?`)) {
            setOptimisticMessages([]);
            setIsResponding(false);
            return;
          }
          const uploaded = await uploadCandidates(selectedJobId, files);
          uploadNote = ` Uploaded ${uploaded.uploaded_count} candidate PDF file(s) to the selected posting.`;
        }
        const turn = await sendAgentChatMessage(active.id, `${text || "Review the attached candidate PDFs."}${uploadNote}`);
        setSession(turn.session);
        setMessage("");
        setFiles([]);
        setOptimisticMessages([]);
        await refreshSessionList();
      } catch (exc) {
        setError(exc instanceof Error ? exc.message : "Copilot request failed.");
      } finally {
        setIsResponding(false);
        setOptimisticMessages([]);
      }
    });
  }

  function resolveAction(actionId: string, approve: boolean) {
    setError("");
    setIsResponding(true);
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
      } finally {
        setIsResponding(false);
      }
    });
  }

  return (
    <AppShell
      title="AI Recruiter Copilot"
      subtitle="A guarded tool-using agent for workspace search, posting setup, resume triage, analysis orchestration, and safe runtime control."
      actions={
        <button
          type="button"
          onClick={newSession}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          <Plus className="h-4 w-4" /> New session
        </button>
      }
    >
      <div className="grid gap-5 xl:h-[calc(100vh-18.5rem)] xl:min-h-[680px] xl:grid-cols-[minmax(0,1fr)]">
        <Panel className="h-[calc(100vh-21rem)] min-h-[640px] overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] xl:h-full">
          <div className="flex h-full min-h-0 flex-col">
            <div className="mb-4 flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-accent shadow-sm">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">{session?.title || "Start a copilot session"}</div>
                  <div className="text-xs text-slate-500">Reads run immediately. Workspace changes wait for your approval.</div>
                </div>
              </div>

              <div className="relative shrink-0" ref={historyRef}>
                <button
                  type="button"
                  onClick={() => setHistoryOpen((current) => !current)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  <Clock3 className="h-4 w-4 text-accent" />
                  Sessions
                </button>
                {historyOpen ? (
                  <div className="absolute right-0 top-12 z-30 w-[320px] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Recent sessions</div>
                    <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                      {sessions.map((row) => (
                        <button
                          key={row.id}
                          type="button"
                          onClick={() => openSession(row.id)}
                          className={`w-full rounded-xl border px-3 py-2 text-left text-xs transition ${
                            session?.id === row.id ? "border-blue-300 bg-blue-50 text-accent" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <div className="font-semibold">{row.title}</div>
                          <div className="mt-1 text-[10px] opacity-70">{new Date(row.updated_at).toLocaleString()}</div>
                        </button>
                      ))}
                      {sessions.length === 0 ? <div className="text-xs text-slate-500">Start a new workspace session.</div> : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div ref={messagesViewportRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-2 scroll-smooth">
              {visibleMessages().map((row, rowIndex, rows) => (
                <div key={row.id} className={`flex w-full ${senderRail(row)}`}>
                  <div className={`flex max-w-[96%] items-end gap-3 ${row.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl border ${
                        row.role === "user"
                          ? "border-blue-200 bg-blue-50 text-accent"
                          : "border-slate-200 bg-white shadow-sm"
                      }`}
                    >
                      {row.role === "user" ? (
                        <span className="text-sm font-bold">KM</span>
                      ) : (
                        <Image
                          src="/icon.svg"
                          alt="Jobest"
                          width={18}
                          height={18}
                          className="h-[18px] w-[18px]"
                        />
                      )}
                    </div>

                    <div className={`max-w-[92%] rounded-[1.35rem] px-4 py-3 text-sm leading-6 ${messageBubble(row)}`}>
                      <div className={`mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${row.role === "user" ? "text-blue-100" : "text-slate-400"}`}>
                        {row.role === "user" ? "You" : "Jobest AI"}
                      </div>
                      <div className="whitespace-pre-wrap">
                        {row.metadata?.loading ? (
                          <span className="inline-flex items-center gap-2 text-slate-600">
                            <LoaderCircle className="h-4 w-4 animate-spin text-accent" />
                            {row.content}
                          </span>
                        ) : (
                          row.content
                        )}
                      </div>

                      {shouldShowToolActivity(row, rowIndex, rows) ? (
                        <div className={`mt-3 rounded-[1rem] border px-3 py-2 ${row.role === "assistant" ? "border-slate-200 bg-white/80" : "border-white/20 bg-white/10"}`}>
                          <button
                            type="button"
                            onClick={() => setToolTraceOpen((current) => !current)}
                            className="flex w-full items-center justify-between gap-3 text-left"
                          >
                            <div className="min-w-0">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Tool activity</div>
                              <div className="mt-1 flex items-center gap-2">
                                {isResponding ? <LoaderCircle className="h-3.5 w-3.5 animate-spin text-accent" /> : <Wrench className="h-3.5 w-3.5 text-accent" />}
                                <div className="min-w-0">
                                  <div className="truncate text-[13px] font-semibold text-slate-900">{currentToolStatus().title}</div>
                                  <div className="text-[10px] text-slate-500">{currentToolStatus().subtitle}</div>
                                </div>
                              </div>
                            </div>
                            <div className="inline-flex items-center gap-2 text-[10px] font-medium text-slate-500">
                              {toolTraceOpen ? "Hide" : "Expand"}
                              <ChevronDown className={`h-4 w-4 transition ${toolTraceOpen ? "rotate-180" : ""}`} />
                            </div>
                          </button>

                          {toolTraceOpen ? (
                            <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                              {visibleTraceFeed().map((trace, index) => (
                                <div key={trace.id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                                  <div className="mt-0.5 flex flex-col items-center">
                                    <div className="h-2.5 w-2.5 rounded-full bg-accent" />
                                    {index < visibleTraceFeed().length - 1 ? <div className="mt-1 h-6 w-px bg-slate-200" /> : null}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <div className="text-[11px] font-semibold text-slate-800">{trace.tool_name}</div>
                                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${traceStatusTone(trace.status)}`}>
                                        {trace.status.replaceAll("_", " ")}
                                      </span>
                                    </div>
                                    <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-slate-400">{trace.risk_class}</div>
                                    {Object.keys(trace.arguments || {}).length ? (
                                      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg bg-white px-2.5 py-2 text-[10px] leading-5 text-slate-600 ring-1 ring-slate-200">
                                        {JSON.stringify(trace.arguments, null, 2)}
                                      </pre>
                                    ) : (
                                      <div className="mt-2 text-[10px] text-slate-500">No explicit arguments.</div>
                                    )}
                                  </div>
                                </div>
                              ))}

                              {!isResponding && !visibleTraceFeed().length ? (
                                <div className="text-[10px] text-slate-500">Tool steps will appear here as Jobest plans and executes them.</div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}

              {!visibleMessages().length ? (
                <div className="rounded-[1.6rem] border border-dashed border-slate-200 bg-slate-50 p-5">
                  <div className="text-sm leading-7 text-slate-600">
                    Ask the copilot to inspect workspace data or prepare an action. It uses typed tools, records every execution, and only mutates workspace state after confirmation.
                  </div>
                  <div className="mt-4 rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-[0_14px_30px_rgba(15,23,42,0.05)]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Try this</div>
                      <button
                        type="button"
                        onClick={() => pickSuggestion(suggestionIndex + 1)}
                        className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-accent"
                      >
                        Another prompt
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMessage(suggestions[suggestionIndex])}
                      className="mt-3 w-full rounded-[1rem] bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_100%)] px-4 py-4 text-left transition hover:ring-1 hover:ring-blue-200"
                    >
                      <div className="text-sm font-semibold text-slate-900">{suggestions[suggestionIndex]}</div>
                      <div className="mt-1 text-xs leading-5 text-slate-500">Load this into the composer, edit it if needed, then send.</div>
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {quickStarts.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => setMessage(item.prompt)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-accent"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {session?.pending_actions.map((action) => (
                <div key={action.id} className="rounded-[1.4rem] border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                    <ShieldCheck className="h-4 w-4" /> Confirmation required
                  </div>
                  <div className="mt-2 text-xs leading-6 text-amber-900">{action.summary}</div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => resolveAction(action.id, true)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => resolveAction(action.id, false)}
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {error ? <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div> : null}

            <div className="mt-4 border-t border-slate-100 pt-4">
              {files.length > 0 ? <div className="mb-2 text-xs text-slate-500">{files.length} PDF attachment(s) ready for upload.</div> : null}
              <div className="flex gap-2">
                <div className="relative shrink-0" ref={contextRef}>
                  <button
                    type="button"
                    onClick={() => setContextOpen((current) => !current)}
                    className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    <BriefcaseBusiness className="h-4 w-4 text-accent" />
                    Context
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  {contextOpen ? (
                    <div className="absolute bottom-14 left-0 z-30 w-[280px] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Chat scope</div>
                      <select
                        value={selectedJobId}
                        onChange={(event) => {
                          setSelectedJobId(event.target.value);
                          setContextOpen(false);
                        }}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      >
                        <option value="">Workspace-wide</option>
                        {jobs.map((job) => (
                          <option key={job.id} value={job.id}>
                            {job.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>

                <label className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50">
                  <FileUp className="h-4 w-4" />
                  <input
                    type="file"
                    multiple
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(event) => setFiles(Array.from(event.target.files || []))}
                  />
                </label>

                <input
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Ask Jobest to search, plan, or run an action..."
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-accent"
                />

                <button
                  type="button"
                  disabled={pending || isResponding}
                  onClick={send}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-white disabled:opacity-60"
                >
                  {isResponding ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                Active scope: {selectedJobId ? jobs.find((job) => job.id === selectedJobId)?.title || "Selected posting" : "Workspace-wide"}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {quickStarts.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setMessage(item.prompt)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-accent"
                  >
                    {item.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => pickSuggestion(suggestionIndex + 1)}
                  className="rounded-full border border-dashed border-slate-300 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-accent"
                >
                  Rotate prompt
                </button>
              </div>
            </div>
          </div>
        </Panel>

      </div>
    </AppShell>
  );
}
