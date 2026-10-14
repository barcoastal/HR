// Client-safe: no DB imports. The single rule for who may see which
// personnel-file document, plus the background-check redaction used for
// candidate records.
//
// I-9 forms and background checks are Super Admin only. ADMIN, HR, MANAGER
// and EMPLOYEE (including the person the record belongs to) cannot list,
// search or download them.

import type { Prisma } from "@/generated/prisma/client";

export const SUPER_ADMIN_ONLY_CATEGORIES = ["I9", "BACKGROUND_CHECK"] as const;
export type SuperAdminOnlyCategory = (typeof SUPER_ADMIN_ONLY_CATEGORIES)[number];

const HR_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "HR"]);

export function isSuperAdmin(role: string | null | undefined): boolean {
  return role === "SUPER_ADMIN";
}

export function isSuperAdminOnlyCategory(category: string | null | undefined): boolean {
  return (SUPER_ADMIN_ONLY_CATEGORIES as readonly string[]).includes(category ?? "");
}

/** Restricted when either the folder or the stored visibility says so. */
export function isSuperAdminOnlyDocument(doc: { category: string; visibility: string }): boolean {
  return doc.visibility === "SUPER_ADMIN_ONLY" || isSuperAdminOnlyCategory(doc.category);
}

export type DocumentViewer = { role?: string | null; employeeId?: string | null } | null | undefined;

export type DocumentForAccess = {
  category: string;
  visibility: string;
  employeeId: string;
  /** The document owner's manager, when known. */
  managerId?: string | null;
};

/**
 * Can this viewer open this document?
 * - Super Admin: everything.
 * - I-9 / background check (or SUPER_ADMIN_ONLY): nobody else.
 * - HR_ONLY: Super Admin, Admin, HR.
 * - EVERYONE: Admin/HR, the employee it belongs to, and their manager.
 */
export function canViewDocument(viewer: DocumentViewer, doc: DocumentForAccess): boolean {
  const role = viewer?.role ?? null;
  if (isSuperAdmin(role)) return true;
  if (isSuperAdminOnlyDocument(doc)) return false;
  if (HR_ROLES.has(role ?? "")) return true;
  if (doc.visibility !== "EVERYONE") return false;
  const me = viewer?.employeeId ?? null;
  if (!me) return false;
  return me === doc.employeeId || (doc.managerId != null && doc.managerId === me);
}

/**
 * Prisma `where` fragment that keeps only the documents this role may list.
 * Ownership (the employee's own file, their reports) is the caller's scope;
 * this only applies the category/visibility rule.
 */
export function visibleDocumentsWhere(role: string | null | undefined): Prisma.DocumentWhereInput {
  if (isSuperAdmin(role)) return {};
  const notRestricted: Prisma.DocumentWhereInput = {
    category: { notIn: [...SUPER_ADMIN_ONLY_CATEGORIES] },
  };
  if (HR_ROLES.has(role ?? "")) {
    return { ...notRestricted, visibility: { in: ["EVERYONE", "HR_ONLY"] } };
  }
  return { ...notRestricted, visibility: "EVERYONE" };
}

/** Background-check status, results and reports are Super Admin only. */
export function canViewBackgroundChecks(role: string | null | undefined): boolean {
  return isSuperAdmin(role);
}

/** FileBlob names used for cached background-check report PDFs. */
export function isBackgroundReportFilename(filename: string): boolean {
  return filename.startsWith("bg-report-");
}

const BACKGROUND_CHECK_FIELDS = [
  "backgroundCheckStatus",
  "backgroundCheckId",
  "backgroundCheckDate",
  "backgroundCheckOptions",
  "backgroundReportFilename",
  "backgroundReportImportedAt",
  "preAdverseActionStatus",
  "preAdverseActionSentAt",
  "preAdverseActionDueAt",
  "preAdverseActionProviderId",
  "preAdverseActionError",
  "adverseActionLetterSentAt",
] as const;

/**
 * Blank the background-check and adverse-action fields of a candidate record
 * for anyone but a Super Admin, so the data never reaches their browser.
 * The candidate's pipeline status (e.g. BACKGROUND_CHECK stage) is untouched.
 */
export function redactBackgroundCheck<T extends object>(candidate: T, role: string | null | undefined): T {
  if (canViewBackgroundChecks(role)) return candidate;
  const copy = { ...candidate } as Record<string, unknown>;
  for (const field of BACKGROUND_CHECK_FIELDS) {
    if (field in copy) copy[field] = null;
  }
  return copy as T;
}
