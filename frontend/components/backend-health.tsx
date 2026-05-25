"use client";

import { useEffect, useState } from "react";
import { getHealth } from "@/lib/api";

export function BackendHealth() {
  const [state, setState] = useState<{
    status: "loading" | "online" | "offline";
    detail: string;
  }>({
    status: "loading",
    detail: "Checking SSH tunnel and FastAPI health endpoint...",
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const health = await getHealth();
        if (!cancelled) {
          setState({
            status: "online",
            detail: `${health.provider} · ${health.llm_mode} · ${health.model}`,
          });
        }
      } catch {
        if (!cancelled) {
          setState({
            status: "offline",
            detail: "Backend unavailable. Demo mode remains ready.",
          });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const tone =
    state.status === "online"
      ? "bg-emerald-50 text-emerald-700"
      : state.status === "offline"
        ? "bg-amber-50 text-amber-700"
        : "bg-slate-100 text-slate-600";

  return (
    <div className={`rounded-[1.25rem] border border-slate-200 p-4 ${tone}`}>
      <div className="text-xs uppercase tracking-[0.2em]">Backend status</div>
      <div className="mt-3 font-heading text-xl font-extrabold">
        {state.status === "online" ? "Connected" : state.status === "offline" ? "Demo fallback" : "Checking"}
      </div>
      <p className="mt-2 text-[13px] leading-6">{state.detail}</p>
    </div>
  );
}
