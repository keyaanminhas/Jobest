"use client";

import { QrCode } from "@/components/qr-code";
import { getPublicJobPosting } from "@/lib/api";
import { PublicJobPosting } from "@/lib/types";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function PublicApplyPrintPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [job, setJob] = useState<PublicJobPosting | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const row = await getPublicJobPosting(token);
        if (!cancelled) {
          setJob(row);
          setError("");
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Job posting not found.");
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const publicUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/apply/${token}`;
  }, [token]);

  return (
    <div className="min-h-screen bg-white px-6 py-8">
      <div className="mx-auto max-w-3xl rounded-[28px] border border-slate-200 bg-white p-8 shadow-[0_16px_48px_rgba(15,23,42,0.08)] print:shadow-none">
        <div className="print:hidden mb-5 flex justify-end">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Print / Save as PDF
          </button>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(135deg,#eef4ff_0%,#ffffff_58%,#f8fbff_100%)] p-6">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Jobest quick apply</div>
          <h1 className="mt-2 font-heading text-3xl font-extrabold tracking-tight text-slate-950">{job?.title || "Loading role..."}</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Scan the QR code or open the link below to submit your application with your contact details and a PDF resume.
          </p>
        </div>

        {error ? <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <div className="mt-8 grid gap-8 md:grid-cols-[250px_1fr] md:items-center">
          <div className="flex justify-center">
            <QrCode value={publicUrl} size={220} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Public application link</div>
            <div className="mt-2 break-all text-sm leading-7 text-slate-700">{publicUrl}</div>
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">What applicants need</div>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li>First name and last name</li>
                <li>Phone number and email</li>
                <li>Optional ID or reference text</li>
                <li>A text-based PDF resume</li>
              </ul>
            </div>
            {job?.summary ? <p className="mt-5 text-sm leading-7 text-slate-600">{job.summary}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
