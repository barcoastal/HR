"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";

type JobData = {
  title: string;
  description: string;
  requirements: string;
  salary: string;
  departmentName: string;
  linkedInSettings?: {
    premium: boolean;
    remote: boolean;
    jobType: string;
    experienceLevel: string;
  };
  indeedSettings?: {
    sponsored: boolean;
    remote: boolean;
    jobType: string;
  };
};

function formatJobType(type: string) {
  return type
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("-");
}

function formatExperience(level: string) {
  const map: Record<string, string> = {
    entry: "Entry level",
    associate: "Associate",
    "mid-senior": "Mid-Senior level",
    director: "Director",
    executive: "Executive",
  };
  return map[level] || level;
}

function LinkedInPreview({ job }: { job: JobData }) {
  const isRemote = job.linkedInSettings?.remote;
  const jobType = job.linkedInSettings?.jobType || "full-time";
  const expLevel = job.linkedInSettings?.experienceLevel || "mid-senior";

  return (
    <div className="bg-white rounded-lg border border-[#e0e0e0] overflow-hidden text-[#000000e6]">
      {/* LinkedIn header bar */}
      <div className="bg-white px-5 py-3 border-b border-[#e0e0e0] flex items-center gap-2">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#0A66C2">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
        <span className="text-[13px] font-semibold text-[#0A66C2]">LinkedIn</span>
        {job.linkedInSettings?.premium && (
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-[#f3c349] text-[#5a4311] font-semibold">PROMOTED</span>
        )}
      </div>

      <div className="p-5">
        {/* Company logo + title */}
        <div className="flex gap-3 mb-3">
          <div className="w-12 h-12 rounded bg-[#3052FF] flex items-center justify-center shrink-0">
            <span className="text-white text-[10px] font-bold leading-none">CD</span>
          </div>
          <div>
            <h3 className="text-[16px] font-semibold text-[#0A66C2] leading-tight hover:underline cursor-default">
              {job.title || "Job Title"}
            </h3>
            <p className="text-[13px] text-[#000000e6] mt-0.5">
              Coastal Debt Resolve · {isRemote ? "Remote" : "Boca Raton, FL"}
            </p>
            <p className="text-[12px] text-[#00000099] mt-0.5">1 minute ago</p>
          </div>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {job.salary && (
            <span className="inline-flex items-center gap-1 text-[12px] text-[#00000099] bg-[#f4f2ee] rounded-full px-2.5 py-1">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="#666"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm.5 3v.5h1a.5.5 0 010 1h-1V7h.5a2 2 0 110 4h-.5v.5a.5.5 0 01-1 0V11h-1a.5.5 0 010-1h1V8.5H7a2 2 0 110-4h.5V4a.5.5 0 011 0z"/></svg>
              {job.salary}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-[12px] text-[#00000099] bg-[#f4f2ee] rounded-full px-2.5 py-1">
            {formatJobType(jobType)}
          </span>
          <span className="inline-flex items-center gap-1 text-[12px] text-[#00000099] bg-[#f4f2ee] rounded-full px-2.5 py-1">
            {formatExperience(expLevel)}
          </span>
        </div>

        {/* Description */}
        {job.description && (
          <div className="mb-3">
            <p className="text-[13px] text-[#000000e6] leading-relaxed line-clamp-4">
              {job.description}
            </p>
          </div>
        )}

        {/* Requirements */}
        {job.requirements && (
          <div className="mb-4">
            <p className="text-[13px] font-semibold text-[#000000e6] mb-1">Requirements</p>
            <p className="text-[13px] text-[#00000099] leading-relaxed line-clamp-3">
              {job.requirements}
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-2">
          <div className="px-5 py-2 rounded-full bg-[#0A66C2] text-white text-[14px] font-semibold cursor-default">
            Apply
          </div>
          <div className="px-5 py-2 rounded-full border border-[#0A66C2] text-[#0A66C2] text-[14px] font-semibold cursor-default">
            Save
          </div>
        </div>
      </div>
    </div>
  );
}

function IndeedPreview({ job }: { job: JobData }) {
  const isRemote = job.indeedSettings?.remote;
  const jobType = job.indeedSettings?.jobType || "full-time";
  const isSponsored = job.indeedSettings?.sponsored;

  return (
    <div className="bg-white rounded-lg border border-[#d4d2d0] overflow-hidden text-[#2d2d2d]">
      {/* Indeed header bar */}
      <div className="bg-white px-5 py-3 border-b border-[#d4d2d0] flex items-center gap-2">
        <svg width="48" height="16" viewBox="0 0 96 32" fill="none">
          <text x="0" y="24" fill="#2164f3" fontFamily="Arial, sans-serif" fontSize="22" fontWeight="bold">indeed</text>
        </svg>
        {isSponsored && (
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-[#e8eef9] text-[#2164f3] font-semibold">SPONSORED</span>
        )}
      </div>

      <div className="p-5">
        {/* Title + company */}
        <div className="mb-3">
          <h3 className="text-[18px] font-bold text-[#2d2d2d] leading-tight cursor-default">
            {job.title || "Job Title"}
          </h3>
          <p className="text-[14px] text-[#2d2d2d] mt-1 font-medium">Coastal Debt Resolve</p>
          <p className="text-[14px] text-[#6f6f6f] mt-0.5">
            {isRemote ? "Remote" : "Boca Raton, FL"}
          </p>
        </div>

        {/* Tags row */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {job.salary && (
            <span className="inline-flex items-center gap-1 text-[13px] text-[#2d2d2d] border border-[#d4d2d0] rounded-full px-3 py-1">
              {job.salary}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-[13px] text-[#2d2d2d] border border-[#d4d2d0] rounded-full px-3 py-1">
            {formatJobType(jobType)}
          </span>
        </div>

        {/* Description */}
        {job.description && (
          <div className="mb-3">
            <p className="text-[14px] text-[#2d2d2d] leading-relaxed line-clamp-4">
              {job.description}
            </p>
          </div>
        )}

        {/* Requirements as bullet points */}
        {job.requirements && (
          <div className="mb-4">
            <p className="text-[14px] font-bold text-[#2d2d2d] mb-1.5">Qualifications</p>
            <ul className="space-y-1">
              {job.requirements
                .split(/[,\n]/)
                .map((r) => r.trim())
                .filter(Boolean)
                .slice(0, 5)
                .map((req, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-[#2d2d2d]">
                    <span className="text-[#6f6f6f] mt-0.5 shrink-0">•</span>
                    {req}
                  </li>
                ))}
            </ul>
          </div>
        )}

        {/* Apply button */}
        <div className="pt-2">
          <div className="inline-flex px-6 py-2.5 rounded-lg bg-[#2164f3] text-white text-[14px] font-bold cursor-default">
            Apply now
          </div>
        </div>
      </div>
    </div>
  );
}

export function JobPostingPreview({
  job,
  showLinkedIn,
  showIndeed,
  onBack,
  onPublish,
  publishing,
}: {
  job: JobData;
  showLinkedIn: boolean;
  showIndeed: boolean;
  onBack: () => void;
  onPublish: () => void;
  publishing: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"linkedin" | "indeed">(
    showLinkedIn ? "linkedin" : "indeed"
  );

  const tabs = [
    ...(showLinkedIn ? [{ key: "linkedin" as const, label: "LinkedIn", color: "#0A66C2" }] : []),
    ...(showIndeed ? [{ key: "indeed" as const, label: "Indeed", color: "#2164f3" }] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon name="visibility" size={16} className="text-[var(--color-accent)]" />
        <p className="text-sm font-medium text-[var(--color-text-primary)]">Preview how your posting will appear</p>
      </div>

      {/* Tab switcher */}
      {tabs.length > 1 && (
        <div className="flex gap-1 p-1 rounded-lg bg-[var(--color-surface-container)]">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                activeTab === tab.key
                  ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Preview card */}
      <div className="rounded-xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-container)]">
        <div className="p-3">
          {activeTab === "linkedin" && showLinkedIn && <LinkedInPreview job={job} />}
          {activeTab === "indeed" && showIndeed && <IndeedPreview job={job} />}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className={cn(
            "inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium",
            "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors"
          )}
        >
          <Icon name="arrow_back" size={16} />
          Edit
        </button>
        <button
          type="button"
          onClick={onPublish}
          disabled={publishing}
          className={cn(
            "inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-medium",
            "bg-[var(--color-accent)] text-white",
            "hover:bg-[var(--color-accent-hover)] transition-colors",
            "disabled:opacity-50"
          )}
        >
          {publishing ? (
            <Icon name="progress_activity" size={16} className="animate-material-spin" />
          ) : (
            <Icon name="publish" size={16} />
          )}
          {publishing ? "Publishing..." : "Publish & Find Matches"}
        </button>
      </div>
    </div>
  );
}
