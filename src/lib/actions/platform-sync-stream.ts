import { db } from "@/lib/db";
import { getPlatformClient } from "@/lib/platform-sync";
import { createCandidate } from "./candidates";
import { ensureValidToken } from "./platform-sync";
import type { SyncProgressEvent } from "@/lib/platform-sync/types";
import { revalidatePath } from "next/cache";

export async function* syncCandidatesStreaming(
  platformId: string
): AsyncGenerator<SyncProgressEvent> {
  const platform = await db.recruitmentPlatform.findUnique({
    where: { id: platformId },
  });
  if (!platform || !platform.apiKey) {
    yield { type: "error", detail: "Platform not found or not connected", fetched: 0, created: 0, skipped: 0, page: 0, total: 0 };
    return;
  }

  const client = getPlatformClient(platform.name);
  if (!client) {
    yield { type: "error", detail: "No integration available", fetched: 0, created: 0, skipped: 0, page: 0, total: 0 };
    return;
  }

  const tokenResult = await ensureValidToken(platformId);
  if (!tokenResult.valid || !tokenResult.accessToken) {
    yield { type: "error", detail: tokenResult.error ?? "Invalid token", fetched: 0, created: 0, skipped: 0, page: 0, total: 0 };
    return;
  }

  // If the client doesn't support pagination, fall back to batch
  if (!client.fetchCandidatesPaginated) {
    yield { type: "progress", detail: "Fetching all candidates...", fetched: 0, created: 0, skipped: 0, page: 1, total: 0 };
    const candidates = await client.fetchCandidates(tokenResult.accessToken);
    let created = 0;
    let skipped = 0;
    for (const mc of candidates) {
      const existing = await db.candidate.findUnique({ where: { email: mc.email } });
      if (existing) { skipped++; continue; }
      await createCandidate({
        firstName: mc.firstName, lastName: mc.lastName, email: mc.email,
        phone: mc.phone, skills: mc.skills, experience: mc.experience,
        source: mc.source, linkedinUrl: mc.linkedinUrl, notes: mc.notes,
      });
      created++;
    }
    yield { type: "complete", fetched: candidates.length, created, skipped, page: 1, total: candidates.length };
    await finalizeSyncLog(platformId, candidates.length, created, skipped);
    return;
  }

  // Paginated streaming
  let cursor: string | null = null;
  let page = 0;
  let totalFetched = 0;
  let totalCreated = 0;
  let totalSkipped = 0;
  let totalEstimate = 0;
  const seenEmails = new Set<string>();

  try {
    do {
      page++;
      const result = await client.fetchCandidatesPaginated(tokenResult.accessToken, cursor);
      if (page === 1) totalEstimate = result.totalEstimate;

      for (const mc of result.candidates) {
        totalFetched++;
        if (seenEmails.has(mc.email)) { totalSkipped++; continue; }
        seenEmails.add(mc.email);

        const existing = await db.candidate.findUnique({ where: { email: mc.email } });
        if (existing) { totalSkipped++; continue; }

        await createCandidate({
          firstName: mc.firstName, lastName: mc.lastName, email: mc.email,
          phone: mc.phone, skills: mc.skills, experience: mc.experience,
          source: mc.source, linkedinUrl: mc.linkedinUrl, notes: mc.notes,
        });
        totalCreated++;
      }

      yield {
        type: "progress",
        detail: `Page ${page} processed (${result.candidates.length} candidates)`,
        fetched: totalFetched,
        created: totalCreated,
        skipped: totalSkipped,
        page,
        total: totalEstimate,
      };

      cursor = result.nextCursor;
    } while (cursor);

    yield {
      type: "complete",
      fetched: totalFetched,
      created: totalCreated,
      skipped: totalSkipped,
      page,
      total: totalEstimate,
    };

    await finalizeSyncLog(platformId, totalFetched, totalCreated, totalSkipped);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    yield {
      type: "error",
      detail: message,
      fetched: totalFetched,
      created: totalCreated,
      skipped: totalSkipped,
      page,
      total: totalEstimate,
    };

    await db.platformSyncLog.create({
      data: {
        platformId,
        candidatesFound: totalFetched,
        candidatesNew: totalCreated,
        status: "FAILED",
        errorMessage: message,
      },
    });
  }
}

async function finalizeSyncLog(
  platformId: string,
  found: number,
  created: number,
  skipped: number
) {
  const skippedEmails = skipped > 0 ? JSON.stringify({ count: skipped }) : null;

  await db.platformSyncLog.create({
    data: {
      platformId,
      candidatesFound: found,
      candidatesNew: created,
      skippedEmails,
      status: created > 0 ? "SUCCESS" : skipped > 0 ? "PARTIAL" : "SUCCESS",
    },
  });

  await db.recruitmentPlatform.update({
    where: { id: platformId },
    data: {
      lastSyncAt: new Date(),
      totalSynced: { increment: created },
    },
  });

  revalidatePath("/cv");
  revalidatePath("/settings");
  revalidatePath("/analytics");
}
