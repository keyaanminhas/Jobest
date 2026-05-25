"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BriefcaseBusiness,
  ChartColumnBig,
  ChevronDown,
  CircleHelp,
  LayoutDashboard,
  Menu,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  SunMedium,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/runs/new", label: "Hiring Runs", icon: BriefcaseBusiness },
  { href: `/runs/demo-sales-engineer-2025/shortlist`, label: "Shortlist", icon: ShieldCheck },
  { href: `/runs/demo-sales-engineer-2025/report`, label: "Reports", icon: ChartColumnBig },
  { href: "#", label: "Candidates", icon: Users, disabled: true },
  { href: "#", label: "Settings", icon: Settings, disabled: true },
];

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#f7f9fc]">
      <div className="mx-auto flex max-w-[1720px]">
        <aside className="hidden min-h-screen w-[240px] shrink-0 border-r border-slate-200 bg-white px-4 py-6 md:flex md:flex-col">
          <div className="px-3">
            <div className="font-heading text-[2.9rem] font-extrabold leading-none tracking-tight text-accent">Jobest</div>
            <p className="mt-2 text-[13px] leading-6 text-slate-600">
              Evidence-backed shortlisting powered by orchestrated AI agents.
            </p>
          </div>

          <nav className="mt-6 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active =
                item.href !== "#" && (pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href)));
              if (item.disabled) {
                return (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 text-[17px] font-medium text-slate-600 opacity-55"
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </div>
                );
              }

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-[17px] font-medium transition",
                    active ? "bg-blue-50 text-accent" : "text-slate-600 hover:bg-slate-50 hover:text-ink",
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto rounded-2xl border border-slate-200 bg-[#fbfcfe] p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Plan</div>
            <div className="mt-2 flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-900">Enterprise</div>
                <div className="text-xs text-slate-500">Seat usage 24 / 50</div>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Active</span>
            </div>
            <div className="mt-4 h-2 rounded-full bg-slate-200">
              <div className="h-2 w-1/2 rounded-full bg-accent" />
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <CircleHelp className="h-4 w-4 text-accent" />
              Need help?
            </div>
            <div className="mt-2 text-xs text-slate-500">Visit Help Center</div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="border-b border-slate-200 bg-white px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-[300px] flex-1 items-center gap-3">
                <button className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500">
                  <Menu className="h-5 w-5" />
                </button>
                <div className="flex h-11 w-full max-w-[740px] items-center rounded-xl border border-slate-200 px-3">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    readOnly
                    value="Search candidates, hiring runs, roles, skills..."
                    className="ml-2 w-full border-0 bg-transparent text-[17px] text-slate-500 outline-none"
                  />
                  <span className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500">Ctrl K</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white">
                  <Plus className="h-5 w-5" />
                </button>
                <button className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-600">
                  <Bell className="h-5 w-5" />
                  <span className="absolute right-0 top-0 h-4 w-4 rounded-full bg-red-500 text-[10px] text-white">3</span>
                </button>
                <button className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-600">
                  <SunMedium className="h-5 w-5" />
                </button>
                <div className="hidden items-center gap-3 lg:flex">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">AS</div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Arjun Singh</div>
                    <div className="text-xs text-slate-500">Talent Partner</div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mb-6 flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
                    <Sparkles className="h-4 w-4 text-accent" />
                    Multi-agent recruitment intelligence
                  </div>
                  <h1 className="font-heading text-[48px] font-extrabold tracking-tight text-slate-950">{title}</h1>
                  <p className="mt-2 max-w-3xl text-[14px] leading-6 text-slate-600">{subtitle}</p>
                </div>
                <div className="flex items-center gap-3">{actions}</div>
              </div>
              {children}
              <footer className="mt-8 border-t border-slate-100 pt-4">
                <div className="flex flex-col gap-4 text-[12px] text-slate-500 md:flex-row md:items-center md:justify-between">
                  <p className="max-w-2xl leading-6">
                    Decision-support for recruiters using multi-agent evidence review, deterministic scoring, and bias-aware hiring workflows.
                  </p>
                  <div className="flex flex-wrap gap-x-6 gap-y-2">
                    <span>Frontend: Next.js + Tailwind</span>
                    <span>Backend: FastAPI over SSH tunnel</span>
                    <span>Mode: Demo-ready</span>
                  </div>
                </div>
              </footer>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
