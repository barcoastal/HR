"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";

export type MyDocument = {
  id: string;
  name: string;
  url: string;
  category: string | null;
  source: "document" | "signing";
  status: string;
  createdAt: Date;
};

export async function getMyDocuments(): Promise<MyDocument[]> {
  const session = await requireAuth();
  const employeeId = session.user.employeeId;
  if (!employeeId) return [];

  const [documents, signingRequests] = await Promise.all([
    db.document.findMany({
      // HR_ONLY documents are off-limits to the employee, even on their own
      // profile.
      where: { employeeId, visibility: "EVERYONE" },
      orderBy: { uploadedAt: "desc" },
      select: { id: true, name: true, url: true, category: true, uploadedAt: true },
    }),
    db.signingRequest.findMany({
      where: { employeeId },
      orderBy: { createdAt: "desc" },
      select: { id: true, documentName: true, documentUrl: true, signedDocUrl: true, status: true, createdAt: true, token: true },
    }),
  ]);

  const docItems: MyDocument[] = documents.map((d) => ({
    id: `doc-${d.id}`,
    name: d.name,
    url: d.url,
    category: d.category,
    source: "document" as const,
    status: "stored",
    createdAt: d.uploadedAt,
  }));

  const signingItems: MyDocument[] = signingRequests.map((r) => ({
    id: `sign-${r.id}`,
    name: r.documentName,
    url: r.signedDocUrl || r.documentUrl,
    category: null,
    source: "signing" as const,
    status: r.status,
    createdAt: r.createdAt,
  }));

  // Merge and de-duplicate: a signed signing request often mirrors a Document row.
  // Prefer the Document entry when both exist with the same name on the same day.
  const all = [...docItems, ...signingItems].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return all;
}
