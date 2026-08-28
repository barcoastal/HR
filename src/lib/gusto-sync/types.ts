import type { FieldKey, RowData } from "@/lib/import-export/types";

/** One Gusto employee flattened to import-row shape (same mapping + cleaning as a Gusto import). */
export type GustoPerson = { gustoId: string; data: RowData };

export type GustoMatchedBy = "gustoId" | "email" | "personalEmail" | "name";

/** A field where Gusto has a value that differs from what the system has. `current` is "" when empty here. */
export type GustoFieldChange = { key: FieldKey; label: string; current: string; incoming: string };

export type GustoMatch = {
  gustoId: string;
  gustoName: string;
  matchedBy: GustoMatchedBy;
  data: RowData;
  changes: GustoFieldChange[];
};

/** fill = only write fields that are empty here; overwrite = Gusto wins wherever it has a value. */
export type GustoSyncStrategy = "fill" | "overwrite";

export type GustoMatchesResult = {
  connected: boolean;
  fetchedAt: string;
  matches: Record<string, GustoMatch | null>;
};

/** What one apply wrote (Prisma field names, as in the audit entry) and why some values were kept. */
export type GustoApplyOutcome = { fields: string[]; notes: string[] };

export type GustoApplyResult = {
  applied: string[];
  unmatched: string[];
  failed: { id: string; error: string }[];
};
