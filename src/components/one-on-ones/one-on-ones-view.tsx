"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn, getInitials } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { reschedule, sendInvite, cancelMeeting } from "@/lib/actions/one-on-ones";

type Person = {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  profilePhoto: string | null;
};

type Meeting = {
  id: string;
  type: "THIRTY_DAY" | "QUARTERLY" | "ANNUAL";
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  scheduledAt: string;
  completedAt: string | null;
  meetingLink: string | null;
  employee: Person;
  manager: Person;
};

const TYPE_LABEL: Record<Meeting["type"], string> = {
  THIRTY_DAY: "30-Day",
  QUARTERLY: "Quarterly",
  ANNUAL: "Annual",
};

const TYPE_COLOR: Record<Meeting["type"], string> = {
  THIRTY_DAY: "bg-blue-500/15 text-blue-400",
  QUARTERLY: "bg-purple-500/15 text-purple-400",
  ANNUAL: "bg-emerald-500/15 text-emerald-400",
};

const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500"];

function colorFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return avatarColors[Math.abs(hash) % avatarColors.length];
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function OneOnOnesView({
  meetings,
  currentEmployeeId,
  currentRole,
}: {
  meetings: Meeting[];
  currentEmployeeId: string | null;
  currentRole: string;
}) {
  const [tab, setTab] = useState<"upcoming" | "completed">("upcoming");

  const upcoming = meetings.filter((m) => m.status === "SCHEDULED").sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const completed = meetings.filter((m) => m.status === "COMPLETED").sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""));

  const list = tab === "upcoming" ? upcoming : completed;

  return (
    <div>
      <div className="flex items-center gap-2 mb-6 border-b border-[var(--color-border)]">
        {(["upcoming", "completed"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t
                ? "border-[var(--color-accent)] text-[var(--color-text-primary)]"
                : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            )}
          >
            {t === "upcoming" ? `Upcoming (${upcoming.length})` : `Completed (${completed.length})`}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-text-muted)]">
          <Icon name="event" size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">No {tab === "upcoming" ? "upcoming" : "completed"} 1:1s.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((m) => (
            <MeetingRow
              key={m.id}
              meeting={m}
              canEdit={currentRole === "SUPER_ADMIN" || currentRole === "ADMIN" || currentRole === "HR" || m.manager.id === currentEmployeeId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MeetingRow({ meeting: m, canEdit }: { meeting: Meeting; canEdit: boolean }) {
  return (
    <Link
      href={`/one-on-ones/${m.id}`}
      className={cn(
        "flex items-center gap-4 px-5 py-4 rounded-xl border transition-colors",
        "bg-[var(--color-surface)] border-[var(--color-border)] hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface-hover)]"
      )}
    >
      <div className="flex -space-x-2 shrink-0">
        <Avatar person={m.employee} />
        <Avatar person={m.manager} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
            {m.employee.firstName} {m.employee.lastName}
          </span>
          <span className="text-xs text-[var(--color-text-muted)]">with</span>
          <span className="text-sm text-[var(--color-text-primary)] truncate">
            {m.manager.firstName} {m.manager.lastName}
          </span>
          <span className={cn("text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded", TYPE_COLOR[m.type])}>
            {TYPE_LABEL[m.type]}
          </span>
        </div>
        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
          {m.status === "COMPLETED" && m.completedAt
            ? `Completed ${fmtDate(m.completedAt)}`
            : fmtDateTime(m.scheduledAt)}
        </div>
      </div>
      {canEdit && m.status === "SCHEDULED" && (
        <span className="text-xs text-[var(--color-text-muted)] hidden sm:inline">Open</span>
      )}
      <Icon name="chevron_right" size={18} className="text-[var(--color-text-muted)]" />
    </Link>
  );
}

function Avatar({ person }: { person: Person }) {
  if (person.profilePhoto) {
    return (
      <img
        src={person.profilePhoto}
        alt={`${person.firstName} ${person.lastName}`}
        className="w-9 h-9 rounded-full object-cover ring-2 ring-[var(--color-surface)]"
      />
    );
  }
  return (
    <div
      className={cn(
        "w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold ring-2 ring-[var(--color-surface)]",
        colorFor(person.id)
      )}
    >
      {getInitials(person.firstName, person.lastName)}
    </div>
  );
}

// Used by the detail page client component below — kept separate to keep the
// list lean.
export function MeetingActions({
  meetingId,
  scheduledAt,
  status,
  canEdit,
}: {
  meetingId: string;
  scheduledAt: string;
  status: Meeting["status"];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showReschedule, setShowReschedule] = useState(false);
  const [newDate, setNewDate] = useState(scheduledAt.slice(0, 16));

  if (!canEdit) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {status === "SCHEDULED" && (
        <>
          <button
            onClick={() =>
              startTransition(async () => {
                const r = await sendInvite(meetingId);
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
                if (!confirm("Cancel this 1:1?")) return;
                await cancelMeeting(meetingId);
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
      {showReschedule && (
        <div className="flex items-center gap-2 ml-2">
          <input
            type="datetime-local"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="px-2 py-1 rounded text-xs bg-[var(--color-background)] border border-[var(--color-border)]"
          />
          <button
            onClick={() =>
              startTransition(async () => {
                await reschedule(meetingId, new Date(newDate));
                setShowReschedule(false);
                router.refresh();
              })
            }
            disabled={pending}
            className="px-2 py-1 rounded text-xs font-medium bg-[var(--color-accent)] text-white"
          >
            Save
          </button>
        </div>
      )}
    </div>
  );
}
