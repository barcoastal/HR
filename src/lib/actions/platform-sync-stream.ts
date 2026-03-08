import { db } from "@/lib/db";
import { getPlatformClient } from "@/lib/platform-sync";
import { createCandidate } from "./candidates";
import { ensureValidToken } from "./platform-sync";
import type { SyncProgressEvent } from "@/lib/platform-sync/types";
import { revalidatePath } from "next/cache";

async function updateExistingCandidate(
  existing: { id: string; resumeUrl: string | null; jobAppliedTo: string | null; experience: string | null },
  mc: { resumeUrl?: string; jobAppliedTo?: string; experience?: string }
): Promise<boolean> {
  const updates: Record<string, unknown> = {};
  if (!existing.resumeUrl && mc.resumeUrl) updates.resumeUrl = mc.resumeUrl;
  if (!existing.jobAppliedTo && mc.jobAppliedTo) updates.jobAppliedTo = mc.jobAppliedTo;
  if (!existing.experience && mc.experience) updates.experience = mc.experience;
  if (Object.keys(updates).length > 0) {
    await db.candidate.update({ where: { id: existing.id }, data: updates });
    return true;
  }
  return false;
}

export async function* syncCandidatesStreaming(
  platformId: string
): AsyncGenerator<SyncProgressEvent> {
  const platform = await db.recruitmentPlatform.findUnique({
    where: { id: platformId },
  });
  if (!platform || !platform.apiKey) {
    yield { type: "error", detail: "Platform not found or not connected", fetched: 0, created: 0, updated: 0, skipped: 0, page: 0, total: 0 };
    return;
  }

  const client = getPlatformClient(platform.name);
  if (!client) {
    yield { type: "error", detail: "No integration available", fetched: 0, created: 0, updated: 0, skipped: 0, page: 0, total: 0 };
    return;
  }

  const tokenResult = await ensureValidToken(platformId);
  if (!tokenResult.valid || !tokenResult.accessToken) {
    yield { type: "error", detail: tokenResult.error ?? "Invalid token", fetched: 0, created: 0, updated: 0, skipped: 0, page: 0, total: 0 };
    return;
  }

  // If the client doesn't support pagination, fall back to batch
  if (!client.fetchCandidatesPaginated) {
    yield { type: "progress", detail: "Fetching all candidates...", fetched: 0, created: 0, updated: 0, skipped: 0, page: 1, total: 0 };
    const candidates = await client.fetchCandidates(tokenResult.accessToken);
    let created = 0;
    let updated = 0;
    let skipped = 0;
    for (const mc of candidates) {
      const existing = await db.candidate.findUnique({ where: { email: mc.email } });
      if (existing) {
        const wasUpdated = await updateExistingCandidate(existing, mc);
        if (wasUpdated) updated++;
        skipped++;
        continue;
      }
      await createCandidate({
        firstName: mc.firstName, lastName: mc.lastName, email: mc.email,
        phone: mc.phone, skills: mc.skills, experience: mc.experience,
        source: mc.source, linkedinUrl: mc.linkedinUrl, notes: mc.notes,
        resumeUrl: mc.resumeUrl, jobAppliedTo: mc.jobAppliedTo, inPipeline: false,
      });
      created++;
    }
    yield { type: "complete", fetched: candidates.length, created, updated, skipped, page: 1, total: candidates.length };
    await finalizeSyncLog(platformId, candidates.length, created, skipped);
    return;
  }

  // Paginated streaming
  let cursor: string | null = null;
  let page = 0;
  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
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
        if (existing) {
          const wasUpdated = await updateExistingCandidate(existing, mc);
          if (wasUpdated) totalUpdated++;
          totalSkipped++;
          continue;
        }

        await createCandidate({
          firstName: mc.firstName, lastName: mc.lastName, email: mc.email,
          phone: mc.phone, skills: mc.skills, experience: mc.experience,
          source: mc.source, linkedinUrl: mc.linkedinUrl, notes: mc.notes,
          resumeUrl: mc.resumeUrl, jobAppliedTo: mc.jobAppliedTo, inPipeline: false,
        });
        totalCreated++;
      }

      yield {
        type: "progress",
        detail: `Page ${page} processed (${result.candidates.length} candidates)`,
        fetched: totalFetched,
        created: totalCreated,
        updated: totalUpdated,
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
      updated: totalUpdated,
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
      updated: totalUpdated,
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

export async function* resyncCandidatesStreaming(
  platformId: string
): AsyncGenerator<SyncProgressEvent> {
  const platform = await db.recruitmentPlatform.findUnique({ where: { id: platformId } });
  if (!platform || !platform.apiKey) {
    yield { type: "error", detail: "Platform not connected", fetched: 0, created: 0, updated: 0, skipped: 0, page: 0, total: 0 };
    return;
  }

  const client = getPlatformClient(platform.name);
  if (!client) {
    yield { type: "error", detail: "No integration available", fetched: 0, created: 0, updated: 0, skipped: 0, page: 0, total: 0 };
    return;
  }

  const tokenResult = await ensureValidToken(platformId);
  if (!tokenResult.valid || !tokenResult.accessToken) {
    yield { type: "error", detail: tokenResult.error ?? "Invalid token", fetched: 0, created: 0, updated: 0, skipped: 0, page: 0, total: 0 };
    return;
  }

  yield { type: "progress", detail: "Fetching all candidates for re-sync...", fetched: 0, created: 0, updated: 0, skipped: 0, page: 0, total: 0 };

  try {
    const allCandidates = await client.fetchCandidates(tokenResult.accessToken);
    const total = allCandidates.length;
    let processed = 0;
    let updated = 0;
    let created = 0;

    for (const mc of allCandidates) {
      processed++;
      const existing = await db.candidate.findUnique({ where: { email: mc.email } });

      if (existing) {
        // Force update fields from platform
        const data: Record<string, unknown> = {};
        if (mc.resumeUrl) data.resumeUrl = mc.resumeUrl;
        if (mc.jobAppliedTo) data.jobAppliedTo = mc.jobAppliedTo;
        if (mc.experience) data.experience = mc.experience;
        if (mc.phone && !existing.phone) data.phone = mc.phone;
        if (Object.keys(data).length > 0) {
          await db.candidate.update({ where: { id: existing.id }, data });
          updated++;
        }
      } else {
        await createCandidate({
          firstName: mc.firstName, lastName: mc.lastName, email: mc.email,
          phone: mc.phone, skills: mc.skills, experience: mc.experience,
          source: mc.source, linkedinUrl: mc.linkedinUrl, notes: mc.notes,
          resumeUrl: mc.resumeUrl, jobAppliedTo: mc.jobAppliedTo, inPipeline: false,
        });
        created++;
      }

      // Yield progress every 50 candidates
      if (processed % 50 === 0 || processed === total) {
        yield {
          type: "progress",
          detail: `Re-syncing ${processed}/${total}...`,
          fetched: processed,
          created,
          updated,
          skipped: 0,
          page: 1,
          total,
        };
      }
    }

    await db.recruitmentPlatform.update({
      where: { id: platformId },
      data: { lastSyncAt: new Date(), totalSynced: { increment: created } },
    });

    revalidatePath("/cv");

    yield {
      type: "complete",
      fetched: processed,
      created,
      updated,
      skipped: 0,
      page: 1,
      total,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    yield { type: "error", detail: message, fetched: 0, created: 0, updated: 0, skipped: 0, page: 0, total: 0 };
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
