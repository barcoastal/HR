"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { PlatformSyncPanel } from "@/components/cv/platform-sync-panel";
import { SearchCandidates } from "@/components/cv/search-candidates";
import { CandidatePipeline } from "@/components/cv/candidate-pipeline";
import { CandidateDatabase } from "@/components/cv/candidate-database";
import { Users } from "lucide-react";
import type { CandidateStatus } from "@/generated/prisma/client";

type CandidateItem = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  linkedinUrl: string | null;
  skills: string | null;
  experience: string | null;
  source: string | null;
  notes: string | null;
  resumeText: string | null;
  status: CandidateStatus;
  positionId: string | null;
  costOfHire: number | null;
  jobAppliedTo: string | null;
  inPipeline: boolean;
  position: { title: string } | null;
  resumeUrl: string | null;
  createdAt: Date;
};

type Position = { id: string; title: string };
type SyncablePlatform = {
  id: string;
  name: string;
  type: string;
  status: string;
  isConnected: boolean;
  lastSyncAt: Date | null;
  totalSynced: number;
  lastSyncLog: unknown;
};

type Props = {
  pipelineCandidates: CandidateItem[];
  allCandidates: CandidateItem[];
  positions: Position[];
  openPositions: { id: string; title: string; department: { name: string } | null; salary: string | null; _count: { candidates: number } }[];
  syncablePlatforms: SyncablePlatform[];
};

export function CVTabs({
  pipelineCandidates,
  allCandidates,
  positions,
  openPositions,
  syncablePlatforms,
}: Props) {
  const tabs = [
    { id: "recruitment", label: "Recruitment" },
    { id: "database", label: "Candidate Database" },
  ];

  const [activeTab, setActiveTab] = useState("recruitment");

  return (
    <div>
      <div className="flex gap-1 mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
              activeTab === tab.id
                ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "recruitment" && (
        <div>
          <PlatformSyncPanel platforms={syncablePlatforms} />

          <SearchCandidates />

          {openPositions.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">Open Positions</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {openPositions.map((pos) => (
                  <div key={pos.id} className={cn("rounded-xl p-4", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{pos.title}</h3>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">{pos.department?.name || "No department"}</p>
                    {pos.salary && <p className="text-xs text-[var(--color-accent)] mt-1">{pos.salary}</p>}
                    <div className="flex items-center gap-1.5 mt-2">
                      <Users className="h-3 w-3 text-[var(--color-text-muted)]" />
                      <span className="text-xs text-[var(--color-text-muted)]">{pos._count.candidates} candidate{pos._count.candidates !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">Candidate Pipeline</h2>
          <CandidatePipeline
            candidates={pipelineCandidates.map((c) => ({
              id: c.id,
              firstName: c.firstName,
              lastName: c.lastName,
              email: c.email,
              phone: c.phone,
              linkedinUrl: c.linkedinUrl,
              skills: c.skills,
              experience: c.experience,
              source: c.source,
              notes: c.notes,
              resumeText: c.resumeText,
              resumeUrl: c.resumeUrl,
              status: c.status,
              positionId: c.positionId,
              costOfHire: c.costOfHire,
              position: c.position ? { title: c.position.title } : null,
            }))}
            positions={positions}
          />
        </div>
      )}

      {activeTab === "database" && (
        <CandidateDatabase candidates={allCandidates} positions={positions} />
      )}
    </div>
  );
}
