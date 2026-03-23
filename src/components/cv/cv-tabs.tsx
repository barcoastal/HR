"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { PlatformSyncPanel } from "@/components/cv/platform-sync-panel";
import { SearchCandidates } from "@/components/cv/search-candidates";
import { CandidatePipeline } from "@/components/cv/candidate-pipeline";
import { CandidateDatabase } from "@/components/cv/candidate-database";
import { IndeedImport } from "@/components/cv/indeed-import";
import { CsvImport } from "@/components/cv/csv-import";
import { AddCandidateToPosition } from "@/components/cv/add-candidate-to-position";
import { AIMatchDialog } from "@/components/cv/add-position-form";
import { updatePositionStatus, postPositionToBreezy } from "@/lib/actions/candidates";
import { batchDownloadResumes } from "@/lib/actions/resume-download";
import { useRouter } from "next/navigation";
import type { CandidateStatus } from "@/generated/prisma/client";
import { Icon } from "@/components/ui/icon";

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
  managerId: string | null;
  recruiterId: string | null;
  backgroundCheckStatus: string | null;
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

type EmployeeOption = { id: string; firstName: string; lastName: string; jobTitle: string };

type Recruiter = { id: string; firstName: string; lastName: string };

type PipelineStageConfig = {
  id: string;
  label: string;
  color: string;
  bgColor: string;
  enumValue: string;
  visible: boolean;
  order: number;
};

type Props = {
  pipelineCandidates: CandidateItem[];
  allCandidates: CandidateItem[];
  positions: Position[];
  openPositions: PositionFull[];
  closedPositions: PositionFull[];
  syncablePlatforms: SyncablePlatform[];
  employees?: EmployeeOption[];
  recruiters?: Recruiter[];
  pipelineStages?: PipelineStageConfig[];
};

function PositionPipeline({
  position,
  candidates,
  allPositions,
  allCandidates,
  employees,
  recruiters,
  isArchived,
}: {
  position: PositionFull;
  candidates: CandidateItem[];
  allPositions: Position[];
  allCandidates: CandidateItem[];
  employees?: EmployeeOption[];
  recruiters?: Recruiter[];
  isArchived: boolean;
}) {
  const [expanded, setExpanded] = useState(!isArchived);
  const [matchDialogOpen, setMatchDialogOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [postingToBreezy, setPostingToBreezy] = useState(false);
  const [breezyResult, setBreezyResult] = useState<{ success: boolean; error?: string } | null>(null);
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

  async function handlePostToBreezy() {
    setPostingToBreezy(true);
    setBreezyResult(null);
    const result = await postPositionToBreezy(position.id);
    setBreezyResult(result);
    setPostingToBreezy(false);
    if (result.success) {
      setTimeout(() => setBreezyResult(null), 3000);
    }
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
            <Icon name="expand_more" size={16} />
          ) : (
            <Icon name="chevron_right" size={16} />
          )}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-[var(--color-text-primary)] truncate">
              {position.title}
            </h3>
            {isArchived && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/15 text-gray-400">
                <Icon name="archive" size={12} />
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
              <Icon name="group" size={12} />
              {activeCandidates} active
            </span>
            {hiredCount > 0 && (
              <span className="flex items-center gap-1 text-emerald-400">
                <Icon name="check_circle" size={12} />
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
                recruiters={recruiters}
              />
              <button
                onClick={() => setMatchDialogOpen(true)}
                title="AI Match"
                className={cn(
                  "p-1.5 rounded-lg transition-colors",
                  "text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10"
                )}
              >
                <Icon name="auto_awesome" size={16} />
              </button>
              <button
                onClick={handlePostToBreezy}
                disabled={postingToBreezy}
                title="Post to Indeed & LinkedIn via Breezy HR"
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  breezyResult?.success
                    ? "text-emerald-400 bg-emerald-500/10"
                    : breezyResult && !breezyResult.success
                      ? "text-red-400 bg-red-500/10"
                      : "text-[#6f42c1] hover:bg-[#6f42c1]/10",
                  "disabled:opacity-50"
                )}
              >
                {postingToBreezy ? (
                  <Icon name="progress_activity" size={12} className="animate-material-spin" />
                ) : breezyResult?.success ? (
                  <Icon name="check_circle" size={12} />
                ) : (
                  <Icon name="open_in_new" size={12} />
                )}
                {postingToBreezy ? "Posting..." : breezyResult?.success ? "Posted!" : "Breezy"}
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
                <Icon name="cancel" size={12} />Close
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
              <Icon name="work" size={12} />Reopen
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
                managerId: c.managerId || null,
                recruiterId: c.recruiterId || null,
                backgroundCheckStatus: c.backgroundCheckStatus || null,
                position: c.position,
              }))}
              positions={allPositions}
              employees={employees}
              recruiters={recruiters}
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
  employees,
  recruiters,
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
                      employees={employees}
                      recruiters={recruiters}
                      isArchived={false}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {openPositions.length === 0 && (
            <div className="text-center py-8 mb-6">
              <Icon name="work" size={40} className="text-[var(--color-text-muted)] mx-auto mb-2" />
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
                      managerId: c.managerId || null,
                      recruiterId: c.recruiterId || null,
                      backgroundCheckStatus: c.backgroundCheckStatus || null,
                      position: c.position,
                    }))}
                    positions={positions}
                    employees={employees}
                    recruiters={recruiters}
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
                  <Icon name="expand_more" size={16} />
                ) : (
                  <Icon name="chevron_right" size={16} />
                )}
                <Icon name="archive" size={16} />
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
                        employees={employees}
                        recruiters={recruiters}
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
        <div>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <IndeedImport
              platform={syncablePlatforms.find((p) => p.name === "Indeed") as any}
            />
            <CsvImport />
            <CleanDuplicatesButton />
            <FixNamesButton />
            <DownloadResumesButton />
          </div>
          <CandidateDatabase
            candidates={allCandidates}
            positions={positions}
          />
        </div>
      )}
    </div>
  );
}

function CleanDuplicatesButton() {
  const [cleaning, setCleaning] = useState(false);
  const [result, setResult] = useState<{ duplicatesFound: number; deleted: number; totalBefore: number; totalAfter: number } | null>(null);
  const router = useRouter();

  async function handleClean() {
    if (!confirm("This will remove duplicate candidates (same email). Candidates in the active pipeline or hired will be preserved. Continue?")) return;
    setCleaning(true);
    setResult(null);
    try {
      const res = await fetch("/api/candidates/cleanup", { method: "POST" });
      if (!res.ok) throw new Error("Cleanup failed");
      const data = await res.json();
      setResult(data);
      if (data.deleted > 0) router.refresh();
    } catch {
      alert("Failed to clean duplicates. Please try again.");
    }
    setCleaning(false);
  }

  return (
    <div className="relative">
      <button
        onClick={handleClean}
        disabled={cleaning}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
          "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20",
          "border border-amber-500/20",
          "disabled:opacity-50"
        )}
      >
        <Icon name={cleaning ? "progress_activity" : "delete_sweep"} size={16} className={cleaning ? "animate-material-spin" : ""} />
        {cleaning ? "Cleaning..." : "Clean Duplicates"}
      </button>
      {result && result.deleted > 0 && (
        <div className="absolute top-full mt-1 left-0 z-10 bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[200px]">
          <p className="text-xs font-medium text-gray-900 mb-1">Cleanup Complete</p>
          <p className="text-[11px] text-gray-500">{result.deleted} duplicates removed</p>
          <p className="text-[11px] text-gray-500">{result.totalBefore} → {result.totalAfter} candidates</p>
        </div>
      )}
      {result && result.deleted === 0 && (
        <div className="absolute top-full mt-1 left-0 z-10 bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[200px]">
          <p className="text-xs font-medium text-gray-900">No duplicates found</p>
        </div>
      )}
    </div>
  );
}

function FixNamesButton() {
  const [fixing, setFixing] = useState(false);
  const [result, setResult] = useState<{ fixed: number } | null>(null);
  const router = useRouter();

  async function handleFix() {
    if (!confirm("This will fix candidates that have dates or missing names by extracting names from their email. Continue?")) return;
    setFixing(true);
    setResult(null);
    try {
      const res = await fetch("/api/candidates/fix-names", { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setResult({ fixed: data.fixed });
      if (data.fixed > 0) router.refresh();
    } catch {
      alert("Failed to fix names.");
    }
    setFixing(false);
  }

  return (
    <div className="relative">
      <button
        onClick={handleFix}
        disabled={fixing}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
          "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20",
          "border border-blue-500/20",
          "disabled:opacity-50"
        )}
      >
        <Icon name={fixing ? "progress_activity" : "auto_fix_high"} size={16} className={fixing ? "animate-material-spin" : ""} />
        {fixing ? "Fixing..." : "Fix Names"}
      </button>
      {result && (
        <div className="absolute top-full mt-1 left-0 z-10 bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[200px]">
          <p className="text-xs font-medium text-gray-900">
            {result.fixed > 0 ? `Fixed ${result.fixed} candidate names` : "All names look good"}
          </p>
        </div>
      )}
    </div>
  );
}

function DownloadResumesButton() {
  const [downloading, setDownloading] = useState(false);
  const [result, setResult] = useState<{ total: number; downloaded: number; alreadyLocal: number; failed: number } | null>(null);
  const router = useRouter();

  async function handleDownload() {
    if (!confirm("This will download all pending resume PDFs from Jobing. This may take a few minutes. Continue?")) return;
    setDownloading(true);
    setResult(null);
    try {
      const res = await batchDownloadResumes();
      setResult(res);
      if (res.downloaded > 0) router.refresh();
    } catch {
      alert("Failed to download resumes.");
    }
    setDownloading(false);
  }

  return (
    <div className="relative">
      <button
        onClick={handleDownload}
        disabled={downloading}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
          "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20",
          "border border-emerald-500/20",
          "disabled:opacity-50"
        )}
      >
        <Icon name={downloading ? "progress_activity" : "download"} size={16} className={downloading ? "animate-material-spin" : ""} />
        {downloading ? "Downloading..." : "Download Resumes"}
      </button>
      {result && (
        <div className="absolute top-full mt-1 left-0 z-10 bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[220px]">
          <p className="text-xs font-medium text-gray-900 mb-1">Resume Download Complete</p>
          <p className="text-[11px] text-gray-500">Downloaded: {result.downloaded}</p>
          <p className="text-[11px] text-gray-500">Already local: {result.alreadyLocal}</p>
          {result.failed > 0 && <p className="text-[11px] text-red-500">Failed: {result.failed}</p>}
        </div>
      )}
    </div>
  );
}
