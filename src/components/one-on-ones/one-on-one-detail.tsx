"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn, getInitials } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import {
  updateNotebook,
  updateMeetingLink,
  reschedule,
  sendInvite,
  cancelMeeting,
  markComplete,
} from "@/lib/actions/one-on-ones";

type Person = {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  email: string;
  profilePhoto: string | null;
};

type Meeting = {
  id: string;
  type: "THIRTY_DAY" | "QUARTERLY" | "ANNUAL";
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  scheduledAt: string;
  completedAt: string | null;
  notebookMarkdown: string | null;
  meetingLink: string | null;
  employee: Person;
  manager: Person;
};

type HistoryEntry = {
  id: string;
  type: "THIRTY_DAY" | "QUARTERLY" | "ANNUAL";
  completedAt: string | null;
  scheduledAt: string;
  notebookMarkdown: string | null;
  managerName: string;
};

const TYPE_LABEL: Record<Meeting["type"], string> = {
  THIRTY_DAY: "30-Day Check-In",
  QUARTERLY: "Quarterly Review",
  ANNUAL: "Annual Review",
};

const STATUS_BADGE: Record<Meeting["status"], string> = {
  SCHEDULED: "bg-blue-500/15 text-blue-400",
  COMPLETED: "bg-emerald-500/15 text-emerald-400",
  CANCELLED: "bg-gray-500/15 text-gray-400",
};

const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500"];
function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return avatarColors[Math.abs(h) % avatarColors.length];
}

export function OneOnOneDetail({
  meeting,
  history,
  canEdit,
}: {
  meeting: Meeting;
  history: HistoryEntry[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [notebook, setNotebook] = useState(meeting.notebookMarkdown || "");
  const [savedNotebook, setSavedNotebook] = useState(meeting.notebookMarkdown || "");
  const [meetingLink, setMeetingLink] = useState(meeting.meetingLink || "");
  const [showReschedule, setShowReschedule] = useState(false);
  const [newDate, setNewDate] = useState(meeting.scheduledAt.slice(0, 16));

  const dirty = notebook !== savedNotebook;

  return (
    <div>
      <Link href="/one-on-ones" className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] mb-4">
        <Icon name="arrow_back" size={14} /> Back to 1:1s
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">{TYPE_LABEL[meeting.type]}</h1>
            <span className={cn("text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded", STATUS_BADGE[meeting.status])}>
              {meeting.status}
            </span>
          </div>
          <p className="text-sm text-[var(--color-text-muted)]">
            {meeting.status === "COMPLETED" && meeting.completedAt
              ? `Completed ${new Date(meeting.completedAt).toLocaleString()}`
              : new Date(meeting.scheduledAt).toLocaleString()}
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2 flex-wrap">
            {meeting.status === "SCHEDULED" && (
              <>
                <button
                  onClick={() =>
                    startTransition(async () => {
                      const r = await sendInvite(meeting.id);
                      if (!r.success) alert(r.error || "Failed");
                      else alert("Invite sent");
                    })
                  }
                  disabled={pending}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50 flex items-center gap-1"
                >
                  <Icon name="mail" size={14} /> Send invite
                </button>
                <button
                  onClick={() => setShowReschedule((v) => !v)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-surface-hover)] text-[var(--color-text-primary)] flex items-center gap-1"
                >
                  <Icon name="event" size={14} /> Reschedule
                </button>
                <button
                  onClick={() =>
                    startTransition(async () => {
                      if (!confirm("Mark this 1:1 as completed?")) return;
                      await markComplete(meeting.id);
                      router.refresh();
                    })
                  }
                  disabled={pending}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 flex items-center gap-1 disabled:opacity-50"
                >
                  <Icon name="check" size={14} /> Mark complete
                </button>
                <button
                  onClick={() =>
                    startTransition(async () => {
                      if (!confirm("Cancel this 1:1?")) return;
                      await cancelMeeting(meeting.id);
                      router.refresh();
                    })
                  }
                  disabled={pending}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 flex items-center gap-1 disabled:opacity-50"
                >
                  <Icon name="cancel" size={14} /> Cancel
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {showReschedule && canEdit && (
        <div className="mb-4 flex items-center gap-2">
          <input
            type="datetime-local"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm bg-[var(--color-background)] border border-[var(--color-border)]"
          />
          <button
            onClick={() =>
              startTransition(async () => {
                await reschedule(meeting.id, new Date(newDate));
                setShowReschedule(false);
                router.refresh();
              })
            }
            disabled={pending}
            className="px-3 py-2 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white"
          >
            Save
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <PersonCard label="Employee" person={meeting.employee} />
        <PersonCard label="Manager" person={meeting.manager} />
      </div>

      {canEdit && (
        <div className="mb-6">
          <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Meeting link (optional)</label>
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              placeholder="https://meet.google.com/..."
              className="flex-1 px-3 py-2 rounded-lg text-sm bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-primary)]"
            />
            <button
              onClick={() =>
                startTransition(async () => {
                  await updateMeetingLink(meeting.id, meetingLink || null);
                })
              }
              disabled={pending}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]"
            >
              Save
            </button>
          </div>
        </div>
      )}

      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wider">Notebook</h2>
          {!canEdit && <span className="text-xs text-[var(--color-text-muted)]">Manager-only</span>}
        </div>
        {canEdit ? (
          <>
            <textarea
              value={notebook}
              onChange={(e) => setNotebook(e.target.value)}
              rows={14}
              placeholder="Agenda, talking points, follow-ups, decisions..."
              className="w-full px-4 py-3 rounded-xl text-sm bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
            />
            <div className="flex items-center justify-end mt-2 gap-2">
              {dirty && <span className="text-xs text-amber-400">Unsaved changes</span>}
              <button
                onClick={() =>
                  startTransition(async () => {
                    await updateNotebook(meeting.id, notebook);
                    setSavedNotebook(notebook);
                  })
                }
                disabled={pending || !dirty}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "Saving..." : "Save notebook"}
              </button>
            </div>
          </>
        ) : (
          <div className="px-4 py-3 rounded-xl text-sm bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-primary)] whitespace-pre-wrap min-h-[8rem]">
            {meeting.notebookMarkdown?.trim() || (
              <span className="text-[var(--color-text-muted)] italic">No notes yet.</span>
            )}
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)] uppercase tracking-wider mb-3">
            Prior 1:1s with {meeting.employee.firstName}
          </h2>
          <div className="space-y-3">
            {history.map((h) => (
              <details key={h.id} className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                <summary className="px-4 py-3 cursor-pointer flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Icon name="history" size={14} className="text-[var(--color-text-muted)]" />
                    <span className="font-medium text-[var(--color-text-primary)]">
                      {TYPE_LABEL[h.type]}
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {h.completedAt ? new Date(h.completedAt).toLocaleDateString() : new Date(h.scheduledAt).toLocaleDateString()}
                    </span>
                    <span className="text-xs text-[var(--color-text-muted)]">· {h.managerName}</span>
                  </div>
                  <Icon name="expand_more" size={16} className="text-[var(--color-text-muted)] group-open:rotate-180 transition-transform" />
                </summary>
                <div className="px-4 pb-4 text-sm text-[var(--color-text-primary)] whitespace-pre-wrap">
                  {h.notebookMarkdown?.trim() || <span className="text-[var(--color-text-muted)] italic">No notes recorded.</span>}
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PersonCard({ label, person }: { label: string; person: Person }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 flex items-center gap-3">
      {person.profilePhoto ? (
        <img src={person.profilePhoto} alt="" className="w-10 h-10 rounded-full object-cover" />
      ) : (
        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold", colorFor(person.id))}>
          {getInitials(person.firstName, person.lastName)}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">{label}</p>
        <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
          {person.firstName} {person.lastName}
        </p>
        <p className="text-xs text-[var(--color-text-muted)] truncate">{person.jobTitle}</p>
      </div>
    </div>
  );
}
