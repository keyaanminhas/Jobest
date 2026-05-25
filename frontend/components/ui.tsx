"use client";

import Link from "next/link";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn, formatScore } from "@/lib/utils";

export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-slate-200 bg-white p-4 shadow-sm", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title ? <h2 className="font-heading text-[1.05rem] font-bold text-slate-950">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-[13px] leading-6 text-slate-500">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  accent = "blue",
}: {
  label: string;
  value: string;
  detail: string;
  accent?: "blue" | "green" | "amber" | "violet";
}) {
  const accents = {
    blue: "bg-blue-50 text-accent",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={cn("mb-3 inline-flex rounded-xl px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]", accents[accent])}>
        {label}
      </div>
      <div className="font-heading text-[44px] font-extrabold text-slate-950">{value}</div>
      <p className="mt-2 text-[13px] leading-6 text-slate-500">{detail}</p>
    </div>
  );
}

export function PrimaryButton({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center rounded-xl bg-accent px-5 py-3 text-[14px] font-semibold text-white transition hover:bg-blue-700",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function SecondaryButton({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center rounded-xl border border-accent bg-white px-5 py-3 text-[14px] font-semibold text-accent transition hover:bg-blue-50",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status.toLowerCase().includes("error")
      ? "bg-red-50 text-red-600"
      : status.toLowerCase().includes("warning")
        ? "bg-amber-50 text-amber-600"
        : status.toLowerCase().includes("progress")
          ? "bg-blue-50 text-accent"
          : "bg-emerald-50 text-emerald-600";
  return <span className={cn("rounded-full px-3 py-1 text-[12px] font-semibold", tone)}>{status}</span>;
}

export function RecommendationBadge({ recommendation }: { recommendation: string }) {
  const tone =
    recommendation === "Strong Shortlist"
      ? "bg-emerald-50 text-emerald-700"
      : recommendation === "Shortlist"
        ? "bg-green-50 text-green-700"
        : recommendation === "Maybe"
          ? "bg-amber-50 text-amber-700"
          : "bg-red-50 text-red-700";

  return <span className={cn("rounded-full px-3 py-1 text-[12px] font-semibold", tone)}>{recommendation}</span>;
}

export function ScoreRing({ score }: { score: number }) {
  const angle = Math.round((score / 100) * 360);
  return (
    <div
      className="grid h-14 w-14 place-items-center rounded-full"
      style={{ background: `conic-gradient(#22c55e ${angle}deg, #e5e7eb 0deg)` }}
    >
      <div className="grid h-10 w-10 place-items-center rounded-full bg-white text-[11px] font-bold text-slate-900">{formatScore(score)}</div>
    </div>
  );
}

export function JsonAccordion({ label, value }: { label: string; value: unknown }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left text-sm font-semibold text-slate-700"
        onClick={() => setOpen((current) => !current)}
      >
        <span>{label}</span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open ? <pre className="overflow-x-auto px-4 pb-4 text-xs leading-6 text-slate-600">{JSON.stringify(value, null, 2)}</pre> : null}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <div className="font-heading text-2xl font-bold text-slate-900">{title}</div>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-500">{body}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
