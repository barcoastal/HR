import { cn, getInitials, displayFirstName, displayName } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { dateKey, daysBetween, formatDateShort, formatTime, isEndOfDay, isStartOfDay, zonedDate, zonedParts } from "@/lib/time-zone";

type Entry = {
  id: string;
  startDate: Date;
  endDate: Date;
  type: string;
  note: string | null;
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    preferredName?: string | null;
    jobTitle: string;
  };
};

const avatarColors = [
  "bg-indigo-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-purple-500",
  "bg-cyan-500",
];

const dayLabel = formatDateShort;
const timeLabel = formatTime;

/** Whole-day entries start at 00:00 and end at 23:59 (company zone) — anything else is timed. */
function isWholeDayBoundary(d: Date) {
  return isStartOfDay(d) || isEndOfDay(d);
}

function Row({ entry, today }: { entry: Entry; today: Date }) {
  const remote = entry.type === "WORKING_REMOTELY";
  const typeLabels: Record<string, string> = {
    OUT_OF_OFFICE: "Out",
    VACATION: "PTO",
    SICK: "Sick",
    MEDICAL_APPOINTMENT: "Appointment",
    WORKING_REMOTELY: "Remote",
  };
  const name = displayName(entry.employee);
  const initials = getInitials(displayFirstName(entry.employee), entry.employee.lastName);
  const colorIdx = displayFirstName(entry.employee).charCodeAt(0) % avatarColors.length;
  const startsIn = daysBetween(today, entry.startDate);
  const backOn = new Date(entry.endDate.getTime() + 1);

  const startTimed = !isWholeDayBoundary(entry.startDate);
  const endTimed = !isWholeDayBoundary(entry.endDate);
  const sameDay = dateKey(entry.startDate) === dateKey(entry.endDate);

  const when =
    startsIn <= 0
      ? endTimed
        ? `back ${dayLabel(entry.endDate)}, ${timeLabel(entry.endDate)}`
        : `back ${dayLabel(backOn)}`
      : sameDay && startTimed && endTimed
        ? `${dayLabel(entry.startDate)}, ${timeLabel(entry.startDate)} – ${timeLabel(entry.endDate)}`
        : startsIn === 1
          ? `tomorrow – ${dayLabel(entry.endDate)}`
          : `${dayLabel(entry.startDate)} – ${dayLabel(entry.endDate)}`;

  return (
    <div className="flex items-center gap-3 py-2">
      <div
        className={cn(
          "h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-white text-[11px] font-bold",
          avatarColors[colorIdx]
        )}
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
          {name}
          <span
            className={cn(
              "ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold align-middle",
              remote ? "bg-cyan-500/15 text-cyan-700" : "bg-amber-500/15 text-amber-700"
            )}
          >
            <Icon name={remote ? "home_work" : "beach_access"} size={11} />
            {typeLabels[entry.type] || "Out"}
          </span>
        </p>
        <p className="text-xs text-[var(--color-text-muted)] truncate">
          {entry.employee.jobTitle}
          {entry.note ? ` · ${entry.note}` : ""}
        </p>
      </div>
      <span className="shrink-0 text-xs font-medium text-[var(--color-text-muted)]">{when}</span>
    </div>
  );
}

export function WhosOutPanel({ entries }: { entries: Entry[] }) {
  const today = new Date();
  const { year, month, day } = zonedParts(today);
  const startOfToday = zonedDate(year, month, day);
  const in7Days = zonedDate(year, month, day + 7);

  const outNow = entries
    .filter((e) => e.startDate <= today && e.endDate >= startOfToday)
    .sort((a, b) => a.endDate.getTime() - b.endDate.getTime());

  const upcoming = entries
    .filter((e) => e.startDate > today && e.startDate <= in7Days)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex items-center gap-2 mb-1">
        <Icon name="beach_access" size={18} className="text-amber-500" />
        <h2 className="text-sm font-bold text-[var(--color-text-primary)]">Who&apos;s out</h2>
        {outNow.length > 0 && (
          <span className="ml-auto text-xs font-semibold text-[var(--color-text-muted)] bg-[var(--color-surface-container)] px-2 py-0.5 rounded-full">
            {outNow.length} today
          </span>
        )}
      </div>

      {outNow.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] mt-2">Everyone is in today.</p>
      ) : (
        <div className="divide-y divide-[var(--color-border)]">
          {outNow.map((e) => (
            <Row key={e.id} entry={e} today={today} />
          ))}
        </div>
      )}

      {upcoming.length > 0 && (
        <>
          <p className="mt-4 mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Coming up this week
          </p>
          <div className="divide-y divide-[var(--color-border)]">
            {upcoming.map((e) => (
              <Row key={e.id} entry={e} today={today} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
