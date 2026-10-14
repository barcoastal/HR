// Server-only: the I-9 / background-check rule for file-serving routes.
// A file is restricted when it is a cached background-check report, or when
// any Document row pointing at it is in the I9 / BACKGROUND_CHECK folder or
// marked SUPER_ADMIN_ONLY. Only Super Admins may receive restricted files.

import { db } from "@/lib/db";
import { SUPER_ADMIN_ONLY_CATEGORIES, isBackgroundReportFilename, isSuperAdmin } from "@/lib/document-access";

export async function isRestrictedFile(opts: { urls?: string[]; filename?: string | null }): Promise<boolean> {
  const urls = new Set(opts.urls ?? []);
  if (opts.filename) {
    if (isBackgroundReportFilename(opts.filename)) return true;
    urls.add(`/api/onboarding-docs/${opts.filename}`);
  }
  if (urls.size === 0) return false;
  const hit = await db.document.findFirst({
    where: {
      url: { in: [...urls] },
      OR: [{ visibility: "SUPER_ADMIN_ONLY" }, { category: { in: [...SUPER_ADMIN_ONLY_CATEGORIES] } }],
    },
    select: { id: true },
  });
  return hit !== null;
}

/** True when this viewer must not receive the file (answer 404). */
export async function isFileBlockedFor(
  role: string | null | undefined,
  opts: { urls?: string[]; filename?: string | null }
): Promise<boolean> {
  if (isSuperAdmin(role)) return false;
  return isRestrictedFile(opts);
}
