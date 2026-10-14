// Calendar colours: a fixed named palette that company events and whole
// calendar categories can be set to, so related items read as one colour.
// Class strings are literal so Tailwind picks them up.

export const CALENDAR_COLORS = {
  blue: { label: "Blue", chip: "bg-blue-500/15 text-blue-800", dot: "bg-blue-500" },
  green: { label: "Green", chip: "bg-emerald-500/15 text-emerald-800", dot: "bg-emerald-500" },
  purple: { label: "Purple", chip: "bg-purple-500/15 text-purple-800", dot: "bg-purple-500" },
  pink: { label: "Pink", chip: "bg-pink-500/15 text-pink-800", dot: "bg-pink-500" },
  orange: { label: "Orange", chip: "bg-orange-500/15 text-orange-800", dot: "bg-orange-500" },
  red: { label: "Red", chip: "bg-red-500/15 text-red-800", dot: "bg-red-500" },
  teal: { label: "Teal", chip: "bg-teal-500/15 text-teal-800", dot: "bg-teal-500" },
  gray: { label: "Gray", chip: "bg-slate-500/15 text-slate-800", dot: "bg-slate-500" },
} as const;

export type CalendarColor = keyof typeof CALENDAR_COLORS;
export const CALENDAR_COLOR_IDS = Object.keys(CALENDAR_COLORS) as CalendarColor[];

export function isCalendarColor(value: unknown): value is CalendarColor {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(CALENDAR_COLORS, value);
}

/** Layers on the calendar: each can be toggled and given one colour. */
export const CALENDAR_CATEGORIES = [
  { id: "company", label: "Company events" },
  { id: "review", label: "Reviews" },
  { id: "one-on-one", label: "1:1s" },
  { id: "interview", label: "Interviews" },
  { id: "training", label: "Training" },
  { id: "time-off", label: "Time off" },
  { id: "holiday", label: "Holidays" },
  { id: "people", label: "Birthdays & milestones" },
  { id: "google", label: "My Google Calendar" },
] as const;

export type CalendarCategory = (typeof CALENDAR_CATEGORIES)[number]["id"];
export type CategoryColors = Partial<Record<CalendarCategory, CalendarColor>>;

export function isCalendarCategory(value: unknown): value is CalendarCategory {
  return CALENDAR_CATEGORIES.some((category) => category.id === value);
}

export function calendarCategoryOf(type: string): CalendarCategory {
  if (type === "feed-event") return "company";
  if (type === "performance-review" || type === "review-milestone") return "review";
  if (type === "one-on-one") return "one-on-one";
  if (type === "interview") return "interview";
  if (type === "training") return "training";
  if (type === "out-of-office" || type === "working-remotely") return "time-off";
  if (type.startsWith("holiday-")) return "holiday";
  if (type === "google-calendar") return "google";
  return "people";
}

/** The built-in look of each item type, used until an admin picks a category colour. */
const DEFAULT_TYPE_CHIP: Record<string, string> = {
  birthday: "bg-[var(--color-tertiary-container)]/15 text-[var(--color-tertiary)]",
  anniversary: "bg-[var(--color-tertiary-fixed)] text-[var(--color-on-tertiary-fixed-variant)]",
  interview: "bg-[var(--color-primary)]/10 text-[var(--color-primary)]",
  benefits: "bg-[var(--color-primary-fixed)] text-[var(--color-on-primary-fixed-variant)]",
  "feed-event": "bg-blue-500/10 text-blue-700",
  "google-calendar": "bg-emerald-500/10 text-emerald-700",
  "performance-review": "bg-purple-500/10 text-purple-700",
  "review-milestone": "bg-purple-500/10 text-purple-700",
  "one-on-one": "bg-fuchsia-500/10 text-fuchsia-700",
  training: "bg-indigo-500/10 text-indigo-700",
  "out-of-office": "bg-amber-500/15 text-amber-800",
  "working-remotely": "bg-cyan-500/15 text-cyan-800",
};
const DEFAULT_HOLIDAY_CHIP = "bg-[var(--color-error-container)]/20 text-[var(--color-on-error-container)]";
const FALLBACK_CHIP = "bg-[var(--color-surface-container)] text-[var(--color-on-surface-variant)]";

/** A representative item type per category, for the legend swatch. */
const CATEGORY_SAMPLE_TYPE: Record<CalendarCategory, string> = {
  company: "feed-event",
  review: "performance-review",
  "one-on-one": "one-on-one",
  interview: "interview",
  training: "training",
  "time-off": "out-of-office",
  holiday: "holiday-american",
  people: "birthday",
  google: "google-calendar",
};

/** Chip classes: the event's own colour, else its category colour, else the built-in look. */
export function calendarChipClass(type: string, colors: CategoryColors = {}, eventColor?: string | null): string {
  if (isCalendarColor(eventColor)) return CALENDAR_COLORS[eventColor].chip;
  const categoryColor = colors[calendarCategoryOf(type)];
  if (categoryColor && isCalendarColor(categoryColor)) return CALENDAR_COLORS[categoryColor].chip;
  if (type.startsWith("holiday-")) return DEFAULT_HOLIDAY_CHIP;
  return DEFAULT_TYPE_CHIP[type] || FALLBACK_CHIP;
}

export function categoryChipClass(category: CalendarCategory, colors: CategoryColors = {}): string {
  return calendarChipClass(CATEGORY_SAMPLE_TYPE[category], colors);
}

/** Keeps only known category → palette pairs (from the database or a form). */
export function sanitizeCategoryColors(rows: { category: string; color: string }[]): CategoryColors {
  const result: CategoryColors = {};
  for (const row of rows) {
    if (isCalendarCategory(row.category) && isCalendarColor(row.color)) result[row.category] = row.color;
  }
  return result;
}
