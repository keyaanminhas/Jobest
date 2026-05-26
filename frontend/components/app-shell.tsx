"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  BriefcaseBusiness,
  ChartColumnBig,
  CircleHelp,
  LayoutDashboard,
  LogOut,
  Plus,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { getCurrentUser, getNotifications, logout, markAllNotificationsRead, markNotificationRead } from "@/lib/api";
import { NotificationItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/jobs", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs/current", label: "Current Postings", icon: BriefcaseBusiness },
  { href: "/jobs/new", label: "New Posting", icon: BriefcaseBusiness },
  { href: "/candidates", label: "Candidates", icon: Users },
  { href: "/reports", label: "Reports", icon: ChartColumnBig },
];

function isNavItemActive(pathname: string, href: string) {
  if (href === "/jobs") {
    return pathname === "/jobs";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function formatMalaysiaNotificationTime(value: string) {
  const normalizedValue =
    /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`;
  return new Intl.DateTimeFormat("en-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(normalizedValue));
}

function initialsFromName(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

export function AppShell({
  title,
  subtitle,
  actions,
  children,
  noPageHeader,
}: {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  noPageHeader?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [displayName, setDisplayName] = useState("Recruiter");
  const [searchQuery, setSearchQuery] = useState("");
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const notificationPanelRef = useRef<HTMLDivElement | null>(null);

  function submitSearch() {
    const query = searchQuery.trim();
    if (!query) {
      router.push("/candidates");
      return;
    }
    router.push(`/candidates?q=${encodeURIComponent(query)}`);
  }

  useEffect(() => {
    let cancelled = false;
    async function loadUser() {
      try {
        const user = await getCurrentUser();
        if (cancelled) return;
        setDisplayName(user.full_name || user.email);
      } catch {
        if (cancelled) return;
      }
    }
    void loadUser();
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadNotifications() {
    setNotificationLoading(true);
    try {
      const response = await getNotifications();
      setNotifications(response.items);
      setUnreadCount(response.unread_count);
    } catch {
      // Keep UI non-blocking if notifications fail.
    } finally {
      setNotificationLoading(false);
    }
  }

  useEffect(() => {
    void loadNotifications();
    const handle = setInterval(() => {
      void loadNotifications();
    }, 5000);
    return () => clearInterval(handle);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!notificationPanelRef.current) return;
      if (!notificationPanelRef.current.contains(event.target as Node)) {
        setNotificationOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function hrefForNotification(item: NotificationItem): string {
    if (item.notification_type === "pipeline_completed" && item.candidate_id) {
      return `/candidates/${item.candidate_id}/report`;
    }
    if (item.candidate_id) {
      return `/candidates/${item.candidate_id}`;
    }
    return "/reports";
  }

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
      if (event.key === "Escape" && document.activeElement === searchInputRef.current) {
        setSearchQuery("");
        searchInputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div className="min-h-screen bg-[#f7f9fc]">
      <div className="mx-auto flex max-w-[1720px]">
        <aside className="hidden min-h-screen w-[250px] shrink-0 border-r border-slate-200 bg-white px-4 py-6 md:flex md:flex-col">
          <div className="px-3">
            <div className="font-heading text-[2.9rem] font-extrabold leading-none tracking-tight text-accent">Jobest</div>
            <p className="mt-2 text-[13px] leading-6 text-slate-600">
              Evidence-backed shortlisting powered by orchestrated AI agents.
            </p>
          </div>

          <nav className="mt-6 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isNavItemActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
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

          <div className="mt-auto rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-blue-50 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Workspace Health</div>
            <div className="mt-2 flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-900">Enterprise Suite</div>
                <div className="text-xs text-slate-500">Seat usage 24 / 50 active</div>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Healthy</span>
            </div>
            <div className="mt-4 h-2 rounded-full bg-slate-200">
              <div className="h-2 w-[62%] rounded-full bg-accent" />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
              <span>Pipeline SLA</span>
              <span className="font-semibold text-slate-700">96.4%</span>
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
          <div className="border-b border-slate-200 bg-white px-6 py-4 print:hidden">
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">

              {/* Left: dashboard home + search */}
              <div className="flex min-w-0 items-center gap-3">
                <Link
                  href="/jobs"
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors duration-150 hover:bg-slate-50 hover:text-ink"
                  title="Dashboard"
                >
                  <LayoutDashboard className="h-4 w-4" />
                </Link>
              </div>

              <div className="flex justify-center">
                <div className="flex h-10 w-full max-w-[720px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 shadow-sm transition-all duration-150 focus-within:border-accent focus-within:bg-white focus-within:ring-2 focus-within:ring-accent/10">
                  <Search className="h-4 w-4 shrink-0 text-slate-400" />
                  <input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        submitSearch();
                      }
                    }}
                    placeholder="Search candidates, roles, skills…"
                    className="w-full border-0 bg-transparent text-[14px] text-slate-700 placeholder:text-slate-400 outline-none"
                  />
                  <button
                    type="button"
                    onClick={submitSearch}
                    title="Search (Ctrl+K)"
                    className="flex shrink-0 items-center gap-0.5 opacity-60 transition-opacity hover:opacity-100"
                  >
                    <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500 shadow-sm">Ctrl</kbd>
                    <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500 shadow-sm">K</kbd>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/jobs/new"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent text-white"
                  title="Create posting"
                >
                  <Plus className="h-5 w-5" />
                </Link>
                <div className="relative" ref={notificationPanelRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setNotificationOpen((current) => !current);
                      void loadNotifications();
                    }}
                    className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-600"
                    title="Notifications"
                  >
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 ? (
                      <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    ) : null}
                  </button>
                  {notificationOpen ? (
                    <div className="absolute right-0 z-40 mt-2 w-[380px] max-w-[92vw] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-sm font-semibold text-slate-900">Notifications</div>
                        <button
                          type="button"
                          onClick={async () => {
                            await markAllNotificationsRead();
                            await loadNotifications();
                          }}
                          className="text-xs font-semibold text-accent hover:underline"
                        >
                          Mark all as read
                        </button>
                      </div>
                      <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
                        {notificationLoading ? <div className="p-2 text-xs text-slate-500">Loading...</div> : null}
                        {!notificationLoading && notifications.length === 0 ? (
                          <div className="p-2 text-xs text-slate-500">No notifications yet.</div>
                        ) : null}
                        {notifications.map((item) => (
                          <Link
                            key={item.id}
                            href={hrefForNotification(item)}
                            onClick={async () => {
                              if (!item.is_read) {
                                await markNotificationRead(item.id);
                                await loadNotifications();
                              }
                              setNotificationOpen(false);
                            }}
                            className={cn(
                              "block rounded-xl border px-3 py-2 transition",
                              item.is_read ? "border-slate-200 bg-slate-50" : "border-blue-200 bg-blue-50",
                            )}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="text-sm font-semibold text-slate-900">{item.title}</div>
                              <div className="text-[10px] text-slate-500">{formatMalaysiaNotificationTime(item.created_at)}</div>
                            </div>
                            <p className="mt-1 text-xs text-slate-600">{item.body}</p>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="hidden items-center gap-3 lg:flex">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                    {initialsFromName(displayName) || "JR"}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{displayName}</div>
                    <div className="text-xs text-slate-500">Recruiter Workspace</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      router.replace("/auth/login");
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-6">
            <div className={noPageHeader ? "" : "rounded-2xl border border-slate-200 bg-white p-6"}>
              {!noPageHeader && (
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
              )}
              {children}
              {!noPageHeader && <footer className="mt-8 border-t border-slate-100 pt-4 print:hidden">
                <div className="flex flex-col gap-4 text-[12px] text-slate-500 md:flex-row md:items-center md:justify-between">
                  <p className="max-w-2xl leading-6">
                    Decision-support for recruiters using multi-agent evidence review, deterministic scoring, and database-backed workflow state.
                  </p>
                  <div className="flex flex-wrap gap-x-6 gap-y-2">
                    <span>Frontend: Next.js + Tailwind</span>
                    <span>Backend: FastAPI + SQLite</span>
                    <span>Mode: Org MVP</span>
                  </div>
                </div>
              </footer>}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
