"use client";

import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { useState, useEffect, useCallback, useRef } from "react";
import { updateCandidate, hireCandidateAndStartOnboarding, sendOfferLetter } from "@/lib/actions/candidates";
import { getInterviewsForCandidate, cancelInterview, isCalendarConnected } from "@/lib/actions/interviews";
import { getCandidateApplications, markDoNotCall, unmarkDoNotCall } from "@/lib/actions/candidate-applications";
import { sendAdverseActionLetter } from "@/lib/actions/adverse-action";
import { useRouter } from "next/navigation";
import type { CandidateStatus, InterviewType, InterviewStatus } from "@/generated/prisma/client";
import Link from "next/link";
import { ScheduleInterviewDialog } from "./schedule-interview-dialog";
import { Icon } from "@/components/ui/icon";

type InterviewForDisplay = {
  id: string;
  scheduledAt: Date;
  duration: number;
  type: InterviewType;
  status: InterviewStatus;
  googleMeetLink: string | null;
  notes: string | null;
  position: { title: string } | null;
};

const interviewTypeLabels: Record<InterviewType, string> = {
  PHONE_SCREEN: "Phone Screen",
  VIDEO: "Video",
  TECHNICAL: "Technical",
  BEHAVIORAL: "Behavioral",
  PANEL: "Panel",
  FINAL: "Final",
};

type CandidateForDialog = {
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
  resumeUrl: string | null;
  status: CandidateStatus;
  positionId: string | null;
  costOfHire: number | null;
  hourlyRate: number | null;
  managerId: string | null;
  recruiterId: string | null;
  backgroundCheckStatus: string | null;
  backgroundCheckId?: string | null;
  backgroundCheckOptions: string | null;
  adverseActionLetterSentAt?: Date | null;
  offerDocUrl: string | null;
  offerSentAt: Date | null;
  offerSignedDocUrl: string | null;
  offerSignedAt: Date | null;
  position: { title: string } | null;
  doNotCall?: boolean;
  doNotCallReason?: string | null;
  applicationCount?: number | null;
};

type ApplicationForDisplay = {
  id: string;
  positionName: string;
  status: CandidateStatus;
  appliedAt: Date;
  source: string | null;
  stageHistory: unknown;
  position: { title: string } | null;
};

type Position = { id: string; title: string };
type EmployeeOption = { id: string; firstName: string; lastName: string; jobTitle: string };
type Recruiter = { id: string; firstName: string; lastName: string };

function AdverseActionBlock({ candidateId, alreadySentAt: initialSentAt }: { candidateId: string; alreadySentAt: Date | null }) {
  const [sentAt, setSentAt] = useState<Date | null>(initialSentAt);
  const [sending, setSending] = useState(false);
  const [reason, setReason] = useState("");
  const [showReason, setShowReason] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(force = false) {
    setSending(true);
    setError(null);
    const res = await sendAdverseActionLetter(candidateId, reason || undefined, { force });
    setSending(false);
    if (res.success) {
      setSentAt(new Date());
      setShowReason(false);
    } else if (res.alreadySent) {
      setError(res.error || "Already sent");
    } else {
      setError(res.error || "Failed to send");
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/5 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-red-700 uppercase tracking-wider flex items-center gap-1">
            <Icon name="mail" size={12} /> Adverse action letter
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
            Notify the candidate we&apos;re not moving forward based on the background report (FCRA-compliant template).
          </p>
        </div>
        {sentAt ? (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 shrink-0">
            Sent {new Date(sentAt).toLocaleDateString()}
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-700 shrink-0">
            Not sent
          </span>
        )}
      </div>
      {showReason && (
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder="Optional reason shown to the candidate (leave blank for generic wording)"
          className="w-full px-2 py-1.5 rounded text-xs bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-primary)]"
        />
      )}
      {error && <p className="text-[10px] text-red-600">{error}</p>}
      <div className="flex items-center gap-1.5">
        {!sentAt && (
          <>
            <button
              onClick={() => (showReason ? send() : setShowReason(true))}
              disabled={sending}
              className="px-2.5 py-1 rounded text-[11px] font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-1"
            >
              {sending && <Icon name="progress_activity" size={10} className="animate-material-spin" />}
              <Icon name="send" size={10} />
              {showReason ? "Send letter" : "Send adverse action letter"}
            </button>
            {showReason && (
              <button
                onClick={() => setShowReason(false)}
                className="px-2.5 py-1 rounded text-[11px] font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
              >
                Cancel
              </button>
            )}
          </>
        )}
        {sentAt && (
          <button
            onClick={() => send(true)}
            disabled={sending}
            className="px-2.5 py-1 rounded text-[11px] font-medium bg-[var(--color-background)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] border border-[var(--color-border)] flex items-center gap-1"
          >
            {sending && <Icon name="progress_activity" size={10} className="animate-material-spin" />}
            <Icon name="refresh" size={10} /> Resend
          </button>
        )}
      </div>
    </div>
  );
}

function parseSkills(skills: string | null): string {
  if (!skills) return "";
  try {
    const parsed = JSON.parse(skills);
    return Array.isArray(parsed) ? parsed.join(", ") : skills;
  } catch {
    return skills;
  }
}

const DEFAULT_STATUSES: { value: CandidateStatus; label: string; color: string }[] = [
  { value: "NEW", label: "New", color: "bg-blue-500" },
  { value: "SCREENING", label: "Screening", color: "bg-amber-500" },
  { value: "INTERVIEW", label: "Interview", color: "bg-purple-500" },
  { value: "OFFER", label: "Offer", color: "bg-emerald-500" },
  { value: "BACKGROUND_CHECK", label: "BG Check", color: "bg-orange-500" },
  { value: "HIRED", label: "Hired", color: "bg-green-500" },
  { value: "REJECTED", label: "Rejected", color: "bg-red-500" },
];

type PipelineStageConfig = { id: string; label: string; color: string; bgColor: string; enumValue: string; visible: boolean; order: number };

export function CandidateDetailDialog({
  candidate,
  positions,
  employees,
  recruiters,
  pipelineStages,
  open,
  onClose,
}: {
  candidate: CandidateForDialog | null;
  positions: Position[];
  employees?: EmployeeOption[];
  recruiters?: Recruiter[];
  pipelineStages?: PipelineStageConfig[];
  open: boolean;
  onClose: () => void;
}) {
  const statuses = pipelineStages && pipelineStages.length > 0
    ? pipelineStages.filter(s => s.visible).map(s => ({
        value: s.enumValue as CandidateStatus,
        label: s.label,
        color: s.bgColor,
      }))
    : DEFAULT_STATUSES;
  const [saving, setSaving] = useState(false);
  const [hiring, setHiring] = useState(false);
  const [hireResult, setHireResult] = useState<{ employeeId: string; name: string; taskCount: number } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    linkedinUrl: "",
    skills: "",
    experience: "",
    source: "",
    notes: "",
    positionId: "",
    costOfHire: "",
    hourlyRate: "",
    managerId: "",
    recruiterId: "",
    status: "NEW" as CandidateStatus,
    companyEmail: "",
    startDate: "",
  });
  const [bgCheckStatus, setBgCheckStatus] = useState<string | null>(null);
  const [bgCheckLoading, setBgCheckLoading] = useState(false);
  const [bgCheckOptions, setBgCheckOptions] = useState({
    report_sku: "HIRE1",
    drug_test: "N",
    drug_sku: "drug",
    mvr: "N",
    employment: "N",
    education: "N",
    blj: "N",
    federal_criminal: "N",
    bankruptcy: "N",
    civil_judgment: "N",
    tax_lien: "N",
    credit_report: "N",
  });
  const router = useRouter();

  const [interviews, setInterviews] = useState<InterviewForDisplay[]>([]);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [offerUploading, setOfferUploading] = useState(false);
  const [offerSending, setOfferSending] = useState(false);
  const [offerDocUrl, setOfferDocUrl] = useState<string | null>(null);
  const [offerSentAt, setOfferSentAt] = useState<Date | null>(null);
  const [offerSignedDocUrl, setOfferSignedDocUrl] = useState<string | null>(null);
  const [offerSignedAt, setOfferSignedAt] = useState<Date | null>(null);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [applications, setApplications] = useState<ApplicationForDisplay[]>([]);
  const [dncBusy, setDncBusy] = useState(false);
  const [localDoNotCall, setLocalDoNotCall] = useState<boolean>(!!candidate?.doNotCall);
  const [localDncReason, setLocalDncReason] = useState<string | null>(candidate?.doNotCallReason || null);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeUploadError, setResumeUploadError] = useState<string | null>(null);
  const [localResumeUrl, setLocalResumeUrl] = useState<string | null>(candidate?.resumeUrl || null);
  const resumeFileInputRef = useRef<HTMLInputElement>(null);

  async function handleResumeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !candidate) return;
    setResumeUploadError(null);
    setResumeUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/candidates/${candidate.id}/resume`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setResumeUploadError(data.error || `Upload failed (${res.status})`);
        return;
      }
      setLocalResumeUrl(data.resumeUrl);
      router.refresh();
    } catch (err) {
      setResumeUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setResumeUploading(false);
      if (resumeFileInputRef.current) resumeFileInputRef.current.value = "";
    }
  }

  const loadInterviews = useCallback(async (candidateId: string) => {
    const [data, connected] = await Promise.all([
      getInterviewsForCandidate(candidateId),
      isCalendarConnected(),
    ]);
    setInterviews(data as unknown as InterviewForDisplay[]);
    setCalendarConnected(connected);
  }, []);

  useEffect(() => {
    if (candidate && open) {
      loadInterviews(candidate.id);
      getCandidateApplications(candidate.id).then((apps) => {
        setApplications(apps as unknown as ApplicationForDisplay[]);
      }).catch(() => setApplications([]));
      setLocalDoNotCall(!!candidate.doNotCall);
      setLocalDncReason(candidate.doNotCallReason || null);
      setLocalResumeUrl(candidate.resumeUrl || null);
      setResumeUploadError(null);
    }
  }, [candidate, open, loadInterviews]);

  async function handleToggleDnc() {
    if (!candidate) return;
    setDncBusy(true);
    try {
      if (localDoNotCall) {
        if (!confirm("Remove the Do Not Call flag? This candidate will become callable again.")) {
          setDncBusy(false);
          return;
        }
        await unmarkDoNotCall(candidate.id);
        setLocalDoNotCall(false);
        setLocalDncReason(null);
      } else {
        const reason = prompt("Add a reason (optional — shown on hover):", "");
        await markDoNotCall(candidate.id, reason || undefined);
        setLocalDoNotCall(true);
        setLocalDncReason(reason || null);
      }
      router.refresh();
    } finally {
      setDncBusy(false);
    }
  }

  useEffect(() => {
    if (candidate) {
      setForm({
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        email: candidate.email,
        phone: candidate.phone || "",
        linkedinUrl: candidate.linkedinUrl || "",
        skills: parseSkills(candidate.skills),
        experience: candidate.experience || "",
        source: candidate.source || "",
        notes: candidate.notes || "",
        positionId: candidate.positionId || "",
        costOfHire: candidate.costOfHire?.toString() || "",
        hourlyRate: candidate.hourlyRate?.toString() || "",
        managerId: candidate.managerId || "",
        recruiterId: candidate.recruiterId || "",
        status: candidate.status,
        companyEmail: "",
        startDate: new Date().toISOString().split("T")[0],
      });
      setBgCheckStatus(candidate.backgroundCheckStatus || null);
      setHireResult(null);
      setOfferDocUrl(candidate.offerDocUrl || null);
      setOfferSentAt(candidate.offerSentAt ? new Date(candidate.offerSentAt) : null);
      setOfferSignedDocUrl(candidate.offerSignedDocUrl || null);
      setOfferSignedAt(candidate.offerSignedAt ? new Date(candidate.offerSignedAt) : null);
      setOfferError(null);
    }
  }, [candidate]);

  // Auto-poll background-check status while the dialog is open and the check
  // is still resolving. Hits the GET endpoint which queries
  // backgroundchecks.com, persists any change, and fires the
  // BACKGROUND_CHECK_COMPLETE notification. Stops once we see PASSED/FAILED.
  useEffect(() => {
    if (!open || !candidate) return;
    if (candidate.status !== "BACKGROUND_CHECK") return;
    if (!candidate.backgroundCheckId) return;
    // Skip polling when the persisted status is already resolved.
    const persisted = candidate.backgroundCheckStatus;
    if (persisted === "PASSED" || persisted === "FAILED") return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const candidateId = candidate.id;

    const poll = async () => {
      try {
        const res = await fetch(`/api/background-check?candidateId=${candidateId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.status) {
          setBgCheckStatus((prev) => {
            if (prev === data.status) return prev;
            if (data.status === "PASSED" || data.status === "FAILED") {
              router.refresh();
              if (intervalId) clearInterval(intervalId);
            }
            return data.status;
          });
        }
      } catch {
        // Network blip — next tick will retry.
      }
    };

    poll();
    intervalId = setInterval(poll, 20_000);
    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [open, candidate, router]);

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!candidate) return;
    setSaveError(null);

    if (form.status === "HIRED" && candidate.status !== "HIRED") {
      setHiring(true);
      try {
        // Save any field edits first
        await updateCandidate(candidate.id, {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone || undefined,
          linkedinUrl: form.linkedinUrl || undefined,
          skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
          experience: form.experience || undefined,
          source: form.source || undefined,
          notes: form.notes || undefined,
          positionId: form.positionId || undefined,
          costOfHire: form.costOfHire ? parseFloat(form.costOfHire) : undefined,
          hourlyRate: form.hourlyRate ? parseFloat(form.hourlyRate) : undefined,
          managerId: form.managerId || undefined,
          recruiterId: form.recruiterId || undefined,
        });
        const isPreOnboarding = form.companyEmail === "__PRE_ONBOARDING__";
        const result = await hireCandidateAndStartOnboarding(candidate.id, {
          companyEmail: isPreOnboarding ? undefined : (form.companyEmail || undefined),
          startDate: form.startDate || undefined,
          managerId: form.managerId || undefined,
          skipEmail: isPreOnboarding,
        });
        setHireResult({
          employeeId: result.employee.id,
          name: `${form.firstName} ${form.lastName}`,
          taskCount: result.taskCount,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[hire] failed:", err);
        setSaveError(`Could not hire: ${msg}`);
      } finally {
        setHiring(false);
      }
      return;
    }

    setSaving(true);

    // If moving to BACKGROUND_CHECK, initiate the check via API AND update candidate (for notifications)
    if (form.status === "BACKGROUND_CHECK" && candidate.status !== "BACKGROUND_CHECK") {
      const bgRes = await fetch("/api/background-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId: candidate.id, options: bgCheckOptions }),
      });
      if (!bgRes.ok) {
        const err = await bgRes.json().catch(() => ({ error: `HTTP ${bgRes.status}` }));
        const detail = typeof err.details === "string" ? err.details : "";
        alert(
          `Failed to send background check: ${err.error || "Unknown error"}${
            detail ? `\n\n${detail}` : ""
          }`
        );
        setSaving(false);
        return;
      }
      // Still call updateCandidate so notifications are sent
      await updateCandidate(candidate.id, {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        linkedinUrl: form.linkedinUrl || undefined,
        skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
        experience: form.experience || undefined,
        source: form.source || undefined,
        notes: form.notes || undefined,
        positionId: form.positionId || undefined,
        costOfHire: form.costOfHire ? parseFloat(form.costOfHire) : undefined,
        hourlyRate: form.hourlyRate ? parseFloat(form.hourlyRate) : undefined,
        managerId: form.managerId || undefined,
        recruiterId: form.recruiterId || undefined,
        status: form.status,
      });
      setSaving(false);
      router.refresh();
      onClose();
      return;
    }

    try {
      await updateCandidate(candidate.id, {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        linkedinUrl: form.linkedinUrl || undefined,
        skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
        experience: form.experience || undefined,
        source: form.source || undefined,
        notes: form.notes || undefined,
        positionId: form.positionId || undefined,
        costOfHire: form.costOfHire ? parseFloat(form.costOfHire) : undefined,
        hourlyRate: form.hourlyRate ? parseFloat(form.hourlyRate) : undefined,
        managerId: form.managerId || undefined,
        recruiterId: form.recruiterId || undefined,
        status: form.status,
      });
      setSaving(false);
      router.refresh();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[save] failed:", err);
      setSaveError(`Could not save: ${msg}`);
      setSaving(false);
    }
  }

  function handleClose() {
    setHireResult(null);
    setScheduleOpen(false);
    onClose();
  }

  async function handleCancelInterview(interviewId: string) {
    setCancellingId(interviewId);
    try {
      await cancelInterview(interviewId);
      if (candidate) await loadInterviews(candidate.id);
    } finally {
      setCancellingId(null);
    }
  }

  const inputClass = cn(
    "w-full px-3 py-2 rounded-lg text-sm",
    "bg-[var(--color-background)] border border-[var(--color-border)]",
    "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
  );

  if (!candidate) return null;

  return (
  <>
    <Dialog open={open} onClose={handleClose} title={hireResult ? "Candidate Hired" : "Edit Candidate"}>
      {hireResult ? (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="h-14 w-14 rounded-full bg-green-500/15 flex items-center justify-center">
            <Icon name="check_circle" size={32} className="text-green-500" />
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-[var(--color-text-primary)]">Employee Created</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {hireResult.name} has been added as an employee with {hireResult.taskCount} onboarding task{hireResult.taskCount !== 1 ? "s" : ""} assigned.
            </p>
          </div>
          <div className="flex gap-2 mt-2">
            <Link
              href={`/people/${hireResult.employeeId}`}
              className={cn("px-4 py-2 rounded-lg text-sm font-medium", "bg-[var(--color-accent)] text-white", "hover:bg-[var(--color-accent-hover)]")}
            >
              Complete Employee Profile
            </Link>
            <Link
              href="/onboarding"
              className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
            >
              View Onboarding
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {/* Do Not Call banner */}
            <div className={cn(
              "rounded-lg border p-3 flex items-start gap-3",
              localDoNotCall
                ? "bg-red-50 border-red-200"
                : "bg-[var(--color-background)] border-[var(--color-border)]"
            )}>
              <Icon
                name={localDoNotCall ? "block" : "phone_enabled"}
                size={18}
                className={cn("shrink-0 mt-0.5", localDoNotCall ? "text-red-600" : "text-[var(--color-text-muted)]")}
              />
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium", localDoNotCall ? "text-red-800" : "text-[var(--color-text-primary)]")}>
                  {localDoNotCall ? "DO NOT CALL — blacklisted" : "Callable"}
                </p>
                {localDoNotCall && localDncReason && (
                  <p className="text-xs text-red-700 mt-0.5">Reason: {localDncReason}</p>
                )}
                {!localDoNotCall && (
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">If this candidate shouldn&apos;t be contacted again, mark them so their name shows red everywhere.</p>
                )}
              </div>
              <button
                onClick={handleToggleDnc}
                disabled={dncBusy}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  localDoNotCall
                    ? "bg-white text-red-700 border border-red-300 hover:bg-red-50"
                    : "bg-red-500 text-white hover:bg-red-600",
                  "disabled:opacity-50"
                )}
              >
                {dncBusy ? "..." : localDoNotCall ? "Remove DNC" : "Mark Do Not Call"}
              </button>
            </div>

            {/* Application history */}
            {applications.length > 0 && (
              <div className="rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-background)]">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="history" size={14} className="text-[var(--color-accent)]" />
                  <p className="text-xs font-semibold text-[var(--color-text-primary)]">Application history ({applications.length})</p>
                </div>
                <div className="space-y-2">
                  {applications.map((a) => {
                    const history = Array.isArray(a.stageHistory) ? (a.stageHistory as Array<{ status: string; at: string; note?: string }>) : [];
                    const appliedDate = new Date(a.appliedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                    return (
                      <div key={a.id} className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-[var(--color-text-primary)]">{a.position?.title || a.positionName}</span>
                          <span className={cn(
                            "px-1.5 py-0.5 rounded-full text-[10px] font-medium",
                            a.status === "HIRED" ? "bg-emerald-500/10 text-emerald-700"
                            : a.status === "REJECTED" ? "bg-red-500/10 text-red-700"
                            : a.status === "OFFER" ? "bg-blue-500/10 text-blue-700"
                            : a.status === "INTERVIEW" ? "bg-purple-500/10 text-purple-700"
                            : "bg-amber-500/10 text-amber-700"
                          )}>{a.status}</span>
                          <span className="text-[10px] text-[var(--color-text-muted)]">· {appliedDate}</span>
                          {a.source && <span className="text-[10px] text-[var(--color-text-muted)]">· {a.source}</span>}
                        </div>
                        {history.length > 1 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {history.map((h, i) => (
                              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg)] text-[var(--color-text-muted)]" title={h.note}>
                                {h.status} · {new Date(h.at).toLocaleDateString()}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Status selector */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1.5">Status</label>
              <div className="flex flex-wrap gap-1.5">
                {statuses.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => update("status", s.value)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                      form.status === s.value
                        ? `${s.color} text-white`
                        : "bg-[var(--color-surface-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Offer Letter — shown when in OFFER stage */}
            {(form.status === "OFFER" || candidate.status === "OFFER") && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-3">
                <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Offer Letter</p>

                {offerSignedAt && offerSignedDocUrl && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <Icon name="verified" size={14} className="text-emerald-500" />
                    <div className="flex-1">
                      <p className="text-xs text-emerald-400 font-medium">
                        Signed on {new Date(offerSignedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                      </p>
                    </div>
                    <a
                      href={offerSignedDocUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                    >
                      <Icon name="download" size={12} />
                      Signed PDF
                    </a>
                  </div>
                )}

                {offerSentAt && !offerSignedAt && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <Icon name="schedule" size={14} className="text-amber-500" />
                    <p className="text-xs text-amber-400">
                      Sent for signing on {new Date(offerSentAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })} — awaiting signature
                    </p>
                  </div>
                )}

                {offerDocUrl ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2 p-2 rounded-lg bg-[var(--color-surface-hover)]">
                      <Icon name="description" size={16} className="text-emerald-400" />
                      <span className="text-xs text-[var(--color-text-primary)] truncate">Offer PDF uploaded</span>
                    </div>
                    <button
                      onClick={() => { setOfferDocUrl(null); setOfferSentAt(null); }}
                      className="p-1.5 rounded text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Remove and upload a different file"
                    >
                      <Icon name="close" size={14} />
                    </button>
                  </div>
                ) : (
                  <label className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-dashed cursor-pointer transition-colors",
                    "border-[var(--color-border)] hover:border-emerald-500/50 hover:bg-emerald-500/5",
                    offerUploading && "opacity-50 pointer-events-none"
                  )}>
                    <Icon name="upload_file" size={24} className="text-[var(--color-text-muted)]" />
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {offerUploading ? "Uploading..." : "Click to upload offer PDF"}
                    </span>
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setOfferUploading(true);
                        setOfferError(null);
                        try {
                          const formData = new FormData();
                          formData.append("file", file);
                          const res = await fetch("/api/onboarding-docs/upload", { method: "POST", body: formData });
                          if (!res.ok) {
                            const data = await res.json();
                            setOfferError(data.error || "Upload failed");
                            return;
                          }
                          const { url } = await res.json();
                          setOfferDocUrl(url);
                        } catch {
                          setOfferError("Upload failed");
                        } finally {
                          setOfferUploading(false);
                        }
                      }}
                    />
                  </label>
                )}

                {offerError && <p className="text-xs text-red-400">{offerError}</p>}

                {offerDocUrl && (
                  <button
                    onClick={async () => {
                      if (!candidate) return;
                      setOfferSending(true);
                      setOfferError(null);
                      const result = await sendOfferLetter(candidate.id, offerDocUrl);
                      if (result.success) {
                        setOfferSentAt(new Date());
                      } else {
                        setOfferError(result.error || "Failed to send offer");
                      }
                      setOfferSending(false);
                    }}
                    disabled={offerSending}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      "bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                    )}
                  >
                    {offerSending ? (
                      <><Icon name="progress_activity" size={14} className="animate-material-spin" />Sending...</>
                    ) : offerSentAt ? (
                      <><Icon name="send" size={14} />Resend Offer</>
                    ) : (
                      <><Icon name="send" size={14} />Send Offer to {candidate.firstName}</>
                    )}
                  </button>
                )}

                <p className="text-[10px] text-[var(--color-text-muted)]">
                  A signing link will be emailed to {form.email || "the candidate"}
                </p>
              </div>
            )}

            {/* Hire fields - shown when switching to HIRED */}
            {form.status === "HIRED" && candidate.status !== "HIRED" && (
              <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 space-y-3">
                <p className="text-xs font-semibold text-green-400 uppercase tracking-wider">Hiring Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
                      Company Email <span className="text-red-400">*</span>
                    </label>
                    <input
                      value={form.companyEmail}
                      onChange={(e) => update("companyEmail", e.target.value)}
                      type="email"
                      placeholder={`${form.firstName.toLowerCase()}.${form.lastName.toLowerCase()}@coastaldebt.com`}
                      className={cn(inputClass, !form.companyEmail && "border-amber-400/50")}
                    />
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                      Required — @coastaldebt.com email for login & comms
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
                      Start Date <span className="text-red-400">*</span>
                    </label>
                    <input
                      value={form.startDate}
                      onChange={(e) => update("startDate", e.target.value)}
                      type="date"
                      required
                      className={inputClass}
                    />
                  </div>
                </div>
                {!form.companyEmail && (
                  <div className="flex items-center gap-2 pt-1">
                    <div className="flex-1 h-px bg-[var(--color-border)]" />
                    <span className="text-[10px] text-[var(--color-text-muted)]">or</span>
                    <div className="flex-1 h-px bg-[var(--color-border)]" />
                  </div>
                )}
                {!form.companyEmail && (
                  <button
                    type="button"
                    onClick={() => {
                      update("status", "HIRED");
                      update("companyEmail", "__PRE_ONBOARDING__");
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-600 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
                  >
                    <Icon name="school" size={14} />
                    Move to Pre-Onboarding (no email needed yet)
                  </button>
                )}
                {form.companyEmail === "__PRE_ONBOARDING__" && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <Icon name="school" size={14} className="text-amber-500" />
                    <p className="text-xs text-amber-600">Will move to Pre-Onboarding — email can be assigned later</p>
                    <button onClick={() => update("companyEmail", "")} className="ml-auto text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">Change</button>
                  </div>
                )}
              </div>
            )}

            {/* Background Check — options when about to initiate */}
            {form.status === "BACKGROUND_CHECK" && candidate.status !== "BACKGROUND_CHECK" && (
              <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3 space-y-3">
                <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider">Background Check Options</p>
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Report Package</label>
                  <select value={bgCheckOptions.report_sku} onChange={(e) => setBgCheckOptions((o) => ({ ...o, report_sku: e.target.value }))} className={inputClass}>
                    <option value="HIRE1">HIRE1 — Basic</option>
                    <option value="HIRE2">HIRE2 — Standard</option>
                    <option value="HIRE3">HIRE3 — Comprehensive</option>
                  </select>
                </div>
                <p className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Criminal & Verification</p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { key: "federal_criminal", label: "Federal Criminal" },
                    { key: "employment", label: "Employment Verification" },
                    { key: "education", label: "Education Verification" },
                    { key: "mvr", label: "Motor Vehicle Record" },
                    { key: "blj", label: "County Criminal" },
                    { key: "drug_test", label: "Drug Test" },
                  ] as const).map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 text-xs text-[var(--color-text-primary)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bgCheckOptions[key] === "Y"}
                        onChange={(e) => setBgCheckOptions((o) => ({ ...o, [key]: e.target.checked ? "Y" : "N" }))}
                        className="rounded border-[var(--color-border)] accent-[var(--color-accent)]"
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <p className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider mt-2">Financial Background</p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { key: "bankruptcy", label: "Bankruptcy Records" },
                    { key: "civil_judgment", label: "Civil Judgments" },
                    { key: "tax_lien", label: "Tax Liens" },
                    { key: "credit_report", label: "Credit Report" },
                  ] as const).map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 text-xs text-[var(--color-text-primary)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bgCheckOptions[key] === "Y"}
                        onChange={(e) => setBgCheckOptions((o) => ({ ...o, [key]: e.target.checked ? "Y" : "N" }))}
                        className="rounded border-[var(--color-border)] accent-[var(--color-accent)]"
                      />
                      {label}
                    </label>
                  ))}
                </div>
                {bgCheckOptions.drug_test === "Y" && (
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Drug Test Panel</label>
                    <select value={bgCheckOptions.drug_sku} onChange={(e) => setBgCheckOptions((o) => ({ ...o, drug_sku: e.target.value }))} className={inputClass}>
                      <option value="drug">Standard Panel</option>
                      <option value="drug9">9-Panel</option>
                      <option value="drug10">10-Panel</option>
                    </select>
                  </div>
                )}
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  An email will be sent to {form.email || "the candidate"} via backgroundchecks.com
                </p>
              </div>
            )}

            {/* Background Check — status when already initiated */}
            {candidate.status === "BACKGROUND_CHECK" && (
              <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3 space-y-2">
                <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider">Background Check</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      bgCheckStatus === "PASSED" ? "bg-green-500" :
                      bgCheckStatus === "FAILED" ? "bg-red-500" :
                      bgCheckStatus === "AWAITING_APPLICANT" ? "bg-yellow-400 animate-pulse" :
                      "bg-orange-400 animate-pulse"
                    )} />
                    <span className="text-sm text-[var(--color-text-primary)]">
                      {bgCheckStatus === "PASSED" ? "Passed — Clear" :
                       bgCheckStatus === "FAILED" ? "Flagged for Review" :
                       bgCheckStatus === "AWAITING_APPLICANT" ? "Awaiting Applicant" :
                       "Processing"}
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={async () => {
                        setBgCheckLoading(true);
                        const res = await fetch(`/api/background-check?candidateId=${candidate.id}`);
                        const data = await res.json();
                        setBgCheckStatus(data.status);
                        setBgCheckLoading(false);
                      }}
                      disabled={bgCheckLoading}
                      className="px-2 py-1 rounded text-xs font-medium bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)] disabled:opacity-50"
                    >
                      {bgCheckLoading ? "Checking..." : "Refresh Status"}
                    </button>
                    {candidate.backgroundCheckId ? (
                      (bgCheckStatus === "PASSED" || bgCheckStatus === "FAILED" || bgCheckStatus === "PENDING") && (
                        <a
                          href={`/api/background-check/${candidate.backgroundCheckId}/pdf`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 rounded text-xs font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] inline-flex items-center gap-1"
                        >
                          <Icon name="description" size={12} />
                          View Report
                        </a>
                      )
                    ) : (bgCheckStatus === "PASSED" || bgCheckStatus === "FAILED") && (
                      <button
                        onClick={async () => {
                          setBgCheckLoading(true);
                          try {
                            const res = await fetch("/api/background-check/link", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ candidateId: candidate.id }),
                            });
                            const data = await res.json();
                            if (!res.ok) {
                              alert(`${data.error || "Could not pull report"}${data.details ? `\n\n${data.details}` : ""}`);
                              return;
                            }
                            // Trigger PDF cache by hitting the report PDF route once,
                            // then refresh so the View Report button shows up.
                            if (data.linkedReportKey) {
                              try {
                                await fetch(`/api/background-check/${data.linkedReportKey}/pdf`, { method: "GET" });
                              } catch {
                                // PDF cache is best-effort here.
                              }
                            }
                            router.refresh();
                          } finally {
                            setBgCheckLoading(false);
                          }
                        }}
                        disabled={bgCheckLoading}
                        title="Search backgroundchecks.com for this candidate's report by email and link it to this profile"
                        className="px-2 py-1 rounded text-xs font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <Icon name="cloud_download" size={12} />
                        {bgCheckLoading ? "Pulling…" : "Pull Report"}
                      </button>
                    )}
                    {(bgCheckStatus === "PENDING" || bgCheckStatus === "AWAITING_APPLICANT") && (
                      <>
                        <button
                          onClick={async () => {
                            setBgCheckLoading(true);
                            await fetch("/api/background-check", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ candidateId: candidate.id, status: "PASSED" }),
                            });
                            setBgCheckStatus("PASSED");
                            setBgCheckLoading(false);
                          }}
                          disabled={bgCheckLoading}
                          className="px-2 py-1 rounded text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          Mark Passed
                        </button>
                        <button
                          onClick={async () => {
                            setBgCheckLoading(true);
                            await fetch("/api/background-check", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ candidateId: candidate.id, status: "FAILED" }),
                            });
                            setBgCheckStatus("FAILED");
                            setBgCheckLoading(false);
                          }}
                          disabled={bgCheckLoading}
                          className="px-2 py-1 rounded text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          Mark Failed
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)]">
                  via backgroundchecks.com
                  {bgCheckStatus === "AWAITING_APPLICANT" && " — candidate needs to complete their form"}
                  {bgCheckStatus === "PASSED" && " — ready to hire"}
                  {bgCheckStatus === "FAILED" && " — review required before proceeding"}
                </p>
                {bgCheckStatus === "FAILED" && (
                  <AdverseActionBlock
                    candidateId={candidate.id}
                    alreadySentAt={candidate.adverseActionLetterSentAt || null}
                  />
                )}
                {(() => {
                  try {
                    const opts = JSON.parse(candidate.backgroundCheckOptions || "{}");
                    const financialChecks = [
                      opts.bankruptcy === "Y" && "Bankruptcy",
                      opts.civil_judgment === "Y" && "Civil Judgments",
                      opts.tax_lien === "Y" && "Tax Liens",
                      opts.credit_report === "Y" && "Credit Report",
                    ].filter(Boolean);
                    const standardChecks = [
                      opts.federal_criminal === "Y" && "Federal Criminal",
                      opts.blj === "Y" && "County Criminal",
                      opts.employment === "Y" && "Employment",
                      opts.education === "Y" && "Education",
                      opts.mvr === "Y" && "MVR",
                      opts.drug_test === "Y" && "Drug Test",
                    ].filter(Boolean);
                    if (financialChecks.length === 0 && standardChecks.length === 0) return null;
                    return (
                      <div className="mt-2 space-y-1.5">
                        {standardChecks.length > 0 && (
                          <div>
                            <p className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-0.5">Checks Requested</p>
                            <div className="flex flex-wrap gap-1">
                              {standardChecks.map((c) => (
                                <span key={c as string} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-500/10 text-orange-400">{c}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {financialChecks.length > 0 && (
                          <div>
                            <p className="text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-0.5">Financial Checks</p>
                            <div className="flex flex-wrap gap-1">
                              {financialChecks.map((c) => (
                                <span key={c as string} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400">{c}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  } catch { return null; }
                })()}
              </div>
            )}

            {/* Manager selector */}
            {employees && employees.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Reporting Manager</label>
                <select value={form.managerId} onChange={(e) => update("managerId", e.target.value)} className={inputClass}>
                  <option value="">Select manager...</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.firstName} {e.lastName} — {e.jobTitle}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Recruiter selector */}
            {recruiters && recruiters.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Recruiter</label>
                <select value={form.recruiterId} onChange={(e) => update("recruiterId", e.target.value)} className={inputClass}>
                  <option value="">Select recruiter...</option>
                  {recruiters.map((r) => (
                    <option key={r.id} value={r.id}>{r.firstName} {r.lastName}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Schedule Interview */}
            {(form.status === "SCREENING" || form.status === "INTERVIEW") && (
              <div>
                <button
                  onClick={() => setScheduleOpen(true)}
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium",
                    "bg-[var(--color-accent)] text-white",
                    "hover:bg-[var(--color-accent-hover)] transition-colors"
                  )}
                >
                  <Icon name="calendar_today" size={16} />
                  Schedule Interview
                </button>
              </div>
            )}

            {/* Scheduled Interviews */}
            {interviews.filter((i) => i.status !== "CANCELLED").length > 0 && (
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1.5">
                  Interviews
                </label>
                <div className="space-y-2">
                  {interviews
                    .filter((i) => i.status !== "CANCELLED")
                    .map((interview) => (
                      <div
                        key={interview.id}
                        className="flex items-center justify-between rounded-lg px-3 py-2 bg-purple-500/10 border border-purple-500/20"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon name="videocam" size={12} className="text-purple-400 shrink-0" />
                          <div className="min-w-0">
                            <span className="text-xs font-medium text-purple-300">
                              {interviewTypeLabels[interview.type]}
                            </span>
                            <p className="text-xs text-[var(--color-text-muted)]">
                              {new Date(interview.scheduledAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                              })}{" "}
                              · {interview.duration}min
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {interview.googleMeetLink && (
                            <a
                              href={interview.googleMeetLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-blue-400 hover:bg-blue-500/10 transition-colors"
                            >
                              <Icon name="open_in_new" size={12} />
                              Join
                            </a>
                          )}
                          <button
                            onClick={() => handleCancelInterview(interview.id)}
                            disabled={cancellingId === interview.id}
                            className="p-1 rounded text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                            title="Cancel interview"
                          >
                            {cancellingId === interview.id ? (
                              <Icon name="progress_activity" size={12} className="animate-material-spin" />
                            ) : (
                              <Icon name="close" size={14} />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Resume — view / upload */}
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon name="description" size={16} className="text-[var(--color-accent)]" />
                  <span className="text-xs font-medium text-[var(--color-text-primary)]">Resume</span>
                  {localResumeUrl ? (
                    localResumeUrl.startsWith("/") ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">On file</span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">Source link only</span>
                    )
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-500">None</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {localResumeUrl && (
                    <a
                      href={localResumeUrl.startsWith("/") ? localResumeUrl : `/api/platforms/jobing/resume?url=${encodeURIComponent(localResumeUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10"
                    >
                      <Icon name="open_in_new" size={12} />
                      View
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => resumeFileInputRef.current?.click()}
                    disabled={resumeUploading}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
                  >
                    <Icon name="upload_file" size={12} />
                    {resumeUploading ? "Uploading…" : localResumeUrl ? "Replace" : "Upload"}
                  </button>
                  <input
                    ref={resumeFileInputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={handleResumeUpload}
                  />
                </div>
              </div>
              {resumeUploadError && (
                <p className="mt-2 text-[11px] text-red-500">{resumeUploadError}</p>
              )}
              {!localResumeUrl && (
                <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
                  No resume on file. Drag a PDF here or click Upload — it gets stored in our database and becomes viewable instantly.
                </p>
              )}
              {localResumeUrl && !localResumeUrl.startsWith("/") && (
                <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
                  This candidate&apos;s resume is hosted on the source platform and the download is currently blocked. Upload a copy from your computer to attach it permanently.
                </p>
              )}
            </div>

            {/* Notes - prominent */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                rows={3}
                className={cn(inputClass, "resize-none")}
                placeholder="Add notes about this candidate..."
              />
            </div>

            {/* Name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">First Name</label>
                <input value={form.firstName} onChange={(e) => update("firstName", e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Last Name</label>
                <input value={form.lastName} onChange={(e) => update("lastName", e.target.value)} className={inputClass} />
              </div>
            </div>

            {/* Email & Phone */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Email</label>
                <input value={form.email} onChange={(e) => update("email", e.target.value)} type="email" className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Phone</label>
                <input value={form.phone} onChange={(e) => update("phone", e.target.value)} className={inputClass} />
              </div>
            </div>

            {/* LinkedIn */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">LinkedIn URL</label>
              <input value={form.linkedinUrl} onChange={(e) => update("linkedinUrl", e.target.value)} className={inputClass} />
            </div>

            {/* Position & Source */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Position</label>
                <select value={form.positionId} onChange={(e) => update("positionId", e.target.value)} className={inputClass}>
                  <option value="">Select position...</option>
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Source</label>
                <select value={form.source} onChange={(e) => update("source", e.target.value)} className={inputClass}>
                  <option value="">Select...</option>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Indeed">Indeed</option>
                  <option value="Referral">Referral</option>
                  <option value="Company Website">Company Website</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* Experience & Skills */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Experience</label>
              <input value={form.experience} onChange={(e) => update("experience", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Skills (comma separated)</label>
              <input value={form.skills} onChange={(e) => update("skills", e.target.value)} className={inputClass} />
            </div>

            {/* Hourly Rate */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Hourly Rate ($)</label>
              <input value={form.hourlyRate} onChange={(e) => update("hourlyRate", e.target.value)} type="number" step="0.01" className={inputClass} placeholder="e.g. 25.00" />
            </div>

            {/* Cost */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Cost of Hire ($)</label>
              <input value={form.costOfHire} onChange={(e) => update("costOfHire", e.target.value)} type="number" className={inputClass} />
            </div>
          </div>

          {saveError && (
            <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">
              {saveError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <button onClick={handleClose} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || hiring || !form.firstName || !form.lastName || !form.email || (form.status === "HIRED" && candidate.status !== "HIRED" && (!form.companyEmail || !form.startDate))}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium text-white",
                form.status === "HIRED" && candidate.status !== "HIRED"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)]",
                "disabled:opacity-50"
              )}
            >
              {hiring ? (
                <span className="flex items-center gap-2"><Icon name="progress_activity" size={16} className="animate-material-spin" />Hiring...</span>
              ) : saving ? (
                "Saving..."
              ) : form.status === "HIRED" && candidate.status !== "HIRED" ? (
                "Save & Hire"
              ) : (
                "Save"
              )}
            </button>
          </div>
        </>
      )}
    </Dialog>

    {candidate && (
      <ScheduleInterviewDialog
        candidateName={`${candidate.firstName} ${candidate.lastName}`}
        candidateId={candidate.id}
        positionId={candidate.positionId}
        calendarConnected={calendarConnected}
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        onScheduled={() => {
          loadInterviews(candidate.id);
          router.refresh();
        }}
      />
    )}
  </>
  );
}
