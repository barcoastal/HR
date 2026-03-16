"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { PlatformSyncPanel } from "@/components/cv/platform-sync-panel";
import { SearchCandidates } from "@/components/cv/search-candidates";
import { CandidatePipeline } from "@/components/cv/candidate-pipeline";
import { CandidateDatabase } from "@/components/cv/candidate-database";
import { AddCandidateToPosition } from "@/components/cv/add-candidate-to-position";
import { Users, Sparkles, ChevronDown, ChevronRight, Archive, Briefcase, CheckCircle2, XCircle } from "lucide-react";
import { AIMatchDialog } from "@/components/cv/add-position-form";
import { updatePositionStatus } from "@/lib/actions/candidates";
import { useRouter } from "next/navigation";
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

type PositionFull = {
  id: string;
  title: string;
  status: string;
  description: string | null;
  department: { name: string } | null;
  salary: string | null;
  _count: { candidates: number };
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
  openPositions: PositionFull[];
  closedPositions: PositionFull[];
  syncablePlatforms: SyncablePlatform[];
};

function PositionPipeline({
  position,
  candidates,
  allPositions,
  allCandidates,
  isArchived,
}: {
  position: PositionFull;
  candidates: CandidateItem[];
  allPositions: Position[];
  allCandidates: CandidateItem[];
  isArchived: boolean;
}) {
  const [expanded, setExpanded] = useState(!isArchived);
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const router = useRouter();

  const activeCandidates = candidates.filter(
    (c) => !["HIRED", "REJECTED"].includes(c.status)
  ).length;
  const hiredCount = candidates.filter((c) => c.status === "HIRED").length;

  async function handleClosePosition() {
    if (!confirm(`Close the "${position.title}" position?`)) return;
    setClosing(true);
    await updatePositionStatus(position.id, "FILLED");
    setClosing(false);
    router.refresh();
  }

  async function handleReopenPosition() {
    setClosing(true);
    await updatePositionStatus(position.id, "OPEN");
    setClosing(false);
    router.refresh();
  }

  const existingForAdd = allCandidates.map((c) => ({
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    skills: c.skills,
    positionId: c.positionId,
  }));

  return (
    <div
      className={cn(
        "rounded-2xl overflow-hidden border transition-colors",
        isArchived
          ? "bg-[var(--color-surface)]/50 border-[var(--color-border)]/50 opacity-75"
          : "bg-[var(--color-surface)] border-[var(--color-border)]"
      )}
    >
      {/* Position header */}
      <div
        className={cn(
          "flex items-center gap-3 px-5 py-4 cursor-pointer",
          isArchived
            ? "border-l-4 border-l-gray-400"
            : "border-l-4 border-l-[var(--color-accent)]"
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <button className="p-0.5 text-[var(--color-text-muted)] shrink-0">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-[var(--color-text-primary)] truncate">
              {position.title}
            </h3>
            {isArchived && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/15 text-gray-400">
                <Archive className="h-3 w-3" />
                {position.status === "FILLED" ? "Filled" : "Closed"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
            {position.department && <span>{position.department.name}</span>}
            {position.salary && (
              <span className="text-[var(--color-accent)]">
                {position.salary}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {activeCandidates} active
            </span>
            {hiredCount > 0 && (
              <span className="flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                {hiredCount} hired
              </span>
            )}
          </div>
        </div>
        <div
          className="flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {!isArchived && (
            <>
              <AddCandidateToPosition
                positionId={position.id}
                positionTitle={position.title}
                existingCandidates={existingForAdd}
              />
              <button
                onClick={() => setMatchDialogOpen(true)}
                title="AI Match"
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  "text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10"
                )}
              >
                <Sparkles className="h-4 w-4" />
              </button>
              <button
                onClick={handleClosePosition}
                disabled={closing}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium",
                  "text-amber-400 hover:bg-amber-500/10 transition-colors",
                  "disabled:opacity-50"
                )}
              >
                <XCircle className="h-3.5 w-3.5" />Close
              </button>
            </>
          )}
          {isArchived && (
            <button
              onClick={handleReopenPosition}
              disabled={closing}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium",
                "text-emerald-400 hover:bg-emerald-500/10 transition-colors",
                "disabled:opacity-50"
              )}
            >
              <Briefcase className="h-3.5 w-3.5" />Reopen
            </button>
          )}
        </div>
      </div>

      {/* Pipeline */}
      {expanded && (
        <div className="px-5 pb-5">
          {candidates.length > 0 ? (
            <CandidatePipeline
              candidates={candidates.map((c) => ({
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
                position: c.position,
              }))}
              positions={allPositions}
            />
          ) : (
            <p className="text-center text-sm text-[var(--color-text-muted)] py-8">
              No candidates yet. Add candidates from the database or create
              new ones.
            </p>
          )}
        </div>
      )}

      {matchDialogOpen && (
        <AIMatchDialog
          positionId={position.id}
          positionTitle={position.title}
          open={true}
          onClose={() => setMatchDialogOpen(false)}
        />
      )}
    </div>
  );
}

export function CVTabs({
  pipelineCandidates,
  allCandidates,
  positions,
  openPositions,
  closedPositions,
  syncablePlatforms,
}: Props) {
  const tabs = [
    { id: "recruitment", label: "Recruitment" },
    { id: "database", label: "Candidate Database" },
  ];

  const [activeTab, setActiveTab] = useState("recruitment");
  const [showArchive, setShowArchive] = useState(false);

  // Candidates without a position (unassigned)
  const unassignedCandidates = pipelineCandidates.filter(
    (c) => !c.positionId
  );

  return (
    <div>
      <div className="flex gap-1 mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-3 h-11 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
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
          <SearchCandidates />

          {/* Open Positions with Pipelines */}
          {openPositions.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
                Open Positions
              </h2>
              <div className="space-y-4">
                {openPositions.map((pos) => {
                  const posCandidates = pipelineCandidates.filter(
                    (c) => c.positionId === pos.id
                  );
                  return (
                    <PositionPipeline
                      key={pos.id}
                      position={pos}
                      candidates={posCandidates}
                      allPositions={positions}
                      allCandidates={allCandidates}
                      isArchived={false}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {openPositions.length === 0 && (
            <div className="text-center py-8 mb-6">
              <Briefcase className="h-10 w-10 text-[var(--color-text-muted)] mx-auto mb-2" />
              <p className="text-[var(--color-text-muted)]">
                No open positions. Create one to start building pipelines.
              </p>
            </div>
          )}

          {/* Unassigned pipeline candidates */}
          {unassignedCandidates.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">
                Unassigned Candidates
              </h2>
              <div
                className={cn(
                  "rounded-2xl overflow-hidden",
                  "bg-[var(--color-surface)] border border-[var(--color-border)]"
                )}
              >
                <div className="p-5">
                  <CandidatePipeline
                    candidates={unassignedCandidates.map((c) => ({
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
                      position: c.position,
                    }))}
                    positions={positions}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Archived Positions */}
          {closedPositions.length > 0 && (
            <div className="mb-6">
              <button
                onClick={() => setShowArchive(!showArchive)}
                className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors mb-3"
              >
                {showArchive ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <Archive className="h-4 w-4" />
                Archived Positions ({closedPositions.length})
              </button>
              {showArchive && (
                <div className="space-y-4">
                  {closedPositions.map((pos) => {
                    const posCandidates = pipelineCandidates.filter(
                      (c) => c.positionId === pos.id
                    );
                    return (
                      <PositionPipeline
                        key={pos.id}
                        position={pos}
                        candidates={posCandidates}
                        allPositions={positions}
                        allCandidates={allCandidates}
                        isArchived={true}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Platform Sync - moved to bottom */}
          <PlatformSyncPanel platforms={syncablePlatforms} />
        </div>
      )}

      {activeTab === "database" && (
        <CandidateDatabase
          candidates={allCandidates}
          positions={positions}
        />
      )}
    </div>
  );
}
