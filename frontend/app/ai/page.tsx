"use client";

import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/ui";
import LiveAgentPlan from "@/components/ui/live-agent-plan";
import { motion, AnimatePresence } from "framer-motion";
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
import { AgentChatMessage, AgentChatSession, AgentChatSessionSummary, AgentToolTrace, JobPostingRecord } from "@/lib/types";
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
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function inferUploadTargets(prompt: string, jobs: JobPostingRecord[], selectedJobId: string) {
  const lower = prompt.toLowerCase();
  const normalizedPrompt = normalizeText(prompt);
  const explicitMatches = jobs.filter((job) => {
    const normalizedTitle = normalizeText(job.title);
    return normalizedTitle.length > 0 && normalizedPrompt.includes(normalizedTitle);
  });
  if (explicitMatches.length > 0) {
    return explicitMatches;
  }

  const allGroupMatch = lower.match(/\ball\s+([a-z0-9/& +.-]+?)\s+(jobs|job postings|postings|roles)\b/);
  if (allGroupMatch) {
    const query = normalizeText(allGroupMatch[1] || "");
    const matches = jobs.filter((job) =>
      normalizeText([job.title, job.hiring_context || "", job.job_description || ""].join(" ")).includes(query),
    );
    if (matches.length > 0) return matches;
  }

  const keywordGroups = ["robotics", "mechatronics", "cyber security", "security", "ai", "backend", "software", "saas"];
  for (const keyword of keywordGroups) {
    if (lower.includes(keyword) && lower.includes("all")) {
      const matches = jobs.filter((job) =>
        normalizeText([job.title, job.hiring_context || "", job.job_description || ""].join(" ")).includes(normalizeText(keyword)),
      );
      if (matches.length > 0) return matches;
    }
  }

  if (selectedJobId) {
    const selected = jobs.find((job) => job.id === selectedJobId);
    if (selected) return [selected];
  }
  return [];
}

function isUploadIntent(prompt: string) {
  const lower = prompt.toLowerCase();
  return ["upload", "attach", "add this resume", "add this cv", "assign this resume", "assign this cv"].some((token) => lower.includes(token));
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

function MarkdownMessage({ content, user }: { content: string; user: boolean }) {
  return (
    <div className={`prose prose-sm max-w-none ${user ? "prose-invert" : "prose-slate"}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="my-0 whitespace-pre-wrap">{children}</p>,
          ul: ({ children }) => <ul className="my-2 list-disc pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal pl-5">{children}</ol>,
          li: ({ children }) => <li className="my-1">{children}</li>,
          h1: ({ children }) => <h1 className="mb-2 mt-0 text-base font-semibold">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-2 mt-0 text-[15px] font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-2 mt-0 text-sm font-semibold">{children}</h3>,
          hr: () => <hr className="my-3 border-slate-200" />,
          code: ({ className, children }) =>
            className ? (
              <code className="block overflow-x-auto whitespace-pre rounded-lg bg-slate-900/95 px-3 py-2 text-[12px] text-slate-100">
                {children}
              </code>
            ) : (
              <code className="rounded bg-black/10 px-1 py-0.5 text-[0.9em]">{children}</code>
            ),
          pre: ({ children }) => <pre className="my-2 overflow-x-auto">{children}</pre>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function associateTracesWithMessages(messages: AgentChatMessage[], traces: AgentToolTrace[]): Record<string, AgentToolTrace[]> {
  const association: Record<string, AgentToolTrace[]> = {};

  // Initialize association for all assistant messages
  for (const msg of messages) {
    if (msg.role === "assistant") {
      association[msg.id] = [];
    }
  }

  // Sort traces and assistant messages chronologically
  const assistantMessages = messages
    .filter((msg) => msg.role === "assistant")
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const sortedTraces = [...traces].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // For each trace, find the first assistant message that was created after (or at the same time as) the trace
  let msgIdx = 0;
  for (const trace of sortedTraces) {
    const traceTime = new Date(trace.created_at).getTime();

    // Move to the first assistant message that is at or after the trace timestamp
    while (
      msgIdx < assistantMessages.length &&
      new Date(assistantMessages[msgIdx].created_at).getTime() < traceTime
    ) {
      msgIdx++;
    }

    if (msgIdx < assistantMessages.length) {
      association[assistantMessages[msgIdx].id].push(trace);
    } else {
      // If no subsequent assistant message is found, assign it to the last assistant message
      const lastMsg = assistantMessages[assistantMessages.length - 1];
      if (lastMsg) {
        association[lastMsg.id].push(trace);
      }
    }
  }

  // For active optimistic messages, if there is a loading optimistic assistant message at the end,
  // it should display any new/unassociated traces (i.e. those created after the last real assistant message).
  const lastMsg = messages[messages.length - 1];
  if (lastMsg && lastMsg.role === "assistant" && lastMsg.metadata?.optimistic) {
    const lastRealMsg = assistantMessages.find((m) => !m.metadata?.optimistic);
    const cutTime = lastRealMsg ? new Date(lastRealMsg.created_at).getTime() : 0;

    association[lastMsg.id] = sortedTraces.filter(
      (t) => new Date(t.created_at).getTime() > cutTime
    );
  }

  return association;
}

// ─── main page ────────────────────────────────────────────────────────────────

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
  const [optimisticMessages, setOptimisticMessages] = useState<AgentChatMessage[]>([]);
  const [isResponding, setIsResponding] = useState(false);
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const historyRef = useRef<HTMLDivElement | null>(null);
  const contextRef = useRef<HTMLDivElement | null>(null);

  function addFiles(nextFiles: File[]) {
    const pdfFiles = nextFiles.filter(isPdfFile);
    if (pdfFiles.length !== nextFiles.length) {
      setError("Only PDF files can be attached in AI copilot.");
    } else {
      setError("");
    }
    if (pdfFiles.length === 0) return;
    setFiles((current) => {
      const deduped = [...current];
      for (const file of pdfFiles) {
        if (!deduped.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified)) {
          deduped.push(file);
        }
      }
      return deduped;
    });
  }

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
          title: "Recruiter Copilot",
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

  function pickSuggestion(index: number) {
    const normalized = ((index % suggestions.length) + suggestions.length) % suggestions.length;
    setSuggestionIndex(normalized);
    setMessage(suggestions[normalized]);
  }

  function send() {
    const text = message.trim();
    if (!text && files.length === 0) return;
    if (files.some((file) => !isPdfFile(file))) {
      setError("Only PDF files can be attached in AI copilot.");
      return;
    }
    setError("");
    setMessage("");
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

    startTransition(async () => {
      try {
        let active = session;
        if (!active) {
          active = await createAgentChatSession({
            title: "Recruiter Copilot",
            job_posting_id: selectedJobId || null,
          });
        }
        let uploadNote = "";
        if (files.length > 0) {
          const targets = inferUploadTargets(text, jobs, selectedJobId);
          if (targets.length === 0) throw new Error("Select a job posting or name a target role before attaching candidate PDFs.");
          if (!window.confirm(`Upload ${files.length} candidate PDF file(s) to the selected posting?`)) {
            setOptimisticMessages([]);
            setIsResponding(false);
            setMessage(text);
            return;
          }
          const uploadResults = [];
          for (const target of targets) {
            uploadResults.push(await uploadCandidates(target.id, files));
          }
          const totalUploaded = uploadResults.reduce((sum, row) => sum + row.uploaded_count, 0);
          const targetNames = targets.map((target) => target.title);
          uploadNote = ` Uploaded ${files.length} candidate PDF file(s) across ${targetNames.length} posting(s): ${targetNames.join(", ")}.`;
          setFiles([]);
          if (!text || isUploadIntent(text)) {
            const uploadedAssistant: AgentChatMessage = {
              id: `upload-only-${Date.now()}`,
              role: "assistant",
              content: `Uploaded ${totalUploaded} candidate PDF submission(s) across ${targetNames.length} posting(s): ${targetNames.join(", ")}. You can now ask me to triage, compare, or analyze them.`,
              metadata: {},
              created_at: new Date().toISOString(),
            };
            setSession({
              ...active,
              messages: [...(active.messages || []), optimisticUser, uploadedAssistant],
              traces: active.traces || [],
              pending_actions: active.pending_actions || [],
            });
            setOptimisticMessages([]);
            setIsResponding(false);
            await refreshSessionList();
            return;
          }
        }
        const turn = await sendAgentChatMessage(active.id, `${text || "Review the attached candidate PDFs."}${uploadNote}`);
        setSession(turn.session);
        setOptimisticMessages([]);
        await refreshSessionList();
      } catch (exc) {
        setMessage(text);
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

  const allMessages = visibleMessages();
  const msgTracesMap = associateTracesWithMessages(allMessages, session?.traces || []);

  const latestAssistantIndex = (() => {
    for (let index = allMessages.length - 1; index >= 0; index--) {
      if (allMessages[index].role === "assistant") {
        return index;
      }
    }
    return -1;
  })();

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
                          <div className="mt-1 text-[10px] opacity-70" suppressHydrationWarning>{new Date(row.updated_at).toLocaleString()}</div>
                        </button>
                      ))}
                      {sessions.length === 0 ? <div className="text-xs text-slate-500">Start a new workspace session.</div> : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div ref={messagesViewportRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-2 scroll-smooth">
              {allMessages.map((row, rowIndex, rows) => {
                const isUser = row.role === "user";
                const isLoading = !!row.metadata?.loading;
                const msgTraces = msgTracesMap[row.id] || [];

                if (isLoading) {
                  return (
                    <motion.div
                      key={row.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, ease: [0.2, 0.65, 0.3, 0.9] }}
                      className="space-y-3"
                    >
                      <div className="flex justify-start">
                        <div className="flex items-end gap-3 max-w-[80%]">
                          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-white shadow-sm">
                            <Image src="/icon.svg" alt="Jobest" width={18} height={18} className="h-[18px] w-[18px]" />
                          </div>
                          <div className="rounded-[1.35rem] border border-slate-200 bg-white px-4 py-3 shadow-sm">
                            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Jobest AI</div>
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1">
                                {[0, 1, 2].map((i) => (
                                  <span
                                    key={i}
                                    className="inline-block h-1.5 w-1.5 rounded-full bg-accent"
                                    style={{
                                      animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                                    }}
                                  />
                                ))}
                              </span>
                              <span className="text-sm text-slate-500">Thinking…</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Agent plan panel below the thinking bubble */}
                      {msgTraces && msgTraces.length > 0 && (
                        <div className="ml-12 mt-2 max-w-[84%]">
                          <LiveAgentPlan
                            traces={msgTraces}
                            isResponding={isResponding}
                            toolSteps={msgTraces.length}
                            defaultCollapsed={false}
                          />
                        </div>
                      )}
                    </motion.div>
                  );
                }

                return (
                  <motion.div
                    key={row.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: [0.2, 0.65, 0.3, 0.9] }}
                  >
                    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
                      <div className={`flex max-w-[84%] items-end gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
                        {/* Avatar */}
                        <div
                          className={`grid h-9 w-9 shrink-0 place-items-center rounded-2xl border ${
                            isUser
                              ? "border-blue-200 bg-blue-50 text-accent"
                              : "border-slate-200 bg-white shadow-sm"
                          }`}
                        >
                          {isUser ? (
                            <span className="text-xs font-bold">KM</span>
                          ) : (
                            <Image src="/icon.svg" alt="Jobest" width={18} height={18} className="h-[18px] w-[18px]" />
                          )}
                        </div>

                        {/* Bubble */}
                        <div
                          className={`rounded-[1.35rem] px-4 py-3 text-sm leading-6 ${
                            isUser
                              ? "bg-accent text-white shadow-[0_8px_24px_rgba(29,78,216,0.2)]"
                              : "border border-slate-200 bg-slate-50 text-slate-700 border-l-2 border-l-accent/20"
                          }`}
                        >
                          <div
                            className={`mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                              isUser ? "text-blue-200" : "text-slate-400"
                            }`}
                          >
                            {isUser ? "You" : "Jobest AI"}
                          </div>
                          <MarkdownMessage content={row.content} user={isUser} />
                        </div>
                      </div>
                    </div>

                    {/* Agent plan panel below each assistant message */}
                    {!isUser && msgTraces && msgTraces.length > 0 && (
                      <div className="ml-12 mt-2 max-w-[84%]">
                        <LiveAgentPlan
                          traces={msgTraces}
                          isResponding={isResponding && rowIndex === rows.length - 1}
                          toolSteps={msgTraces.length}
                          defaultCollapsed={rowIndex < latestAssistantIndex}
                        />
                      </div>
                    )}
                  </motion.div>
                );
              })}

              {!allMessages.length ? (
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
                    onChange={(event) => {
                      addFiles(Array.from(event.target.files || []));
                      event.target.value = "";
                    }}
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
