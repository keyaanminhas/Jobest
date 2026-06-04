"use client";

import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/ui";
import LiveAgentPlan from "@/components/ui/live-agent-plan";
import { AIPromptBox } from "@/components/ui/ai-prompt-box";
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
  X,
  History,
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

function MarkdownMessage({ content, variant = "assistant" }: { content: string; variant?: "assistant" | "user" }) {
  if (variant === "user") {
    return <div className="whitespace-pre-wrap text-[14px] leading-7 text-slate-800">{content}</div>;
  }

  return (
    <div className="rounded-[28px] border border-slate-200/80 bg-white/95 px-5 py-4 shadow-sm ring-1 ring-slate-100/70">
      <div className="space-y-5 text-[14px] leading-7 text-slate-700">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => <p className="m-0">{children}</p>,
            ul: ({ children }) => <ul className="m-0 list-disc space-y-2 pl-5">{children}</ul>,
            ol: ({ children }) => <ol className="m-0 list-decimal space-y-2 pl-5">{children}</ol>,
            li: ({ children }) => <li className="pl-1">{children}</li>,
            h1: ({ children }) => (
              <h1 className="m-0 text-[1.2rem] font-semibold tracking-tight text-slate-900">{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 className="m-0 border-b border-slate-200/80 pb-2 pt-1 text-[1.05rem] font-semibold tracking-tight text-slate-900">
                {children}
              </h2>
            ),
            h3: ({ children }) => <h3 className="m-0 text-[0.98rem] font-semibold text-slate-800">{children}</h3>,
            hr: () => <hr className="my-1 border-slate-200/80" />,
            blockquote: ({ children }) => (
              <blockquote className="m-0 rounded-2xl border-l-4 border-blue-200 bg-blue-50/60 px-4 py-3 text-slate-700">
                {children}
              </blockquote>
            ),
            table: ({ children }) => (
              <div className="my-1 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80 shadow-sm">
                <table className="w-full border-collapse text-left text-[13px]">{children}</table>
              </div>
            ),
            thead: ({ children }) => <thead className="bg-slate-100/90 text-[10px] uppercase tracking-[0.12em] text-slate-500">{children}</thead>,
            tbody: ({ children }) => <tbody className="bg-white">{children}</tbody>,
            tr: ({ children }) => <tr className="odd:bg-white even:bg-slate-50/40">{children}</tr>,
            th: ({ children }) => <th className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-600">{children}</th>,
            td: ({ children }) => <td className="border-b border-slate-100 px-4 py-3 align-top text-slate-700">{children}</td>,
            code: ({ className, children }) =>
              className ? (
                <code className="block overflow-x-auto rounded-xl bg-slate-950 px-4 py-3 font-mono text-[12px] leading-6 text-slate-100">
                  {children}
                </code>
              ) : (
                <code className="rounded-md bg-slate-100 px-1.5 py-0.5 font-medium text-slate-800">{children}</code>
              ),
            pre: ({ children }) => <pre className="m-0 overflow-x-auto">{children}</pre>,
            strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
            a: ({ children, href }) => (
              <a href={href} className="font-medium text-accent underline decoration-accent/30 underline-offset-2">
                {children}
              </a>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
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

    // Move to the first assistant message that is at or after the trace timestamp (with a 5-second tolerance for flush timing skew)
    while (
      msgIdx < assistantMessages.length &&
      new Date(assistantMessages[msgIdx].created_at).getTime() + 5000 < traceTime
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
    const lastRealMsg = assistantMessages.filter((m) => !m.metadata?.optimistic).pop();
    const cutTime = lastRealMsg ? new Date(lastRealMsg.created_at).getTime() : 0;

    association[lastMsg.id] = sortedTraces.filter(
      (t) => new Date(t.created_at).getTime() > cutTime
    );
  }

  return association;
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
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [optimisticMessages, setOptimisticMessages] = useState<AgentChatMessage[]>([]);
  const [isResponding, setIsResponding] = useState(false);

  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const historyRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  function newSession() {
    setError("");
    setHistoryOpen(false);
    setIsResponding(false);
    setOptimisticMessages([]);
    startTransition(async () => {
      try {
        const created = await createAgentChatSession({
          title: "Recruiter Copilot",
          job_posting_id: selectedJobId || null,
        });
        setSession(created);
        await refreshSessionList();
      } catch (exc) {
        setError(exc instanceof Error ? exc.message : "Failed creating session.");
      }
    });
  }

  function openSession(sessionId: string) {
    setError("");
    setHistoryOpen(false);
    setIsResponding(false);
    setOptimisticMessages([]);
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

  function visibleMessages() {
    return [...(session?.messages || []), ...optimisticMessages];
  }

  function latestAssistantIndex() {
    const all = visibleMessages();
    for (let i = all.length - 1; i >= 0; i--) {
      if (all[i].role === "assistant") return i;
    }
    return -1;
  }

  function pickSuggestion(index: number) {
    const normalized = ((index % suggestions.length) + suggestions.length) % suggestions.length;
    setSuggestionIndex(normalized);
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
  const latestAssIndex = latestAssistantIndex();

  return (
    <AppShell
      title="AI Recruiter Copilot"
      subtitle="A guarded tool-using agent for workspace search, posting setup, resume triage, analysis orchestration, and safe runtime control."
      noPageHeader={true}
    >
      <div className="flex flex-col h-[calc(100vh-8.5rem)] min-h-[580px] bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
        {/* Elegant Top Navigation Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-white px-5 py-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-accent">
              <Bot className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="font-semibold text-slate-800 text-sm">{session?.title || "Recruiter Copilot"}</div>
              <div className="text-[11px] text-slate-400">Reads run immediately. Changes require approval.</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative" ref={historyRef}>
              <button
                type="button"
                onClick={() => setHistoryOpen((current) => !current)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                <History className="h-3.5 w-3.5 text-accent" />
                History
              </button>
              {historyOpen && (
                <div className="absolute right-0 top-10 z-30 w-[280px] rounded-xl border border-slate-200 bg-white p-3 shadow-lg backdrop-blur-md bg-white/95">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Recent Sessions</div>
                  <div className="max-h-[300px] space-y-1.5 overflow-y-auto pr-1">
                    {sessions.map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => openSession(row.id)}
                        className={`w-full rounded-lg border px-2.5 py-1.5 text-left text-xs transition ${
                          session?.id === row.id 
                            ? "border-blue-200 bg-blue-50/50 text-accent" 
                            : "border-slate-100 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <div className="font-semibold truncate">{row.title}</div>
                        <div className="mt-0.5 text-[9px] opacity-70" suppressHydrationWarning>
                          {new Date(row.updated_at).toLocaleString()}
                        </div>
                      </button>
                    ))}
                    {sessions.length === 0 && <div className="text-xs text-slate-500">No sessions.</div>}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={newSession}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              <Plus className="h-3.5 w-3.5" />
              New
            </button>
          </div>
        </div>

        {/* Conversation Viewport */}
        <div ref={messagesViewportRef} className="flex-1 min-h-0 overflow-y-auto bg-slate-50/30 px-6 py-4 space-y-6 scroll-smooth">
          {allMessages.map((row, rowIndex, rows) => {
            const isUser = row.role === "user";
            const isLoading = !!row.metadata?.loading;
            const msgTraces = msgTracesMap[row.id] || [];

            if (isLoading) {
              return (
                <div key={row.id} className="flex justify-start py-4">
                  <style>{`
                    @keyframes thinking-wave {
                      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
                      30% { transform: translateY(-5px); opacity: 1; }
                    }
                    @keyframes thinking-label {
                      0%, 100% { opacity: 0.5; }
                      50% { opacity: 1; }
                    }
                  `}</style>
                  <div className="flex gap-4 w-full max-w-[85%]">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-accent border border-blue-100/50">
                      <Bot className="h-4.5 w-4.5" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Jobest AI</div>
                      <div className="flex items-center gap-2.5">
                        <span className="flex items-center gap-[5px]">
                          {[0, 1, 2].map((i) => (
                            <span
                              key={i}
                              className="inline-block h-2 w-2 rounded-full bg-accent"
                              style={{
                                animation: `thinking-wave 1.4s ease-in-out ${i * 0.18}s infinite`,
                              }}
                            />
                          ))}
                        </span>
                        <span
                          className="text-xs text-slate-400 font-medium"
                          style={{ animation: "thinking-label 2s ease-in-out infinite" }}
                        >Thinking…</span>
                      </div>
                      
                      {msgTraces && msgTraces.length > 0 && (
                        <div className="mt-3">
                          <LiveAgentPlan
                            traces={msgTraces}
                            isResponding={isResponding}
                            toolSteps={msgTraces.length}
                            defaultCollapsed={false}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }

            if (isUser) {
              return (
                <div key={row.id} className="flex justify-end py-2">
                  <div className="flex gap-3 max-w-[80%] flex-row-reverse items-start">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-white font-bold text-xs shadow-sm">
                      KM
                    </div>
                    <div className="rounded-2xl bg-accent/5 border border-accent/10 px-4 py-2.5 text-slate-800 text-sm leading-relaxed shadow-sm">
                      <div className="text-[9px] font-bold text-accent uppercase tracking-wider mb-1">You</div>
                      <MarkdownMessage content={row.content} variant="user" />
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={row.id} className="flex justify-start py-4 border-b border-slate-100/50 last:border-0">
                <div className="flex gap-4 w-full max-w-[85%]">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-accent border border-blue-100/50">
                    <Bot className="h-4.5 w-4.5" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Jobest AI</div>
                    <MarkdownMessage content={row.content} />
                    
                    {msgTraces && msgTraces.length > 0 && (
                      <div className="mt-3">
                        <LiveAgentPlan
                          traces={msgTraces}
                          isResponding={isResponding && rowIndex === rows.length - 1}
                          toolSteps={msgTraces.length}
                          defaultCollapsed={rowIndex < latestAssIndex}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Empty Conversation Welcome State */}
          {!allMessages.length && (
            <div className="flex flex-col items-center justify-center py-12 px-4 max-w-xl mx-auto text-center space-y-8">
              <div className="space-y-3">
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight">How can I help today?</h2>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Ask me to inspect workspace data, perform resume triage, analyze candidates, or coordinate recruitment workflows.
                </p>
              </div>

              {/* restored suggestions showcase card */}
              <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xs text-left">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Try this prompt</div>
                  <button
                    type="button"
                    onClick={() => pickSuggestion(suggestionIndex + 1)}
                    className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition hover:border-blue-200 hover:bg-blue-50 hover:text-accent shadow-2xs bg-white"
                  >
                    Rotate prompt
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setMessage(suggestions[suggestionIndex])}
                  className="mt-3.5 w-full rounded-xl bg-slate-50/50 hover:bg-blue-50/20 border border-slate-100 hover:border-blue-100 p-4 text-left transition"
                >
                  <div className="text-sm font-semibold text-slate-800">{suggestions[suggestionIndex]}</div>
                  <div className="mt-1 text-xs text-slate-500 leading-relaxed">Load this into the composer, edit it if needed, then send.</div>
                </button>
              </div>
              
              <div className="flex flex-wrap items-center justify-center gap-2">
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
          )}

          {/* Pending Actions Confirmation Banner */}
          {session?.pending_actions.map((action) => (
            <div key={action.id} className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 shadow-sm backdrop-blur-xs max-w-2xl mx-auto">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                <ShieldCheck className="h-4 w-4 text-amber-600" /> Confirmation required
              </div>
              <div className="mt-1.5 text-xs leading-relaxed text-amber-900">{action.summary}</div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => resolveAction(action.id, true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Confirm
                </button>
                <button
                  type="button"
                  onClick={() => resolveAction(action.id, false)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 shadow-xs hover:bg-slate-50 transition"
                >
                  <XCircle className="h-3.5 w-3.5" /> Cancel
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Input Scope & Attachments Panel */}
        <div className="px-5 py-4 border-t border-slate-100 bg-white shrink-0 space-y-3">
          {/* File input (programmatically clicked by AIPromptBox) */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(event) => {
              addFiles(Array.from(event.target.files || []));
              event.target.value = "";
            }}
          />

          {/* Attached Files List */}
          <AnimatePresence>
            {files.length > 0 && (
              <motion.div 
                className="flex gap-2 flex-wrap"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                {files.map((file, index) => (
                  <motion.div
                    key={index}
                    className="flex items-center gap-2 text-xs bg-slate-50 border border-slate-200 py-1 px-2.5 rounded-lg text-slate-600 shadow-2xs"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                  >
                    <span className="font-semibold truncate max-w-[180px]">{file.name}</span>
                    <button 
                      type="button"
                      onClick={() => setFiles(prev => prev.filter((_, i) => i !== index))}
                      className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between">
            {error && (
              <div className="text-[11px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">
                {error}
              </div>
            )}
          </div>

          {/* Claude-style AIPromptBox (Light Themed) */}
          <div>
            <AIPromptBox
              value={message}
              onChange={setMessage}
              onSubmit={send}
              onAttachFile={() => fileInputRef.current?.click()}
              isLoading={pending || isResponding}
              selectedJobId={selectedJobId}
              onJobIdChange={setSelectedJobId}
              jobs={jobs}
              placeholder="Ask Jobest to search, plan, or run an action..."
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
