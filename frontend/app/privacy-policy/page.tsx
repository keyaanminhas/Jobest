"use client";

import { AppShell } from "@/components/app-shell";

export default function PrivacyPolicyPage() {
  return (
    <AppShell
      title="Privacy Policy"
      subtitle="How candidate and hiring data is handled within this Org MVP workflow."
    >
      <div className="space-y-6 text-sm leading-7 text-slate-700">
        <section>
          <h2 className="font-heading text-xl font-bold text-slate-900">1. Data Collected</h2>
          <p className="mt-2">
            The platform stores job postings, uploaded resumes, candidate analysis outputs, and report artifacts to support
            recruiter decision-making.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-bold text-slate-900">2. Processing Purpose</h2>
          <p className="mt-2">
            Data is processed to run multi-agent evidence review, deterministic scoring, and report generation for hiring workflows.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-bold text-slate-900">3. Storage</h2>
          <p className="mt-2">
            In Org MVP mode, workflow data is persisted in the configured database and is used strictly for internal recruitment operations.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-bold text-slate-900">4. External Links</h2>
          <p className="mt-2">
            Professional links provided in candidate materials may be accessed for validation signals where supported by site terms and technical constraints.
          </p>
        </section>

        <section>
          <h2 className="font-heading text-xl font-bold text-slate-900">5. Contact</h2>
          <p className="mt-2">
            For privacy-related requests, contact the hiring system administrators for this deployment.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
