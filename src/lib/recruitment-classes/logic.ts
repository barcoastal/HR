/**
 * Pure, client-safe helpers for recruitment classes (cohorts of candidates
 * who start a role on the same date). No database or Node APIs here.
 */

export type ClassColor = "RED" | "YELLOW" | "GREEN";
export type ClassStatus = "UPCOMING" | "STARTED" | "CANCELLED";

export const CLASS_COLORS: ClassColor[] = ["GREEN", "YELLOW", "RED"];

export const CLASS_COLOR_META: Record<ClassColor, { label: string; meaning: string; dot: string; chip: string }> = {
  GREEN: {
    label: "Green",
    meaning: "Cleared and ready to start",
    dot: "bg-emerald-500",
    chip: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  },
  YELLOW: {
    label: "Yellow",
    meaning: "In process",
    dot: "bg-amber-400",
    chip: "bg-amber-400/15 text-amber-700 border-amber-400/40",
  },
  RED: {
    label: "Red",
    meaning: "Not moving forward",
    dot: "bg-red-500",
    chip: "bg-red-500/10 text-red-700 border-red-500/30",
  },
};

export const CLASS_STATUS_LABEL: Record<ClassStatus, string> = {
  UPCOMING: "Upcoming",
  STARTED: "Started",
  CANCELLED: "Cancelled",
};

export function isClassColor(value: unknown): value is ClassColor {
  return value === "RED" || value === "YELLOW" || value === "GREEN";
}

export type ColorCounts = Record<ClassColor, number> & { total: number };

export function countByColor(members: { color: ClassColor }[]): ColorCounts {
  const counts: ColorCounts = { GREEN: 0, YELLOW: 0, RED: 0, total: 0 };
  for (const m of members) {
    if (!isClassColor(m.color)) continue;
    counts[m.color] += 1;
    counts.total += 1;
  }
  return counts;
}

/** Parses a strict YYYY-MM-DD key into a UTC day number, or null. */
function dayNumber(key: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const ms = Date.UTC(year, month - 1, day);
  const d = new Date(ms);
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return Math.round(ms / 86_400_000);
}

export function isValidDateKey(key: string): boolean {
  return dayNumber(key) !== null;
}

/** Whole days from `todayKey` to `startKey` (both YYYY-MM-DD). Negative = in the past. */
export function daysUntil(startKey: string, todayKey: string): number {
  const a = dayNumber(startKey);
  const b = dayNumber(todayKey);
  if (a === null || b === null) return NaN;
  return a - b;
}

export function describeDaysUntil(days: number): string {
  if (Number.isNaN(days)) return "";
  if (days === 0) return "Starts today";
  if (days === 1) return "Starts tomorrow";
  if (days > 1) return `In ${days} days`;
  if (days === -1) return "Started yesterday";
  return `Started ${-days} days ago`;
}

/**
 * A class is "past" once its start date has gone by, or once HR marks it
 * started or cancelled. Classes starting today are still current.
 */
export function isPastClass(c: { startDate: string; status: ClassStatus }, todayKey: string): boolean {
  if (c.status !== "UPCOMING") return true;
  return daysUntil(c.startDate, todayKey) < 0;
}

/**
 * Upcoming classes soonest first; past classes most recent first. Ties fall
 * back to name so the order is stable.
 */
export function splitAndSortClasses<T extends { startDate: string; status: ClassStatus; name: string }>(
  classes: T[],
  todayKey: string,
): { upcoming: T[]; past: T[] } {
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const c of classes) (isPastClass(c, todayKey) ? past : upcoming).push(c);
  const byName = (a: T, b: T) => a.name.localeCompare(b.name);
  upcoming.sort((a, b) => a.startDate.localeCompare(b.startDate) || byName(a, b));
  past.sort((a, b) => b.startDate.localeCompare(a.startDate) || byName(a, b));
  return { upcoming, past };
}

/** Members sorted Green, Yellow, Red, then by name. */
export function sortMembers<T extends { color: ClassColor; name: string }>(members: T[]): T[] {
  const rank: Record<ClassColor, number> = { GREEN: 0, YELLOW: 1, RED: 2 };
  return [...members].sort((a, b) => rank[a.color] - rank[b.color] || a.name.localeCompare(b.name));
}

/** How many more Green candidates are needed to hit the target; null when no target. */
export function remainingToTarget(counts: ColorCounts, target: number | null | undefined): number | null {
  if (target == null || target <= 0) return null;
  return Math.max(0, target - counts.GREEN);
}

function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  // Neutralise spreadsheet formula injection (phone numbers like "+1 555…"
  // stay as-is), then quote when needed.
  const safe = /^[=@\t\r]/.test(s) || /^[+-][^\d\s(]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export type RosterRow = {
  name: string;
  color: ClassColor;
  stage: string;
  email: string;
  phone: string | null;
  recruiter: string | null;
  note: string | null;
};

export function rosterToCsv(rows: RosterRow[]): string {
  const header = ["Name", "Color", "Meaning", "Stage", "Email", "Phone", "Recruiter", "Note"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [r.name, CLASS_COLOR_META[r.color].label, CLASS_COLOR_META[r.color].meaning, r.stage, r.email, r.phone, r.recruiter, r.note]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\n");
}

const STATUS_FALLBACK_LABEL: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  SCREENING: "Screening",
  INTERVIEW: "Interview",
  OFFER: "Offer",
  BACKGROUND_CHECK: "BG Check",
  PRE_ONBOARDING: "Written Offer",
  ONBOARDING: "Onboarding",
  OFFBOARDING: "Offboarding",
  HIRED: "Hired",
  REJECTED: "Rejected",
};

/**
 * The candidate's current pipeline stage label, resolved the same way the
 * Recruitment board picks a column: explicit stageId, then the legacy stage
 * id for the status, then the first stage mapping that status.
 */
export function stageLabelFor(
  candidate: { status: string; stageId?: string | null },
  stages: { id: string; label: string; enumValue: string }[],
  legacyIdByStatus: Record<string, string>,
): string {
  if (candidate.stageId) {
    const s = stages.find((st) => st.id === candidate.stageId);
    if (s) return s.label;
  }
  const legacyId = legacyIdByStatus[candidate.status];
  const legacy = legacyId ? stages.find((st) => st.id === legacyId) : undefined;
  if (legacy) return legacy.label;
  const byStatus = stages.find((st) => st.enumValue === candidate.status);
  if (byStatus) return byStatus.label;
  return STATUS_FALLBACK_LABEL[candidate.status] ?? candidate.status;
}
