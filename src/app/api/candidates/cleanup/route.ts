import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function POST() {
  const session = await requireApiAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Find all duplicate emails (keep the oldest record)
    const allCandidates = await db.candidate.findMany({
      select: { id: true, email: true, createdAt: true, inPipeline: true, status: true },
      orderBy: { createdAt: "asc" },
    });

    const seen = new Map<string, string>(); // email → first id (to keep)
    const toDelete: string[] = [];

    for (const c of allCandidates) {
      const email = c.email.toLowerCase().trim();
      if (seen.has(email)) {
        // This is a duplicate — delete the newer one, unless it's in pipeline or hired
        if (c.inPipeline || c.status === "HIRED") {
          // Keep the active one, delete the older one instead
          const oldId = seen.get(email)!;
          const oldCandidate = allCandidates.find((x) => x.id === oldId);
          if (oldCandidate && !oldCandidate.inPipeline && oldCandidate.status !== "HIRED") {
            toDelete.push(oldId);
            seen.set(email, c.id);
          }
          // If both are active, keep the older one
        } else {
          toDelete.push(c.id);
        }
      } else {
        seen.set(email, c.id);
      }
    }

    // Delete duplicates in batches
    let deleted = 0;
    const CHUNK_SIZE = 500;
    for (let i = 0; i < toDelete.length; i += CHUNK_SIZE) {
      const chunk = toDelete.slice(i, i + CHUNK_SIZE);
      const result = await db.candidate.deleteMany({
        where: { id: { in: chunk } },
      });
      deleted += result.count;
    }

    revalidatePath("/cv");

    return NextResponse.json({
      duplicatesFound: toDelete.length,
      deleted,
      totalBefore: allCandidates.length,
      totalAfter: allCandidates.length - deleted,
    });
  } catch (error) {
    console.error("[Cleanup] Failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cleanup failed" },
      { status: 500 }
    );
  }
}
