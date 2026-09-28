import { db } from "@/lib/db";
import {
  resolveDocumentVisibility,
  type DocumentFolderKey,
  type DocumentVisibilityKey,
} from "@/lib/document-folders";

type Actor = { role?: string | null } | undefined;
type Failure = { ok: false; error: string };

function canManageDocuments(actor: Actor) {
  return ["SUPER_ADMIN", "ADMIN", "HR"].includes(actor?.role ?? "");
}

/** Move an uploaded document to another folder and/or change who can see it. */
export async function updateDocumentSettings(
  docId: string,
  changes: { category?: DocumentFolderKey; visibility?: DocumentVisibilityKey },
  actor: Actor
): Promise<{ ok: true; employeeId: string; name: string } | Failure> {
  if (!canManageDocuments(actor)) return { ok: false, error: "Not authorized" };

  const document = await db.document.findUnique({ where: { id: docId } });
  if (!document) return { ok: false, error: "Document not found" };

  const category = changes.category ?? document.category;
  if (category === "MEDICAL" && changes.visibility === "EVERYONE") {
    return { ok: false, error: "Medical documents are always HR only." };
  }
  const visibility = resolveDocumentVisibility(category, changes.visibility ?? document.visibility);

  await db.document.update({ where: { id: docId }, data: { category, visibility } });
  return { ok: true, employeeId: document.employeeId, name: document.name };
}

/** Hide every document on a person's profile from the employee and their manager. */
export async function restrictAllDocumentsToHr(
  employeeId: string,
  actor: Actor
): Promise<{ ok: true; changed: number } | Failure> {
  if (!canManageDocuments(actor)) return { ok: false, error: "Not authorized" };

  const { count } = await db.document.updateMany({
    where: { employeeId, visibility: "EVERYONE" },
    data: { visibility: "HR_ONLY" },
  });
  return { ok: true, changed: count };
}
