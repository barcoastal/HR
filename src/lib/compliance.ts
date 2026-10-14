// Client-safe helpers for the Super-Admin-only "I-9 & Background Checks" page.

export type I9Document = { id: string; name: string; url: string; uploadedAt: string };

export type I9Row = {
  employeeId: string;
  name: string;
  jobTitle: string;
  status: string;
  startDate: string;
  documents: I9Document[];
};

export const COMPLIANCE_TABS = [
  { id: "i9", label: "I-9 Forms" },
  { id: "background-checks", label: "Background Checks" },
] as const;

export type ComplianceTabId = (typeof COMPLIANCE_TABS)[number]["id"];

export function complianceTab(tab: string | undefined): ComplianceTabId {
  return COMPLIANCE_TABS.some((t) => t.id === tab) ? (tab as ComplianceTabId) : "i9";
}

export function summarizeI9Coverage(rows: { documents: unknown[] }[]): { missing: number; total: number } {
  return { missing: rows.filter((r) => r.documents.length === 0).length, total: rows.length };
}

/** Missing I-9s first, then by name — the people who need attention lead the list. */
export function sortI9Rows<T extends { documents: unknown[]; name: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const am = a.documents.length === 0;
    const bm = b.documents.length === 0;
    if (am !== bm) return am ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
