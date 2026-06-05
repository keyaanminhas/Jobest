"use client";

import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleAlert,
  CircleDotDashed,
  CircleX,
  LoaderCircle,
} from "lucide-react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { AgentToolTrace } from "@/lib/types";

// ─── status helpers ───────────────────────────────────────────────────────────

function mapStatus(raw: string): "completed" | "in-progress" | "need-help" | "failed" | "pending" {
  if (raw === "completed") return "completed";
  if (raw === "in_progress" || raw === "running") return "in-progress";
  if (raw === "awaiting_confirmation") return "need-help";
  if (raw === "error" || raw === "failed") return "failed";
  return "pending";
}

function StatusIcon({ status, size = "md" }: { status: string; size?: "sm" | "md" }) {
  const cls = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const mapped = mapStatus(status);
  if (mapped === "completed") return <CheckCircle2 className={`${cls} text-emerald-500`} />;
  if (mapped === "in-progress") return <CircleDotDashed className={`${cls} text-accent animate-spin`} style={{ animationDuration: "2s" }} />;
  if (mapped === "need-help") return <CircleAlert className={`${cls} text-amber-500`} />;
  if (mapped === "failed") return <CircleX className={`${cls} text-red-500`} />;
  return <Circle className={`${cls} text-slate-300`} />;
}

function statusBadgeClass(status: string): string {
  const mapped = mapStatus(status);
  if (mapped === "completed") return "bg-emerald-50 text-emerald-700";
  if (mapped === "in-progress") return "bg-blue-50 text-accent";
  if (mapped === "need-help") return "bg-amber-50 text-amber-700";
  if (mapped === "failed") return "bg-red-50 text-red-700";
  return "bg-slate-100 text-slate-500";
}

function statusLabel(status: string): string {
  const mapped = mapStatus(status);
  if (mapped === "in-progress") return "running";
  if (mapped === "need-help") return "awaiting";
  return mapped;
}

// ─── motion variants ──────────────────────────────────────────────────────────

const rowVariants = {
  hidden: { opacity: 0, y: -4 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 500, damping: 30 },
  },
  exit: { opacity: 0, y: -4, transition: { duration: 0.15 } },
};

const argListVariants = {
  hidden: { height: 0, opacity: 0, overflow: "hidden" },
  visible: {
    height: "auto",
    opacity: 1,
    overflow: "visible",
    transition: {
      duration: 0.25,
      staggerChildren: 0.04,
      when: "beforeChildren",
      ease: [0.2, 0.65, 0.3, 0.9],
    } as any,
  },
  exit: {
    height: 0,
    opacity: 0,
    overflow: "hidden",
    transition: { duration: 0.2, ease: [0.2, 0.65, 0.3, 0.9] } as any,
  },
};

const argRowVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: "spring" as const, stiffness: 500, damping: 25 },
  },
  exit: { opacity: 0, x: -8, transition: { duration: 0.12 } },
};

// ─── props ────────────────────────────────────────────────────────────────────

interface LiveAgentPlanProps {
  traces: AgentToolTrace[];
  isResponding?: boolean;
  toolSteps?: number;
  defaultCollapsed?: boolean;
}

// ─── component ────────────────────────────────────────────────────────────────

export default function LiveAgentPlan({
  traces,
  isResponding = false,
  toolSteps = 0,
  defaultCollapsed = false,
}: LiveAgentPlanProps) {
  const visibleTraces = traces.slice(0, toolSteps > 0 ? toolSteps : traces.length);
  const [expandedTraces, setExpandedTraces] = useState<string[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  useEffect(() => {
    setIsCollapsed(defaultCollapsed);
  }, [defaultCollapsed]);

  function toggleExpand(id: string) {
    setExpandedTraces((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  if (visibleTraces.length === 0 && !isResponding) return null;

  const completedCount = visibleTraces.filter((t) => mapStatus(t.status) === "completed").length;
  const totalCount = visibleTraces.length;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm h-full flex flex-col min-h-0">
      {/* Header (Clickable to collapse/expand) */}
      <div
        onClick={() => setIsCollapsed((prev) => !prev)}
        className={`flex flex-shrink-0 cursor-pointer items-center justify-between gap-3 px-4 py-3 bg-slate-50/50 hover:bg-slate-100/50 transition-colors select-none ${
          isCollapsed ? "" : "border-b border-slate-100"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 place-items-center rounded-xl bg-blue-50">
            {isResponding ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin text-accent" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
            )}
          </div>
          <div>
            <div className="text-[13px] font-semibold text-slate-800">
              {isResponding ? "Agent running tools…" : "Tool activity"}
            </div>
            <div className="text-[10px] text-slate-400">
              {isResponding
                ? "Executing step by step…"
                : `${completedCount} of ${totalCount} steps completed`}
            </div>
          </div>
        </div>

        {/* Mini progress bar and Chevron */}
        <div className="flex items-center gap-3">
          {totalCount > 0 && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                <motion.div
                  className="h-full rounded-full bg-accent"
                  initial={{ width: 0 }}
                  animate={{ width: `${(completedCount / totalCount) * 100}%` }}
                  transition={{ duration: 0.4, ease: [0.2, 0.65, 0.3, 0.9] }}
                />
              </div>
              <span className="text-[10px] font-bold tabular-nums text-slate-400">
                {completedCount}/{totalCount}
              </span>
            </div>
          )}
          <ChevronDown
            className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
              isCollapsed ? "" : "rotate-180"
            }`}
          />
        </div>
      </div>

      {/* Trace list with Collapsible Animation */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.2, 0.65, 0.3, 0.9] }}
            className="overflow-hidden"
          >
            <LayoutGroup>
              <div className="p-3 overflow-y-auto flex-1 min-h-0 max-h-[350px]">
                {isResponding && visibleTraces.length === 0 && (
                  <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-xs text-slate-500">
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin text-accent" />
                    Waiting for first tool step…
                  </div>
                )}

                <ul className="space-y-1">
                  {visibleTraces.map((trace, index) => {
                    const isExpanded = expandedTraces.includes(trace.id);
                    const argEntries = Object.entries(trace.arguments || {});
                    const resultEntries = Object.entries(trace.result || {}).filter(
                      ([, v]) => v !== null && v !== undefined && v !== ""
                    );
                    const isActive = mapStatus(trace.status) === "in-progress";

                    return (
                      <motion.li
                        key={trace.id}
                        variants={rowVariants}
                        initial="hidden"
                        animate="visible"
                        layout
                      >
                        {/* ── Trace row ── */}
                        <motion.div
                          className="group flex cursor-pointer items-center rounded-xl px-2 py-1.5 transition-colors"
                          whileHover={{ backgroundColor: "rgba(0,0,0,0.02)" }}
                          onClick={() => toggleExpand(trace.id)}
                          layout
                        >
                          {/* Step number + icon */}
                          <div className="mr-3 flex flex-col items-center gap-1 shrink-0">
                            <motion.div
                              whileTap={{ scale: 0.9 }}
                              whileHover={{ scale: 1.12 }}
                            >
                              <AnimatePresence mode="wait">
                                <motion.div
                                  key={trace.status}
                                  initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
                                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                  exit={{ opacity: 0, scale: 0.8, rotate: 10 }}
                                  transition={{ duration: 0.18, ease: [0.2, 0.65, 0.3, 0.9] }}
                                >
                                  <StatusIcon status={trace.status} />
                                </motion.div>
                              </AnimatePresence>
                            </motion.div>
                            {/* Connector line to next */}
                            {index < visibleTraces.length - 1 && (
                              <div className="h-2 w-px bg-slate-200" />
                            )}
                          </div>

                          {/* Title + badges */}
                          <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="text-[9px] font-bold tabular-nums text-slate-355">
                                #{index + 1}
                              </span>
                              <span
                                className={`truncate text-xs font-medium ${
                                  mapStatus(trace.status) === "completed"
                                    ? "text-slate-400 line-through"
                                    : "text-slate-800"
                                }`}
                              >
                                {trace.tool_name}
                              </span>
                            </div>

                            <div className="flex shrink-0 items-center gap-1.5">
                              {isActive && (
                                <motion.div
                                  animate={{ opacity: [1, 0.4, 1] }}
                                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                                  className="h-1.5 w-1.5 rounded-full bg-accent"
                                />
                              )}
                              <motion.span
                                key={trace.status}
                                className={`rounded-full px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.1em] ${statusBadgeClass(
                                  trace.status
                                )}`}
                                initial={{ scale: 1 }}
                                animate={{ scale: [1, 1.08, 1] }}
                                transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
                              >
                                {statusLabel(trace.status)}
                              </motion.span>
                            </div>
                          </div>
                        </motion.div>

                        {/* ── Expanded: arguments + result ── */}
                        <AnimatePresence mode="wait">
                          {isExpanded && (
                            <motion.div
                              className="relative ml-4 overflow-hidden"
                              variants={argListVariants}
                              initial="hidden"
                              animate="visible"
                              exit="exit"
                              layout
                            >
                              {/* Dashed connecting line */}
                              <div className="absolute bottom-2 left-[8px] top-0 border-l-2 border-dashed border-slate-250" />

                              <ul className="mb-2 ml-3 mt-1 space-y-0.5">
                                {/* Arguments */}
                                {argEntries.length > 0 && (
                                  <>
                                    <motion.li
                                      variants={argRowVariants}
                                      className="pl-5 pb-1 text-[8px] font-bold uppercase tracking-[0.14em] text-slate-400"
                                    >
                                      Arguments
                                    </motion.li>
                                    {argEntries.map(([key, val]) => (
                                      <motion.li
                                        key={`arg-${key}`}
                                        variants={argRowVariants}
                                        className="group flex flex-col rounded-lg py-0.5 pl-5"
                                        layout
                                      >
                                        <motion.div
                                          className="flex items-start gap-2 rounded-lg p-1.5"
                                          whileHover={{ backgroundColor: "rgba(0,0,0,0.02)" }}
                                        >
                                          <span className="mt-0.5 shrink-0 text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400 min-w-[70px]">
                                            {key.replaceAll("_", " ")}
                                          </span>
                                          <span className="break-all text-[10px] text-slate-650 leading-relaxed">
                                            {typeof val === "object" ? JSON.stringify(val) : String(val)}
                                          </span>
                                        </motion.div>
                                      </motion.li>
                                    ))}
                                  </>
                                )}

                                {/* Result */}
                                {resultEntries.length > 0 && (
                                  <>
                                    <motion.li
                                      variants={argRowVariants}
                                      className="pl-5 pb-1 pt-2 text-[8px] font-bold uppercase tracking-[0.14em] text-slate-400"
                                    >
                                      Result
                                    </motion.li>
                                    {resultEntries.slice(0, 6).map(([key, val]) => (
                                      <motion.li
                                        key={`res-${key}`}
                                        variants={argRowVariants}
                                        className="group flex flex-col rounded-lg py-0.5 pl-5"
                                        layout
                                      >
                                        <motion.div
                                          className="flex items-start gap-2 rounded-lg p-1.5"
                                          whileHover={{ backgroundColor: "rgba(0,0,0,0.02)" }}
                                        >
                                          <span className="mt-0.5 shrink-0 text-[9px] font-semibold uppercase tracking-[0.1em] text-emerald-500 min-w-[70px]">
                                            {key.replaceAll("_", " ")}
                                          </span>
                                          <span className="break-all text-[10px] text-slate-650 leading-relaxed font-sans">
                                            {typeof val === "object"
                                              ? JSON.stringify(val).slice(0, 200)
                                              : String(val).slice(0, 200)}
                                            {JSON.stringify(val).length > 200 && "…"}
                                          </span>
                                        </motion.div>
                                      </motion.li>
                                    ))}
                                    {resultEntries.length > 6 && (
                                      <motion.li
                                        variants={argRowVariants}
                                        className="pl-5 text-[9px] text-slate-400"
                                      >
                                        +{resultEntries.length - 6} more fields
                                      </motion.li>
                                    )}
                                  </>
                                )}

                                {argEntries.length === 0 && resultEntries.length === 0 && (
                                  <motion.li
                                    variants={argRowVariants}
                                    className="pl-5 text-[9px] text-slate-400"
                                  >
                                    No arguments or result data.
                                  </motion.li>
                                )}
                              </ul>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.li>
                    );
                  })}
                </ul>
              </div>
            </LayoutGroup>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
