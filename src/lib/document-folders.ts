export type DocumentFolderKey = "ONBOARDING" | "FINANCIAL" | "MEDICAL" | "REVIEW" | "OFFBOARDING" | "GENERAL";
export type DocumentVisibilityKey = "EVERYONE" | "HR_ONLY";

/** Folders on a person's profile, in display order. Keys are DocumentCategory values. */
export const DOCUMENT_FOLDERS: { key: DocumentFolderKey; label: string }[] = [
  { key: "ONBOARDING", label: "Onboarding & stage documents" },
  { key: "FINANCIAL", label: "Financial" },
  { key: "MEDICAL", label: "Medical" },
  { key: "REVIEW", label: "Reviews" },
  { key: "OFFBOARDING", label: "Offboarding" },
  { key: "GENERAL", label: "General" },
];

/**
 * Medical records are confidential and kept apart from the rest of the
 * personnel file, so they are HR only no matter what was requested.
 */
export function resolveDocumentVisibility(
  category: DocumentFolderKey,
  requested: DocumentVisibilityKey
): DocumentVisibilityKey {
  return category === "MEDICAL" ? "HR_ONLY" : requested;
}

export function groupDocumentsByFolder<T extends { category: string }>(
  documents: T[]
): { key: DocumentFolderKey; label: string; documents: T[] }[] {
  return DOCUMENT_FOLDERS.map((folder) => ({
    ...folder,
    documents: documents.filter((document) => document.category === folder.key),
  })).filter((folder) => folder.documents.length > 0);
}
