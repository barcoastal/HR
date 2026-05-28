"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

export type DuplicateCandidateLite = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  linkedinUrl: string | null;
  source: string | null;
  status: string;
  positionId: string | null;
  positionTitle: string | null;
  applicationCount: number;
  createdAt: Date;
  resumeUrl: string | null;
  hasResumeText: boolean;
};

export type DuplicateGroup = {
  id: string;
  matchType: "phone" | "name" | "email_normalized";
  matchLabel: string;
  key: string;
  candidates: DuplicateCandidateLite[];
};

function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

function normalizeName(first: string, last: string): string {
  return `${first.toLowerCase().trim()} ${last.toLowerCase().trim()}`.replace(/\s+/g, " ");
}

function normalizeEmail(email: string | null | undefined): string {
  if (!email) return "";
  const [local, domain] = email.toLowerCase().trim().split("@");
  if (!domain) return "";
  // Gmail-style dot+tag normalization so john.doe+job@gmail.com and
  // johndoe@gmail.com collapse to the same key.
  const cleaned = local.replace(/\./g, "").split("+")[0];
  return `${cleaned}@${domain}`;
}

async function requireRecruitmentAccess() {
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR" && role !== "MANAGER") {
    throw new Error("Forbidden");
  }
  return session;
}

export async function findDuplicateCandidates(): Promise<DuplicateGroup[]> {
  await requireRecruitmentAccess();

  const candidates = await db.candidate.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      linkedinUrl: true,
      source: true,
      status: true,
      positionId: true,
      applicationCount: true,
      createdAt: true,
      resumeUrl: true,
      resumeText: true,
      position: { select: { title: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const lite: DuplicateCandidateLite[] = candidates.map((c) => ({
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    phone: c.phone,
    linkedinUrl: c.linkedinUrl,
    source: c.source,
    status: c.status,
    positionId: c.positionId,
    positionTitle: c.position?.title || null,
    applicationCount: c.applicationCount,
    createdAt: c.createdAt,
    resumeUrl: c.resumeUrl,
    hasResumeText: !!c.resumeText,
  }));

  const byPhone = new Map<string, DuplicateCandidateLite[]>();
  const byName = new Map<string, DuplicateCandidateLite[]>();
  const byNormEmail = new Map<string, DuplicateCandidateLite[]>();

  for (const c of lite) {
    const ph = normalizePhone(c.phone);
    if (ph) {
      const arr = byPhone.get(ph) ?? [];
      arr.push(c);
      byPhone.set(ph, arr);
    }
    const nm = normalizeName(c.firstName, c.lastName);
    if (nm.trim().length >= 3) {
      const arr = byName.get(nm) ?? [];
      arr.push(c);
      byName.set(nm, arr);
    }
    const ne = normalizeEmail(c.email);
    if (ne) {
      // Gmail-dot + alias normalization. john.doe@ and johndoe@ collide here
      // even though Postgres considers them distinct emails.
      const arr = byNormEmail.get(ne) ?? [];
      arr.push(c);
      byNormEmail.set(ne, arr);
    }
  }

  const groups: DuplicateGroup[] = [];
  const seenPairs = new Set<string>();

  const pushGroup = (
    matchType: DuplicateGroup["matchType"],
    matchLabel: string,
    key: string,
    members: DuplicateCandidateLite[],
  ) => {
    if (members.length < 2) return;
    const sortedIds = members.map((m) => m.id).sort().join("|");
    if (seenPairs.has(`${matchType}:${sortedIds}`)) return;
    seenPairs.add(`${matchType}:${sortedIds}`);
    groups.push({
      id: `${matchType}-${key}`,
      matchType,
      matchLabel,
      key,
      candidates: members,
    });
  };

  for (const [k, arr] of byNormEmail) {
    if (arr.length > 1) pushGroup("email_normalized", `Email variant: ${k}`, k, arr);
  }
  for (const [k, arr] of byPhone) {
    if (arr.length > 1) pushGroup("phone", `Same phone: ${formatPhone(k)}`, k, arr);
  }
  for (const [k, arr] of byName) {
    if (arr.length > 1) pushGroup("name", `Same name: ${k.replace(/\b\w/g, (c) => c.toUpperCase())}`, k, arr);
  }

  // Sort groups: most-candidates first, then phone > email > name.
  const typeOrder: Record<DuplicateGroup["matchType"], number> = {
    phone: 0,
    email_normalized: 1,
    name: 2,
  };
  groups.sort((a, b) => {
    if (b.candidates.length !== a.candidates.length) return b.candidates.length - a.candidates.length;
    return typeOrder[a.matchType] - typeOrder[b.matchType];
  });

  return groups;
}

function formatPhone(digits: string): string {
  if (digits.length !== 10) return digits;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Merge `duplicateIds` into `primaryId`. All applications/interviews/signing
 * requests on the duplicates are reassigned to the primary, the primary's
 * applicationCount absorbs theirs, and missing fields on the primary
 * (resumeUrl, phone, etc.) are backfilled from the first duplicate that has
 * them. The duplicate Candidate rows are deleted.
 */
export async function mergeCandidates(primaryId: string, duplicateIds: string[]) {
  await requireRecruitmentAccess();
  if (!primaryId || duplicateIds.length === 0) {
    return { success: false, error: "Nothing to merge" };
  }
  if (duplicateIds.includes(primaryId)) {
    return { success: false, error: "Primary cannot also be a duplicate" };
  }

  const [primary, duplicates] = await Promise.all([
    db.candidate.findUnique({ where: { id: primaryId } }),
    db.candidate.findMany({ where: { id: { in: duplicateIds } } }),
  ]);
  if (!primary) return { success: false, error: "Primary candidate not found" };
  if (duplicates.length !== duplicateIds.length) {
    return { success: false, error: "One or more duplicates not found" };
  }

  // Build the field-merge payload: keep primary values, fill nulls from dups.
  const fillFromDups: Partial<typeof primary> = {};
  const nullableFields: (keyof typeof primary)[] = [
    "phone",
    "linkedinUrl",
    "resumeUrl",
    "resumeText",
    "skills",
    "experience",
    "notes",
    "source",
    "jobAppliedTo",
    "hourlyRate",
    "costOfHire",
    "positionId",
    "managerId",
    "recruiterId",
    "backgroundCheckId",
    "backgroundCheckStatus",
  ];
  for (const field of nullableFields) {
    if (primary[field] != null) continue;
    for (const d of duplicates) {
      if (d[field] != null) {
        (fillFromDups as Record<string, unknown>)[field as string] = d[field];
        break;
      }
    }
  }

  const absorbedAppCount = duplicates.reduce((sum, d) => sum + (d.applicationCount || 1), 0);

  await db.$transaction(async (tx) => {
    // Reassign children onto the primary.
    await tx.candidateApplication.updateMany({
      where: { candidateId: { in: duplicateIds } },
      data: { candidateId: primaryId },
    });
    await tx.interview.updateMany({
      where: { candidateId: { in: duplicateIds } },
      data: { candidateId: primaryId },
    });
    await tx.signingRequest.updateMany({
      where: { candidateId: { in: duplicateIds } },
      data: { candidateId: primaryId },
    });

    // Backfill missing fields + sum application counts.
    await tx.candidate.update({
      where: { id: primaryId },
      data: {
        ...fillFromDups,
        applicationCount: (primary.applicationCount || 1) + absorbedAppCount,
      },
    });

    // Delete the duplicates.
    await tx.candidate.deleteMany({ where: { id: { in: duplicateIds } } });
  });

  try {
    const { audit } = await import("@/lib/audit");
    await audit({
      action: "candidate.merged",
      entityType: "candidate",
      entityId: primaryId,
      details: {
        primary: `${primary.firstName} ${primary.lastName} <${primary.email}>`,
        merged: duplicates.map((d) => ({
          id: d.id,
          name: `${d.firstName} ${d.lastName}`,
          email: d.email,
        })),
      },
    });
  } catch (err) {
    console.error("[candidate.merged] audit failed:", err);
  }

  revalidatePath("/cv");
  revalidatePath("/cv/duplicates");
  return { success: true, mergedCount: duplicateIds.length };
}

/**
 * Auto-merge every duplicate group: for each group, pick the best primary
 * (most applications → earliest createdAt → has a local resume URL) and
 * merge the rest into it. Returns aggregate counts.
 */
export async function mergeAllDuplicates() {
  await requireRecruitmentAccess();
  const groups = await findDuplicateCandidates();

  let groupsMerged = 0;
  let candidatesMerged = 0;
  const errors: { groupId: string; error: string }[] = [];

  for (const g of groups) {
    if (g.candidates.length < 2) continue;
    // Pick primary: highest applicationCount, then earliest createdAt, then a
    // local resume URL beats a remote one (more valuable record to preserve).
    const sorted = [...g.candidates].sort((a, b) => {
      if (b.applicationCount !== a.applicationCount) return b.applicationCount - a.applicationCount;
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      if (aTime !== bTime) return aTime - bTime;
      const aLocal = a.resumeUrl?.startsWith("/api/") ? 1 : 0;
      const bLocal = b.resumeUrl?.startsWith("/api/") ? 1 : 0;
      return bLocal - aLocal;
    });
    const primary = sorted[0];
    const duplicates = sorted.slice(1).map((c) => c.id);
    try {
      const res = await mergeCandidates(primary.id, duplicates);
      if (res.success) {
        groupsMerged += 1;
        candidatesMerged += duplicates.length;
      } else {
        errors.push({ groupId: g.id, error: res.error || "unknown" });
      }
    } catch (err) {
      errors.push({ groupId: g.id, error: err instanceof Error ? err.message : "unknown" });
    }
  }

  revalidatePath("/cv");
  revalidatePath("/cv/duplicates");
  return { groupsMerged, candidatesMerged, errors };
}
