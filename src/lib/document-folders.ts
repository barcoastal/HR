import { isSuperAdminOnlyCategory } from "@/lib/document-access";

export type DocumentFolderKey =
  | "ONBOARDING"
  | "FINANCIAL"
  | "MEDICAL"
  | "REVIEW"
  | "OFFBOARDING"
  | "GENERAL"
  | "I9"
  | "BACKGROUND_CHECK";
export type DocumentVisibilityKey = "EVERYONE" | "HR_ONLY" | "SUPER_ADMIN_ONLY";

/** Folders on a person's profile, in display order. Keys are DocumentCategory values. */
export const DOCUMENT_FOLDERS: { key: DocumentFolderKey; label: string }[] = [
  { key: "ONBOARDING", label: "Onboarding & stage documents" },
  { key: "FINANCIAL", label: "Financial" },
  { key: "MEDICAL", label: "Medical" },
  { key: "REVIEW", label: "Reviews" },
  { key: "OFFBOARDING", label: "Offboarding" },
  { key: "GENERAL", label: "General" },
  { key: "I9", label: "I-9" },
  { key: "BACKGROUND_CHECK", label: "Background check" },
];

/** Folders anyone who manages documents can pick (I-9 and background checks are Super Admin only). */
export function documentFoldersFor(role: string | null | undefined) {
  return role === "SUPER_ADMIN"
    ? DOCUMENT_FOLDERS
    : DOCUMENT_FOLDERS.filter((folder) => !isSuperAdminOnlyCategory(folder.key));
}

/**
 * I-9 forms and background checks are Super Admin only, and medical records
 * are HR only, no matter what was requested. Super Admin only is reserved for
 * those two folders, so a document moved out of them falls back to HR only.
 */
export function resolveDocumentVisibility(
  category: DocumentFolderKey,
  requested: DocumentVisibilityKey
): DocumentVisibilityKey {
  if (isSuperAdminOnlyCategory(category)) return "SUPER_ADMIN_ONLY";
  if (category === "MEDICAL") return "HR_ONLY";
  return requested === "SUPER_ADMIN_ONLY" ? "HR_ONLY" : requested;
}

export function groupDocumentsByFolder<T extends { category: string }>(
  documents: T[]
): { key: DocumentFolderKey; label: string; documents: T[] }[] {
  return DOCUMENT_FOLDERS.map((folder) => ({
    ...folder,
    documents: documents.filter((document) => document.category === folder.key),
  })).filter((folder) => folder.documents.length > 0);
}
