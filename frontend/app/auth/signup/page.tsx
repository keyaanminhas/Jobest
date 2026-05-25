"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { getChutesAuthUrl, signup } from "@/lib/api";
import { Eye, EyeOff, ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";

const perks = [
  "Role-based CV triage and final ranking on one score scale",
  "Candidate-level analysis with visible stage timeline",
  "Professional report pages with print-ready PDF export",
  "Explainable scoring — every criterion has a written trail",
];

export default function SignupPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const passwordStrength =
    password.length === 0 ? null
    : password.length < 6 ? "weak"
    : password.length < 10 ? "fair"
    : "strong";

  const strengthConfig = {
    weak:   { width: "w-1/3",  color: "bg-red-400",    label: "Too short" },
    fair:   { width: "w-2/3",  color: "bg-amber-400",  label: "Fair" },
    strong: { width: "w-full", color: "bg-mint",        label: "Strong" },
  };

  function submit() {
    setError("");
    startTransition(async () => {
      try {
        await signup(email.trim(), password, fullName.trim() || undefined);
        router.replace("/jobs");
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Signup failed.");
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
              Set up your workspace in seconds. Your first hiring run — JD to shortlist — takes under 20 minutes.
            </p>

            {/* Perks list */}
            <ul className="mt-8 space-y-3">
              {perks.map((p) => (
                <li key={p} className="flex items-start gap-3 text-[13.5px] leading-6 text-slate-600">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  {p}
                </li>
              ))}
            </ul>
          </div>

          {/* Free plan callout */}
          <div className="relative mt-10 rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">
              Free to start
            </div>
            <p className="mt-1 text-[13px] leading-6 text-slate-500">
              No credit card required. Upgrade for team seats and advanced export when you&apos;re ready.
            </p>
          </div>
        </div>

        {/* ── Right: form panel ── */}
        <div className="flex flex-col justify-center bg-white px-8 py-10 sm:px-10">

          <div className="mb-7">
            <h1 className="font-heading text-[1.75rem] font-extrabold tracking-tight text-slate-950">
              Create account
            </h1>
            <p className="mt-1.5 text-[13.5px] leading-6 text-slate-500">
              Set up your internal recruiting workspace.
            </p>
          </div>

          <form
            className="space-y-4"
            onSubmit={(e) => { e.preventDefault(); submit(); }}
          >
            <a
              href={getChutesAuthUrl()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-[14px] font-semibold text-slate-700 transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50"
            >
              <ShieldCheck className="h-4 w-4 text-accent" />
              Continue with Chutes
            </a>

            <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              Or create a local account
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="fullName" className="block text-[13px] font-semibold text-slate-700">
                Full name
              </label>
              <input
                id="fullName"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Arjun Singh"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition-all duration-150 focus:border-accent focus:bg-white focus:ring-2 focus:ring-accent/10"
              />
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
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
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

              {passwordStrength ? (
                <div className="pt-0.5">
                  <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${strengthConfig[passwordStrength].color} ${strengthConfig[passwordStrength].width}`}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {strengthConfig[passwordStrength].label}
                  </p>
                </div>
              ) : null}
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
                  Creating account…
                </>
              ) : (
                <>
                  Create account
                  <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          <p className="mt-5 text-[13px] text-slate-500">
            Already have an account?{" "}
            <Link href="/auth/login" className="font-semibold text-accent hover:underline">
              Sign in
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
