"use client";

import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { useState, useEffect, useCallback } from "react";
import { updateCandidate, hireCandidateAndStartOnboarding } from "@/lib/actions/candidates";
import { getInterviewsForCandidate, cancelInterview, isCalendarConnected } from "@/lib/actions/interviews";
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
  status: CandidateStatus;
  positionId: string | null;
  costOfHire: number | null;
  managerId: string | null;
  recruiterId: string | null;
  backgroundCheckStatus: string | null;
  position: { title: string } | null;
};

type Position = { id: string; title: string };
type EmployeeOption = { id: string; firstName: string; lastName: string; jobTitle: string };
type Recruiter = { id: string; firstName: string; lastName: string };

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
    employment: "Y",
    education: "Y",
    blj: "Y",
    federal_criminal: "Y",
  });
  const router = useRouter();

  const [interviews, setInterviews] = useState<InterviewForDisplay[]>([]);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

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
    }
  }, [candidate, open, loadInterviews]);

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
        managerId: candidate.managerId || "",
        recruiterId: candidate.recruiterId || "",
        status: candidate.status,
        companyEmail: "",
        startDate: new Date().toISOString().split("T")[0],
      });
      setBgCheckStatus(candidate.backgroundCheckStatus || null);
      setHireResult(null);
    }
  }, [candidate]);

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!candidate) return;

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
      } finally {
        setHiring(false);
      }
      return;
    }

    setSaving(true);

    // If moving to BACKGROUND_CHECK, initiate the check via API
    if (form.status === "BACKGROUND_CHECK" && candidate.status !== "BACKGROUND_CHECK") {
      await fetch("/api/background-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId: candidate.id, options: bgCheckOptions }),
      });
      setSaving(false);
      router.refresh();
      onClose();
      return;
    }

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
      managerId: form.managerId || undefined,
      recruiterId: form.recruiterId || undefined,
      status: form.status,
    });
    setSaving(false);
    router.refresh();
    onClose();
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
                      Start Date
                    </label>
                    <input
                      value={form.startDate}
                      onChange={(e) => update("startDate", e.target.value)}
                      type="date"
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

            {/* Cost */}
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Cost of Hire ($)</label>
              <input value={form.costOfHire} onChange={(e) => update("costOfHire", e.target.value)} type="number" className={inputClass} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button onClick={handleClose} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || hiring || !form.firstName || !form.lastName || !form.email || (form.status === "HIRED" && candidate.status !== "HIRED" && !form.companyEmail)}
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
