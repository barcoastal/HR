import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { rm } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

const RESUMES_DIR = path.join(process.cwd(), "data", "resumes");

type CandidateLite = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  linkedinUrl: string | null;
  skills: string | null;
  experience: string | null;
  notes: string | null;
  resumeUrl: string | null;
  resumeText: string | null;
  source: string | null;
  jobAppliedTo: string | null;
  positionId: string | null;
  inPipeline: boolean;
  status: string;
  doNotCall: boolean;
  doNotCallReason: string | null;
  doNotCallAt: Date | null;
  applicationCount: number;
  createdAt: Date;
};

function preferCanonical(a: CandidateLite, b: CandidateLite): [CandidateLite, CandidateLite] {
  const score = (c: CandidateLite) => {
    let s = 0;
    if (c.status === "HIRED") s += 1000;
    if (c.inPipeline) s += 100;
    if (c.doNotCall) s += 50;
    if (c.resumeUrl) s += 5;
    if (c.phone) s += 1;
    return s;
  };
  const sa = score(a);
  const sb = score(b);
  if (sa !== sb) return sa > sb ? [a, b] : [b, a];
  // Same score → keep the older record so existing references stay stable
  return new Date(a.createdAt) <= new Date(b.createdAt) ? [a, b] : [b, a];
}

export async function POST() {
  const session = await requireApiAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const allCandidates = await db.candidate.findMany({
      orderBy: { createdAt: "asc" },
    });

    const groups = new Map<string, CandidateLite[]>();
    for (const c of allCandidates) {
      const email = c.email.toLowerCase().trim();
      if (!email) continue;
      const arr = groups.get(email) || [];
      arr.push(c as CandidateLite);
      groups.set(email, arr);
    }

    let unitedGroups = 0;
    let mergedRecords = 0;

    for (const [, group] of groups) {
      if (group.length < 2) continue;

      let canonical = group[0];
      for (let i = 1; i < group.length; i++) {
        const [keep, merge] = preferCanonical(canonical, group[i]);

        // Reassign related rows from the loser to the keeper
        await db.candidateApplication.updateMany({
          where: { candidateId: merge.id },
          data: { candidateId: keep.id },
        });
        await db.signingRequest.updateMany({
          where: { candidateId: merge.id },
          data: { candidateId: keep.id },
        });
        await db.interview.updateMany({
          where: { candidateId: merge.id },
          data: { candidateId: keep.id },
        });

        // Fill in any field the keeper is missing
        const updates: Record<string, unknown> = {};
        if (!keep.phone && merge.phone) updates.phone = merge.phone;
        if (!keep.linkedinUrl && merge.linkedinUrl) updates.linkedinUrl = merge.linkedinUrl;
        if (!keep.skills && merge.skills) updates.skills = merge.skills;
        if (!keep.experience && merge.experience) updates.experience = merge.experience;
        if (!keep.resumeUrl && merge.resumeUrl) updates.resumeUrl = merge.resumeUrl;
        if (!keep.resumeText && merge.resumeText) updates.resumeText = merge.resumeText;
        if (!keep.source && merge.source) updates.source = merge.source;
        if (!keep.jobAppliedTo && merge.jobAppliedTo) updates.jobAppliedTo = merge.jobAppliedTo;
        if (merge.notes && merge.notes !== keep.notes) {
          updates.notes = [keep.notes, merge.notes].filter(Boolean).join("\n---\n");
        }
        // Preserve Do Not Call: if either side has it, keeper gets it
        if (merge.doNotCall && !keep.doNotCall) {
          updates.doNotCall = true;
          updates.doNotCallReason = merge.doNotCallReason || "Merged from duplicate";
          updates.doNotCallAt = merge.doNotCallAt || new Date();
        }
        updates.applicationCount = (keep.applicationCount || 1) + (merge.applicationCount || 1);

        if (Object.keys(updates).length > 0) {
          await db.candidate.update({ where: { id: keep.id }, data: updates });
        }

        const loserPdf = path.join(RESUMES_DIR, `${merge.id}.pdf`);
        if (existsSync(loserPdf)) {
          try { await rm(loserPdf); } catch { /* ignore */ }
        }

        await db.candidate.delete({ where: { id: merge.id } });
        mergedRecords++;

        canonical = { ...keep, ...(updates as Partial<CandidateLite>) };
      }
      unitedGroups++;
    }

    revalidatePath("/cv");

    return NextResponse.json({
      unitedGroups,
      mergedRecords,
      totalBefore: allCandidates.length,
      totalAfter: allCandidates.length - mergedRecords,
      // Legacy field names for existing UI code
      duplicatesFound: mergedRecords,
      deleted: mergedRecords,
    });
  } catch (error) {
    console.error("[Unite duplicates] Failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unite failed" },
      { status: 500 }
    );
  }
}
