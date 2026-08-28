/**
 * Company-time-zone date helpers.
 *
 * Every function here takes an instant (`Date`) and answers in the company's
 * zone, so the result is identical on a UTC production server, an Eastern
 * laptop, or a browser anywhere in the world. The module is pure and
 * client-safe: no Node APIs, no database, only `Intl.DateTimeFormat`.
 *
 * Conventions mirror the built-in `Date` API: `month` is 0-indexed and
 * `weekday` is 0 (Sunday) through 6 (Saturday).
 */

const DEFAULT_TIME_ZONE = "America/New_York";

function envTimeZone(): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  // NEXT_PUBLIC_ is the only form Next.js inlines into client bundles; the
  // plain name works on the server and mirrors the email layer's override.
  return process.env.NEXT_PUBLIC_COMPANY_TIME_ZONE || process.env.COMPANY_TIME_ZONE || undefined;
}

/** IANA zone every calendar date/time is displayed and bucketed in. */
export const COMPANY_TIME_ZONE: string = envTimeZone() || DEFAULT_TIME_ZONE;

export type ZonedParts = {
  year: number;
  /** 0-indexed, like `Date#getMonth`. */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday … 6 = Saturday, like `Date#getDay`. */
  weekday: number;
};

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string) {
  let formatter = partsFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      weekday: "short",
      hourCycle: "h23",
    });
    partsFormatters.set(timeZone, formatter);
  }
  return formatter;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/** Wall-clock parts of an instant in the company zone. */
export function zonedParts(date: Date, timeZone: string = COMPANY_TIME_ZONE): ZonedParts {
  const values: Record<string, string> = {};
  for (const part of partsFormatter(timeZone).formatToParts(date)) values[part.type] = part.value;
  return {
    year: Number(values.year),
    month: Number(values.month) - 1,
    day: Number(values.day),
    // Some ICU builds print midnight as "24" even with hourCycle h23.
    hour: Number(values.hour) % 24,
    minute: Number(values.minute),
    second: Number(values.second),
    weekday: WEEKDAY_INDEX[values.weekday] ?? 0,
  };
}

/** `YYYY-MM-DD` of the instant in the company zone. Sorts and compares as a string. */
export function dateKey(date: Date, timeZone: string = COMPANY_TIME_ZONE): string {
  const { year, month, day } = zonedParts(date, timeZone);
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

/** Parse a `YYYY-MM-DD` key (or `<input type="date">` value) into calendar parts. */
export function parseDateKey(key: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/** Parse an `HH:MM` value (or `<input type="time">` value). */
export function parseTimeKey(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/** Offset (ms) the zone is ahead of UTC at `date`; negative for the Americas. */
function offsetMs(date: Date, timeZone: string) {
  const parts = zonedParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - (date.getTime() - date.getUTCMilliseconds());
}

/**
 * The instant at which the company zone reads the given wall-clock time —
 * a zone-aware replacement for `new Date(year, month, day, hour, minute)`.
 *
 * Day/month overflow is allowed (`zonedDate(2026, 0, 32)` is Feb 1), so
 * callers can step through days with plain arithmetic. Across a DST gap the
 * later reading wins (2:30 AM on spring-forward day becomes 3:30 AM EDT), and
 * an ambiguous fall-back time resolves to its first occurrence, matching how
 * JavaScript's local `Date` constructor behaves.
 */
export function zonedDate(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  timeZone: string = COMPANY_TIME_ZONE,
): Date {
  const wallClock = Date.UTC(year, month, day, hour, minute, second);
  // Guess using the offset in force at the wall-clock instant read as UTC,
  // then re-check the offset at the guess; the two differ only when a DST
  // transition falls between them.
  const firstGuess = wallClock - offsetMs(new Date(wallClock), timeZone);
  const secondGuess = wallClock - offsetMs(new Date(firstGuess), timeZone);
  if (secondGuess === firstGuess) return new Date(firstGuess);
  const check = zonedParts(new Date(secondGuess), timeZone);
  const matches = Date.UTC(check.year, check.month, check.day, check.hour, check.minute, check.second) === wallClock;
  return new Date(matches ? secondGuess : firstGuess);
}

/**
 * Combine `<input type="date">` and `<input type="time">` values into the
 * instant they name in the company zone. Returns null for malformed input.
 */
export function zonedDateFromInput(date: string, time = "00:00"): Date | null {
  const day = parseDateKey(date);
  const clock = parseTimeKey(time);
  if (!day || !clock) return null;
  return zonedDate(day.year, day.month, day.day, clock.hour, clock.minute);
}

/**
 * Date-only columns (birthday, anniversaryDate, benefitsEligibleDate, review
 * cycle dates) are stored as UTC midnight via `new Date("YYYY-MM-DD")`.
 * Returns the company-zone midnight of that same calendar date so the value
 * buckets on the day the user typed, not the evening before.
 */
export function fromDateOnly(date: Date, timeZone: string = COMPANY_TIME_ZONE): Date {
  return zonedDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, timeZone);
}

/** Zone-pinned `Intl.DateTimeFormat` for any option set (en-US). */
export function formatInZone(date: Date, options: Intl.DateTimeFormatOptions, timeZone: string = COMPANY_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone }).format(date);
}

/** "9:30 AM". With `compact`, whole hours drop the minutes: "9 AM". */
export function formatTime(date: Date, options: { compact?: boolean } = {}) {
  const dropMinutes = options.compact && zonedParts(date).minute === 0;
  return formatInZone(date, dropMinutes ? { hour: "numeric" } : { hour: "numeric", minute: "2-digit" });
}

/** "Mar 3" */
export function formatDateShort(date: Date) {
  return formatInZone(date, { month: "short", day: "numeric" });
}

/** "Tuesday, March 3, 2026" or, with a time, "Tuesday, March 3, 2026 at 9:30 AM". */
export function formatDateTime(date: Date, options: { allDay?: boolean } = {}) {
  return formatInZone(date, options.allDay
    ? { weekday: "long", month: "long", day: "numeric", year: "numeric" }
    : { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/** 00:00 in the company zone — the start boundary of a whole-day entry. */
export function isStartOfDay(date: Date) {
  const { hour, minute } = zonedParts(date);
  return hour === 0 && minute === 0;
}

/** 23:59 in the company zone — the end boundary of a whole-day entry. */
export function isEndOfDay(date: Date) {
  const { hour, minute } = zonedParts(date);
  return hour === 23 && minute === 59;
}

/** Whole calendar days from `from` to `to` in the company zone (negative when `to` is earlier). */
export function daysBetween(from: Date, to: Date) {
  const a = zonedParts(from);
  const b = zonedParts(to);
  return Math.round((Date.UTC(b.year, b.month, b.day) - Date.UTC(a.year, a.month, a.day)) / 86_400_000);
}
