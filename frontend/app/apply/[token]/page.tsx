"use client";

import { QrCode } from "@/components/qr-code";
import { applyToPublicJob, getPublicJobPosting } from "@/lib/api";
import { PublicJobPosting } from "@/lib/types";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { Printer, Upload, FileText, X } from "lucide-react";

function isPdfFile(file: File | null) {
  if (!file) return false;
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export default function PublicApplyPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [job, setJob] = useState<PublicJobPosting | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [externalIdText, setExternalIdText] = useState("");
  const [file, setFile] = useState<File | null>(null);

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
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Please attach a PDF resume.");
      return;
    }
    if (!isPdfFile(file)) {
      setError("Only PDF resumes are allowed.");
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const response = await applyToPublicJob(token, {
        firstName,
        lastName,
        phoneNumber,
        email,
        externalIdText,
        file,
      });
      setSuccess(`${response.message} ${response.applicant_name}, your application for ${response.job_title} has been submitted successfully.`);
      setFirstName("");
      setLastName("");
      setPhoneNumber("");
      setEmail("");
      setExternalIdText("");
      setFile(null);
      const input = document.getElementById("cv-pdf") as HTMLInputElement | null;
      if (input) input.value = "";
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#eef3fb] px-2 py-6 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-2xl sm:rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_80px_rgba(15,23,42,0.12)]">
          <div className="rounded-t-2xl sm:rounded-t-[28px] border-b border-slate-200 bg-[linear-gradient(135deg,#eef4ff_0%,#ffffff_55%,#f8fbff_100%)] px-4 py-5 sm:px-8">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Jobest public application</div>
            <h1 className="mt-2 font-heading text-3xl font-extrabold tracking-tight text-slate-950">{job?.title || "Loading role..."}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              {job?.summary || "Please wait while we load this application link."}
            </p>
            <div className="mt-4 flex flex-wrap gap-3 items-center">
              {job?.company_priority ? (
                <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  Priority: {job.company_priority}
                </div>
              ) : null}
              <Link
                href={`/apply/${token}/print`}
                target="_blank"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Printable share page</span>
              </Link>
            </div>
          </div>

          <div className="grid gap-6 px-4 py-6 sm:px-8 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="hidden lg:block rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Apply by phone scan or browser</div>
              <div className="mt-4 flex justify-center">
                <QrCode value={typeof window === "undefined" ? "" : window.location.href} size={180} />
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                Upload a text-based PDF resume. Jobest will extract your resume and securely create your application record immediately.
              </p>
              <div className="mt-5 text-xs text-slate-500">
                PDF only. This link is intended for direct applicant submission.
              </div>
              <Link
                href={`/apply/${token}/print`}
                target="_blank"
                className="mt-5 inline-flex rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Open printable share page
              </Link>
            </div>

            {!job?.applications_open && !loading ? (
              <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-6">
                <div className="rounded-xl sm:rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                  {job?.closed_message || "The application form has been closed."}
                </div>
              </div>
            ) : (
            <form onSubmit={submit} className="space-y-4 rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-4 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm">
                  <div className="mb-1 font-semibold text-slate-700">First name</div>
                  <input value={firstName} onChange={(event) => setFirstName(event.target.value)} required className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-accent focus:bg-white" />
                </label>
                <label className="text-sm">
                  <div className="mb-1 font-semibold text-slate-700">Last name</div>
                  <input value={lastName} onChange={(event) => setLastName(event.target.value)} required className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-accent focus:bg-white" />
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm">
                  <div className="mb-1 font-semibold text-slate-700">Phone number</div>
                  <input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} required className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-accent focus:bg-white" />
                </label>
                <label className="text-sm">
                  <div className="mb-1 font-semibold text-slate-700">Email</div>
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-accent focus:bg-white" />
                </label>
              </div>
              <label className="text-sm">
                <div className="mb-1 font-semibold text-slate-700">Optional ID / reference</div>
                <input value={externalIdText} onChange={(event) => setExternalIdText(event.target.value)} placeholder="Optional applicant or student ID" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-accent focus:bg-white" />
              </label>
              <div className="text-sm">
                <div className="mb-1 font-semibold text-slate-700">Resume PDF</div>
                <input
                  id="cv-pdf"
                  type="file"
                  accept="application/pdf,.pdf"
                  required
                  className="hidden"
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] || null;
                    if (nextFile && !isPdfFile(nextFile)) {
                      setFile(null);
                      setError("Only PDF resumes are allowed.");
                      event.target.value = "";
                      return;
                    }
                    setError("");
                    setFile(nextFile);
                  }}
                />
                {!file ? (
                  <div
                    onClick={() => document.getElementById("cv-pdf")?.click()}
                    className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-accent bg-slate-50 hover:bg-slate-50/50 rounded-xl p-5 cursor-pointer transition text-center"
                  >
                    <Upload className="w-6 h-6 text-slate-400 mb-2" />
                    <span className="font-semibold text-slate-700 text-sm">Click to upload resume</span>
                    <span className="text-xs text-slate-500 mt-1">PDF format only</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between border border-emerald-200 bg-emerald-50/50 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span className="text-sm font-medium text-emerald-800 truncate">{file.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null);
                        const input = document.getElementById("cv-pdf") as HTMLInputElement | null;
                        if (input) input.value = "";
                      }}
                      className="p-1 hover:bg-emerald-100 rounded-lg transition text-emerald-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {loading ? <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">Loading role details...</div> : null}
              {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
              {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

              <button
                type="submit"
                disabled={loading || submitting || !job}
                className="w-full sm:w-auto inline-flex justify-center rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Submitting..." : "Submit application"}
              </button>
            </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
