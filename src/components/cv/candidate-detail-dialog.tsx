"use client";

import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { useState, useEffect, useCallback } from "react";
import { updateCandidate, hireCandidateAndStartOnboarding } from "@/lib/actions/candidates";
import { getInterviewsForCandidate, cancelInterview, isCalendarConnected } from "@/lib/actions/interviews";
import { useRouter } from "next/navigation";
import type { CandidateStatus, InterviewType, InterviewStatus } from "@/generated/prisma/client";
import { CheckCircle2, Loader2, Calendar, Video, X as XIcon, ExternalLink } from "lucide-react";
import Link from "next/link";
import { ScheduleInterviewDialog } from "./schedule-interview-dialog";

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
  position: { title: string } | null;
};

type Position = { id: string; title: string };

function parseSkills(skills: string | null): string {
  if (!skills) return "";
  try {
    const parsed = JSON.parse(skills);
    return Array.isArray(parsed) ? parsed.join(", ") : skills;
  } catch {
    return skills;
  }
}

const statuses: { value: CandidateStatus; label: string; color: string }[] = [
  { value: "NEW", label: "New", color: "bg-blue-500" },
  { value: "SCREENING", label: "Screening", color: "bg-amber-500" },
  { value: "INTERVIEW", label: "Interview", color: "bg-purple-500" },
  { value: "OFFER", label: "Offer", color: "bg-emerald-500" },
  { value: "HIRED", label: "Hired", color: "bg-green-500" },
  { value: "REJECTED", label: "Rejected", color: "bg-red-500" },
];

export function CandidateDetailDialog({
  candidate,
  positions,
  open,
  onClose,
}: {
  candidate: CandidateForDialog | null;
  positions: Position[];
  open: boolean;
  onClose: () => void;
}) {
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
    status: "NEW" as CandidateStatus,
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
        status: candidate.status,
      });
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
        });
        const result = await hireCandidateAndStartOnboarding(candidate.id);
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
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-[var(--color-text-primary)]">Employee Created</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {hireResult.name} has been added as an employee with {hireResult.taskCount} onboarding task{hireResult.taskCount !== 1 ? "s" : ""} assigned.
            </p>
          </div>
          <div className="flex gap-2 mt-2">
            <Link
              href="/onboarding"
              className={cn("px-4 py-2 rounded-lg text-sm font-medium", "bg-[var(--color-accent)] text-white", "hover:bg-[var(--color-accent-hover)]")}
            >
              View Onboarding
            </Link>
            <Link
              href={`/people/${hireResult.employeeId}`}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
            >
              View Employee
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
                  <Calendar className="h-4 w-4" />
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
                          <Video className="h-3.5 w-3.5 text-purple-400 shrink-0" />
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
                              <ExternalLink className="h-3 w-3" />
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
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <XIcon className="h-3.5 w-3.5" />
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
              disabled={saving || hiring || !form.firstName || !form.lastName || !form.email}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium text-white",
                form.status === "HIRED" && candidate.status !== "HIRED"
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)]",
                "disabled:opacity-50"
              )}
            >
              {hiring ? (
                <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Hiring...</span>
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
