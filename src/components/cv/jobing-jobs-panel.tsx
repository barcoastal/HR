"use client";

import { cn } from "@/lib/utils";
import { Briefcase, ExternalLink, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

type JobingJob = {
  id: number;
  title: string;
  start_date?: string;
  status?: string;
  applicants_count?: number;
  location?: string;
};

export function JobingJobsPanel() {
  const [jobs, setJobs] = useState<JobingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/platforms/jobing/jobs")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load jobs: ${res.status}`);
        const data = await res.json();
        const jobsList = Array.isArray(data) ? data : data.results || data.jobs || [];
        setJobs(jobsList);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
          Jobing Jobs
        </h2>
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading jobs...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
          Jobing Jobs
        </h2>
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (jobs.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Jobing Jobs ({jobs.length})
        </h2>
        <a
          href="https://pro.jobing.com/companies/141247/jobs"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
            "bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 transition-colors"
          )}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Manage on Jobing
        </a>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {jobs.map((job) => (
          <div
            key={job.id}
            className={cn(
              "rounded-xl p-4",
              "bg-[var(--color-surface)] border border-[var(--color-border)]"
            )}
          >
            <div className="flex items-start gap-2 mb-2">
              <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                <Briefcase className="h-4 w-4 text-orange-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                  {job.title}
                </p>
                {job.location && (
                  <p className="text-xs text-[var(--color-text-muted)] truncate">{job.location}</p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between mt-2">
              {job.start_date && (
                <span className="text-xs text-[var(--color-text-muted)]">
                  {new Date(job.start_date).toLocaleDateString()}
                </span>
              )}
              {job.applicants_count !== undefined && (
                <span className="text-xs font-medium text-orange-400">
                  {job.applicants_count} applicant{job.applicants_count !== 1 ? "s" : ""}
                </span>
              )}
              {job.status && (
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full font-medium",
                    job.status === "active"
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-gray-500/10 text-gray-400"
                  )}
                >
                  {job.status}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
