"use client";

import { setAuthToken } from "@/lib/session";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

function ChutesAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    const error = searchParams.get("error");

    if (token) {
      setAuthToken(token);
      router.replace("/jobs");
      return;
    }

    const query = error ? `?error=${encodeURIComponent(error)}` : "?error=Chutes login failed.";
    router.replace(`/auth/login${query}`);
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eaeff7] px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-[0_4px_32px_rgba(15,23,42,0.08)]">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-accent" />
        <h1 className="font-heading text-2xl font-extrabold text-slate-950">Completing Chutes sign-in</h1>
        <p className="mt-2 text-sm text-slate-500">Finalizing your Jobest session and redirecting to the dashboard.</p>
      </div>
    </div>
  );
}

export default function ChutesAuthCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#eaeff7]" />}>
      <ChutesAuthCallbackContent />
    </Suspense>
  );
}
