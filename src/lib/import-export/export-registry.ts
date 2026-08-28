/**
 * Export registry — the single source of truth for what `/data?tab=export`
 * can export. Pure and client-safe (no Prisma, no server imports): the
 * builder UI renders from it, the loaders flatten rows to its column keys,
 * and the download route validates every requested entity/column/filter
 * against it, so a hand-crafted URL can't reach anything not declared here.
 */

import { EMPLOYEE_STATUS_VALUES } from "./employee-fields";

export type ExportEntityKey = "people" | "candidates" | "departments" | "timeOff" | "reviews" | "interviews";

export type ExportColumn = { key: string; label: string; default?: boolean };

export type ExportFilter =
  | {
      key: string;
      label: string;
      type: "select";
      /** Static choices (enum values). */
      options?: { value: string; label: string }[];
      /** Choices loaded from the database by `getExportOptions()`. */
      optionsFrom?: "departments" | "positions";
    }
  | {
      key: string;
      label: string;
      type: "dateRange"; // request params `${key}From` / `${key}To`, both YYYY-MM-DD, either optional
    };

export type ExportEntityDef = {
  key: ExportEntityKey;
  label: string;
  description: string;
  icon: string; // Material Symbols name
  columns: ExportColumn[];
  filters: ExportFilter[];
};

export type ExportFormat = "csv" | "xlsx";
export const EXPORT_FORMATS: readonly ExportFormat[] = ["csv", "xlsx"] as const;

const CANDIDATE_STATUS_VALUES = [
  "NEW", "CONTACTED", "SCREENING", "INTERVIEW", "OFFER", "BACKGROUND_CHECK",
  "PRE_ONBOARDING", "ONBOARDING", "OFFBOARDING", "HIRED", "REJECTED",
] as const;
const TIME_OFF_STATUS_VALUES = ["PENDING", "APPROVED", "DENIED", "CANCELLED"] as const;
const REVIEW_STATUS_VALUES = ["PENDING", "SUBMITTED"] as const;
const INTERVIEW_STATUS_VALUES = ["SCHEDULED", "COMPLETED", "CANCELLED"] as const;

/** "BACKGROUND_CHECK" → "Background check" */
function humanize(value: string): string {
  const lower = value.toLowerCase().replace(/_/g, " ");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function enumOptions(values: readonly string[]): { value: string; label: string }[] {
  return values.map((v) => ({ value: v, label: humanize(v) }));
}

export const EXPORT_ENTITIES: ExportEntityDef[] = [
  {
    key: "people",
    label: "People",
    description: "Active employees with job, contact and address details.",
    icon: "group",
    columns: [
      { key: "firstName", label: "First name", default: true },
      { key: "lastName", label: "Last name", default: true },
      { key: "preferredName", label: "Preferred name" },
      { key: "pronouns", label: "Pronouns" },
      { key: "email", label: "Email", default: true },
      { key: "personalEmail", label: "Personal email" },
      { key: "phone", label: "Phone", default: true },
      { key: "jobTitle", label: "Job title", default: true },
      { key: "department", label: "Department", default: true },
      { key: "team", label: "Team" },
      { key: "manager", label: "Manager", default: true },
      { key: "status", label: "Status", default: true },
      { key: "startDate", label: "Start date", default: true },
      { key: "endDate", label: "End date" },
      { key: "birthday", label: "Birthday" },
      { key: "location", label: "Location" },
      { key: "address", label: "Address" },
      { key: "city", label: "City" },
      { key: "state", label: "State" },
      { key: "zipCode", label: "ZIP" },
      { key: "country", label: "Country" },
      { key: "emergencyContactName", label: "Emergency contact name" },
      { key: "emergencyContactPhone", label: "Emergency contact phone" },
      { key: "emergencyContactRelation", label: "Emergency contact relation" },
      { key: "tShirtSize", label: "T-shirt size" },
      { key: "createdAt", label: "Created" },
    ],
    filters: [
      { key: "status", label: "Status", type: "select", options: enumOptions(EMPLOYEE_STATUS_VALUES) },
      { key: "department", label: "Department", type: "select", optionsFrom: "departments" },
    ],
  },
  {
    key: "candidates",
    label: "Candidates",
    description: "Everyone in the recruitment database, with position and pipeline status.",
    icon: "person_search",
    columns: [
      { key: "firstName", label: "First name", default: true },
      { key: "lastName", label: "Last name", default: true },
      { key: "email", label: "Email", default: true },
      { key: "phone", label: "Phone", default: true },
      { key: "status", label: "Status", default: true },
      { key: "position", label: "Position", default: true },
      { key: "source", label: "Source", default: true },
      { key: "recruiter", label: "Recruiter" },
      { key: "manager", label: "Hiring manager" },
      { key: "appliedAt", label: "Applied", default: true },
      { key: "hiredAt", label: "Hired" },
      { key: "backgroundCheckStatus", label: "Background check status" },
      { key: "backgroundCheckDate", label: "Background check date" },
      { key: "hourlyRate", label: "Hourly rate" },
      { key: "linkedinUrl", label: "LinkedIn" },
    ],
    filters: [
      { key: "status", label: "Status", type: "select", options: enumOptions(CANDIDATE_STATUS_VALUES) },
      { key: "position", label: "Position", type: "select", optionsFrom: "positions" },
      { key: "applied", label: "Applied", type: "dateRange" },
    ],
  },
  {
    key: "departments",
    label: "Departments",
    description: "The org structure: each department, its head and headcount.",
    icon: "account_tree",
    columns: [
      { key: "name", label: "Name", default: true },
      { key: "description", label: "Description" },
      { key: "head", label: "Head", default: true },
      { key: "parentDepartment", label: "Parent department", default: true },
      { key: "memberCount", label: "Members", default: true },
      { key: "createdAt", label: "Created" },
    ],
    filters: [],
  },
  {
    key: "timeOff",
    label: "Time off requests",
    description: "Every request with its policy, dates, status and approver.",
    icon: "beach_access",
    columns: [
      { key: "employee", label: "Employee", default: true },
      { key: "policy", label: "Policy", default: true },
      { key: "startDate", label: "Start", default: true },
      { key: "endDate", label: "End", default: true },
      { key: "daysCount", label: "Days", default: true },
      { key: "status", label: "Status", default: true },
      { key: "approver", label: "Approver" },
      { key: "reason", label: "Reason" },
      { key: "createdAt", label: "Requested" },
    ],
    filters: [
      { key: "status", label: "Status", type: "select", options: enumOptions(TIME_OFF_STATUS_VALUES) },
      { key: "start", label: "Start date", type: "dateRange" },
    ],
  },
  {
    key: "reviews",
    label: "Reviews",
    description: "Performance reviews by cycle, with reviewer, type and rating.",
    icon: "rate_review",
    columns: [
      { key: "employee", label: "Employee", default: true },
      { key: "reviewer", label: "Reviewer", default: true },
      { key: "cycle", label: "Cycle", default: true },
      { key: "type", label: "Type", default: true },
      { key: "status", label: "Status", default: true },
      { key: "rating", label: "Rating", default: true },
      { key: "createdAt", label: "Created" },
    ],
    filters: [
      { key: "status", label: "Status", type: "select", options: enumOptions(REVIEW_STATUS_VALUES) },
      { key: "cycle", label: "Cycle dates", type: "dateRange" },
    ],
  },
  {
    key: "interviews",
    label: "Interviews",
    description: "Scheduled, completed and cancelled interviews with their interviewer.",
    icon: "event",
    columns: [
      { key: "candidate", label: "Candidate", default: true },
      { key: "position", label: "Position", default: true },
      { key: "interviewer", label: "Interviewer", default: true },
      { key: "scheduledAt", label: "Scheduled at", default: true },
      { key: "duration", label: "Duration (min)", default: true },
      { key: "type", label: "Type", default: true },
      { key: "status", label: "Status", default: true },
      { key: "meetLink", label: "Meet link" },
      { key: "createdAt", label: "Created" },
    ],
    filters: [
      { key: "status", label: "Status", type: "select", options: enumOptions(INTERVIEW_STATUS_VALUES) },
      { key: "scheduled", label: "Scheduled", type: "dateRange" },
    ],
  },
];

export const EXPORT_BY_KEY = Object.fromEntries(EXPORT_ENTITIES.map((e) => [e.key, e])) as Record<ExportEntityKey, ExportEntityDef>;

export function isExportEntityKey(value: unknown): value is ExportEntityKey {
  return typeof value === "string" && value in EXPORT_BY_KEY;
}

export function isExportFormat(value: unknown): value is ExportFormat {
  return value === "csv" || value === "xlsx";
}

export function defaultColumnKeys(def: ExportEntityDef): string[] {
  return def.columns.filter((c) => c.default).map((c) => c.key);
}

/** Request/URL parameter names a filter reads: `key` for selects, `keyFrom` + `keyTo` for date ranges. */
export function filterParamKeys(filter: ExportFilter): string[] {
  return filter.type === "dateRange" ? [`${filter.key}From`, `${filter.key}To`] : [filter.key];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Keep only the filter params an entity declares, drop empties, and drop
 * values that aren't one of a static select's options or a YYYY-MM-DD date.
 * Loaders call this before building a `where`, so a stray or malformed
 * param can never reach Prisma.
 */
export function sanitizeExportFilters(
  entity: ExportEntityKey,
  input: Record<string, string | undefined | null>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const filter of EXPORT_BY_KEY[entity].filters) {
    for (const param of filterParamKeys(filter)) {
      const raw = input[param]?.trim();
      if (!raw) continue;
      if (filter.type === "dateRange") {
        if (ISO_DATE.test(raw)) out[param] = raw;
      } else if (filter.options) {
        if (filter.options.some((o) => o.value === raw)) out[param] = raw;
      } else {
        out[param] = raw; // id from the database (department / position); unknown ids just match nothing
      }
    }
  }
  return out;
}
