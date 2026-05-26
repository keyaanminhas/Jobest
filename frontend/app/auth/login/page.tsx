"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useTransition } from "react";
import { getChutesAuthUrl, login } from "@/lib/api";
import { Eye, EyeOff, ArrowRight, CheckCircle2, Sparkles, ShieldCheck } from "lucide-react";

const features = [
  "11-stage multi-agent pipeline from JD to final report",
  "Deterministic scoring — no black-box AI rankings",
  "Evidence-backed shortlisting with per-criterion trails",
  "Real-time queue and progress tracking per candidate",
];

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const message = searchParams.get("error");
    if (message) {
      setError(message);
    }
  }, [searchParams]);

  function submit() {
    setError("");
    startTransition(async () => {
      try {
        await login(email.trim(), password);
        router.replace("/jobs");
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Login failed.");
      }
    });
  }

  return (
    <div className="min-h-screen bg-[#eaeff7] flex items-center justify-center px-4 py-10 sm:px-6">
      <div className="grid w-full max-w-[1100px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_32px_rgba(15,23,42,0.08)] lg:grid-cols-[1fr_1fr]">

        {/* ── Left: brand panel ── */}
        <div className="relative flex flex-col justify-between overflow-hidden border-b border-slate-100 bg-[#f4f7fb] p-8 sm:p-10 lg:border-b-0 lg:border-r lg:border-r-slate-200">

          {/* Faint dot grid */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.45]"
            style={{
              backgroundImage: "radial-gradient(circle, #cbd5e1 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          <div className="relative">
            {/* Brand badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-500 shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              Multi-agent recruitment AI
            </div>

            <h2 className="font-heading text-[2.4rem] font-extrabold leading-[1.1] tracking-tight text-slate-950">
              Jobest
            </h2>
            <p className="mt-3 max-w-[340px] text-[14px] leading-7 text-slate-500">
              Build role context once, triage hundreds of CVs, and surface only the candidates worth interviewing.
            </p>

            {/* Feature list */}
            <ul className="mt-8 space-y-3">
              {features.map((f) => (
                <li key={f} className="flex items-start gap-3 text-[13.5px] leading-6 text-slate-600">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Stats row */}
          <div className="relative mt-10 grid grid-cols-2 divide-x divide-slate-200 rounded-xl border border-slate-200 bg-white">
            <div className="p-4">
              <div className="font-heading text-3xl font-extrabold text-slate-950">11</div>
              <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">Agent stages</div>
            </div>
            <div className="p-4">
              <div className="font-heading text-3xl font-extrabold text-slate-950">0–100</div>
              <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">Score range</div>
            </div>
          </div>
        </div>

        {/* ── Right: form panel ── */}
        <div className="flex flex-col justify-center bg-white px-8 py-10 sm:px-10">

          <div className="mb-8">
            <h1 className="font-heading text-[1.75rem] font-extrabold tracking-tight text-slate-950">
              Sign in
            </h1>
            <p className="mt-1.5 text-[13.5px] leading-6 text-slate-500">
              Access your job postings, triage queue, and candidate reports.
            </p>
          </div>

          <form
            className="space-y-5"
            onSubmit={(e) => { e.preventDefault(); submit(); }}
          >
            <a
              href={getChutesAuthUrl()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-[14px] font-semibold text-slate-700 transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50"
            >
              <ShieldCheck className="h-4 w-4 text-accent" />
              Sign in with Chutes
            </a>

            <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              Or continue with email
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-[13px] font-semibold text-slate-700">
                Work email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/10"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-[13px] font-semibold text-slate-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-11 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-slate-400 transition-colors hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error ? (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] leading-5 text-red-700">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={pending || !email || !password}
              className="group flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-[14px] font-semibold text-white transition-colors duration-150 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-[13px] text-slate-500">
            No account?{" "}
            <Link href="/auth/signup" className="font-semibold text-accent hover:underline">
              Create one free
            </Link>
          </p>

          <div className="mt-10 border-t border-slate-100 pt-4">
            <p className="text-[11px] text-slate-400">
              Next.js · FastAPI · SQLite · Org MVP
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#eaeff7]" />}>
      <LoginPageContent />
    </Suspense>
  );
}
