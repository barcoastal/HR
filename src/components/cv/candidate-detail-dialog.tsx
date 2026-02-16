"use client";

import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { updateCandidate, hireCandidateAndStartOnboarding } from "@/lib/actions/candidates";
import { useRouter } from "next/navigation";
import type { CandidateStatus } from "@/generated/prisma/client";
import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";

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
    onClose();
  }

  const inputClass = cn(
    "w-full px-3 py-2 rounded-lg text-sm",
    "bg-[var(--color-background)] border border-[var(--color-border)]",
    "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
  );

  if (!candidate) return null;

  return (
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
  );
}
