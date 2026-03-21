"use client";

import { cn, getInitials } from "@/lib/utils";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { assignCandidateToPosition, createCandidate } from "@/lib/actions/candidates";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";

type SimpleCandidate = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  skills: string | null;
  positionId: string | null;
};

type Recruiter = {
  id: string;
  firstName: string;
  lastName: string;
};

const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500"];

export function AddCandidateToPosition({
  positionId,
  positionTitle,
  existingCandidates,
  recruiters = [],
}: {
  positionId: string;
  positionTitle: string;
  existingCandidates: SimpleCandidate[];
  recruiters?: Recruiter[];
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"existing" | "new">("existing");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedRecruiterId, setSelectedRecruiterId] = useState(
    recruiters.length === 1 ? recruiters[0].id : ""
  );
  const [newForm, setNewForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    skills: "",
  });
  const router = useRouter();

  const hasRecruiters = recruiters.length > 0;

  // Filter candidates not already assigned to this position
  const available = existingCandidates.filter(
    (c) => c.positionId !== positionId
  );
  const filtered = available.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.firstName.toLowerCase().includes(q) ||
      c.lastName.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q)
    );
  });

  async function handleAssign(candidateId: string) {
    if (hasRecruiters && !selectedRecruiterId) return;
    setSaving(true);
    await assignCandidateToPosition(candidateId, positionId, selectedRecruiterId || undefined);
    setSaving(false);
    router.refresh();
  }

  async function handleCreateNew() {
    if (!newForm.firstName || !newForm.lastName || !newForm.email) return;
    if (hasRecruiters && !selectedRecruiterId) return;
    setSaving(true);
    const skills = newForm.skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    await createCandidate({
      firstName: newForm.firstName,
      lastName: newForm.lastName,
      email: newForm.email,
      phone: newForm.phone || undefined,
      skills,
      positionId,
      recruiterId: selectedRecruiterId || undefined,
      inPipeline: true,
    });
    setSaving(false);
    setOpen(false);
    setNewForm({ firstName: "", lastName: "", email: "", phone: "", skills: "" });
    router.refresh();
  }

  const inputClass = cn(
    "w-full px-3 py-2 rounded-lg text-sm",
    "bg-[var(--color-background)] border border-[var(--color-border)]",
    "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
  );

  const recruiterSelector = hasRecruiters ? (
    <div className="mb-3">
      <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
        Assign Recruiter *
      </label>
      <select
        value={selectedRecruiterId}
        onChange={(e) => setSelectedRecruiterId(e.target.value)}
        className={cn(inputClass, !selectedRecruiterId && "text-[var(--color-text-muted)]")}
      >
        <option value="">Select recruiter...</option>
        {recruiters.map((r) => (
          <option key={r.id} value={r.id}>
            {r.firstName} {r.lastName}
          </option>
        ))}
      </select>
    </div>
  ) : null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
          "text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors"
        )}
      >
        <Icon name="person_add" size={12} />Add Candidate
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title={`Add Candidate to ${positionTitle}`}>
        {recruiterSelector}

        <div className="flex gap-1 mb-4">
          <button
            onClick={() => setTab("existing")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              tab === "existing"
                ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
            )}
          >
            <Icon name="search" size={12} className="inline mr-1.5" />From Database
          </button>
          <button
            onClick={() => setTab("new")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              tab === "new"
                ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
            )}
          >
            <Icon name="add" size={12} className="inline mr-1.5" />New Candidate
          </button>
        </div>

        {tab === "existing" && (
          <div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search candidates..."
              className={cn(inputClass, "mb-3")}
            />
            <div className="max-h-64 overflow-y-auto space-y-1">
              {filtered.length === 0 && (
                <p className="text-sm text-[var(--color-text-muted)] text-center py-4">
                  No candidates found
                </p>
              )}
              {filtered.map((c) => {
                const initials = getInitials(c.firstName, c.lastName);
                const colorIdx = c.firstName.charCodeAt(0) % avatarColors.length;
                return (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-semibold",
                          avatarColors[colorIdx]
                        )}
                      >
                        {initials}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--color-text-primary)]">
                          {c.firstName} {c.lastName}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">{c.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAssign(c.id)}
                      disabled={saving || (hasRecruiters && !selectedRecruiterId)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-medium",
                        "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]",
                        "disabled:opacity-50"
                      )}
                    >
                      Add
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "new" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">First Name</label>
                <input
                  value={newForm.firstName}
                  onChange={(e) => setNewForm((f) => ({ ...f, firstName: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Last Name</label>
                <input
                  value={newForm.lastName}
                  onChange={(e) => setNewForm((f) => ({ ...f, lastName: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Email</label>
              <input
                value={newForm.email}
                onChange={(e) => setNewForm((f) => ({ ...f, email: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Phone</label>
              <input
                value={newForm.phone}
                onChange={(e) => setNewForm((f) => ({ ...f, phone: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Skills (comma separated)</label>
              <input
                value={newForm.skills}
                onChange={(e) => setNewForm((f) => ({ ...f, skills: e.target.value }))}
                placeholder="React, TypeScript, Node.js"
                className={inputClass}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]">
                Cancel
              </button>
              <button
                onClick={handleCreateNew}
                disabled={saving || !newForm.firstName || !newForm.lastName || !newForm.email || (hasRecruiters && !selectedRecruiterId)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium",
                  "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]",
                  "disabled:opacity-50"
                )}
              >
                {saving ? "Adding..." : "Add Candidate"}
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
