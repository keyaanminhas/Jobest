"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
import { listHiringRuns } from "@/lib/api";
import { listRunsLocal } from "@/lib/storage";
import { HiringRunRecord } from "@/lib/types";

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
  const [demoMode, setDemoMode] = useState<boolean>(false);
  const [runs, setRuns] = useState<any[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>("");

  useEffect(() => {
    const isDemo = localStorage.getItem("jobest-demo-mode") === "true";
    setDemoMode(isDemo);

    async function loadData() {
      let fetchedRuns: any[] = [];
      try {
        fetchedRuns = await listHiringRuns();
      } catch (err) {
        fetchedRuns = listRunsLocal();
      }

      // If demo mode is active or we have no runs, inject the demo run as an option
      if (isDemo || fetchedRuns.length === 0) {
        if (!fetchedRuns.some((r) => r.id === "demo-sales-engineer-2025")) {
          fetchedRuns = [
            {
              id: "demo-sales-engineer-2025",
              title: "Senior Sales Engineer (Demo)",
              status: "completed",
              created_at: new Date().toISOString(),
              candidates: [],
            },
            ...fetchedRuns,
          ];
        }
      }

      setRuns(fetchedRuns);

      // Parse current run ID from URL
      const pathParts = pathname.split("/");
      const urlRunId =
        pathParts[1] === "runs" && pathParts[2] && pathParts[2] !== "new"
          ? pathParts[2]
          : null;

      let activeId = "";
      if (urlRunId) {
        activeId = urlRunId;
      } else {
        const storedId = localStorage.getItem("jobest-selected-run-id");
        if (storedId && fetchedRuns.some((r) => r.id === storedId)) {
          activeId = storedId;
        } else if (fetchedRuns.length > 0) {
          activeId = fetchedRuns[0].id;
        }
      }

      if (activeId) {
        setSelectedRunId(activeId);
        localStorage.setItem("jobest-selected-run-id", activeId);
      }
    }

    loadData();
  }, [pathname]);

  const toggleDemoMode = () => {
    const next = !demoMode;
    setDemoMode(next);
    localStorage.setItem("jobest-demo-mode", next ? "true" : "false");
    
    // Reset selected run if shifting out of demo mode
    if (!next) {
      localStorage.removeItem("jobest-selected-run-id");
    }
    
    // Always redirect to dashboard on demo toggle to reinitialize cleanly
    window.location.href = "/";
  };

  const handleRunChange = (newRunId: string) => {
    setSelectedRunId(newRunId);
    localStorage.setItem("jobest-selected-run-id", newRunId);

    const pathParts = pathname.split("/");
    if (pathParts[1] === "runs" && pathParts[2] && pathParts[2] !== "new") {
      const pageType = pathParts[3]; // "shortlist", "report", "pipeline", "candidates"
      if (pageType === "candidates") {
        window.location.href = `/runs/${newRunId}/shortlist`;
      } else if (pageType) {
        window.location.href = `/runs/${newRunId}/${pageType}`;
      } else {
        window.location.href = `/runs/${newRunId}/shortlist`;
      }
    } else {
      // Just reload dashboard/new run page to fetch the correct active data
      window.location.reload();
    }
  };

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/runs/new", label: "New Hiring Run", icon: Plus },
    ...(selectedRunId
      ? [
          { href: `/runs/${selectedRunId}/pipeline`, label: "Pipeline", icon: BriefcaseBusiness },
          { href: `/runs/${selectedRunId}/shortlist`, label: "Shortlist", icon: ShieldCheck },
          { href: `/runs/${selectedRunId}/report`, label: "Reports", icon: ChartColumnBig },
        ]
      : []),
    { href: "#", label: "Candidates", icon: Users, disabled: true },
    { href: "#", label: "Settings", icon: Settings, disabled: true },
  ];

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
                item.href !== "#" &&
                (pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href)));
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
                    active
                      ? "bg-blue-50 text-accent"
                      : "text-slate-600 hover:bg-slate-50 hover:text-ink"
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
                {/* Active Run Selector Dropdown */}
                {runs.length > 0 && (
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 bg-white shadow-sm">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Run:</span>
                    <select
                      value={selectedRunId}
                      onChange={(e) => handleRunChange(e.target.value)}
                      className="border-0 bg-transparent text-sm font-semibold text-slate-800 outline-none cursor-pointer max-w-[180px] lg:max-w-[240px] truncate"
                    >
                      {runs.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Demo Mode Switcher */}
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5 bg-slate-50 shadow-sm">
                  <span className="text-[12px] font-bold uppercase tracking-wider text-slate-500">Demo Mode</span>
                  <button
                    onClick={toggleDemoMode}
                    className={cn(
                      "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                      demoMode ? "bg-accent" : "bg-slate-300"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        demoMode ? "translate-x-4" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
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
                    <span>Backend: FastAPI + Agent Orch</span>
                    <span>Mode: {demoMode ? "Demo Mode" : "Live mode"}</span>
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
