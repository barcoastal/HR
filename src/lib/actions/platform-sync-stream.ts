import { db } from "@/lib/db";
import { getPlatformClient } from "@/lib/platform-sync";
import { createCandidate } from "./candidates";
import { ensureValidToken } from "./platform-sync";
import type { SyncProgressEvent } from "@/lib/platform-sync/types";
import { revalidatePath } from "next/cache";
import { writeFile, mkdir, readdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

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

const RESUMES_DIR = path.join(process.cwd(), "data", "resumes");

async function downloadResumePdf(resumeUrl: string, candidateId: string): Promise<boolean> {
  try {
    const apiKey = process.env.NOLIG_API_KEY || "";
    const res = await fetch(resumeUrl, {
      headers: { Authorization: `Bearer token=${apiKey}` },
    });
    if (!res.ok) return false;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("pdf") && !ct.includes("octet-stream")) return false;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 100) return false;
    await writeFile(path.join(RESUMES_DIR, `${candidateId}.pdf`), buffer);
    return true;
  } catch {
    return false;
  }
}

export async function* resyncCandidatesStreaming(
  platformId: string,
  purge = false
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

  // Phase 0: Purge existing candidates from this platform
  if (purge) {
    yield { type: "progress", detail: "Deleting existing candidates...", fetched: 0, created: 0, updated: 0, skipped: 0, page: 0, total: 0 };

    // Find candidates by source — try both platform name and known source strings
    const sourceNames = [platform.name, client.platformName];
    // Jobing uses "pro.jobing" as source instead of "Jobing"
    if (platform.name === "Jobing") sourceNames.push("pro.jobing");

    const existing = await db.candidate.findMany({
      where: { source: { in: sourceNames } },
      select: { id: true },
    });

    // Delete local resume PDFs
    if (existsSync(RESUMES_DIR)) {
      for (const c of existing) {
        const pdfPath = path.join(RESUMES_DIR, `${c.id}.pdf`);
        if (existsSync(pdfPath)) {
          await unlink(pdfPath);
        }
      }
    }

    // Delete candidates from DB
    const deleted = await db.candidate.deleteMany({
      where: { source: { in: sourceNames } },
    });

    // Reset platform sync count
    await db.recruitmentPlatform.update({
      where: { id: platformId },
      data: { totalSynced: 0 },
    });

    yield { type: "progress", detail: `Deleted ${deleted.count} existing candidates. Fetching fresh data...`, fetched: 0, created: 0, updated: 0, skipped: 0, page: 0, total: 0 };
  } else {
    yield { type: "progress", detail: "Fetching all candidates...", fetched: 0, created: 0, updated: 0, skipped: 0, page: 0, total: 0 };
  }

  try {
    const allCandidates = await client.fetchCandidates(tokenResult.accessToken);
    const total = allCandidates.length;
    let processed = 0;
    let updated = 0;
    let created = 0;

    // Phase 1: Import candidate data
    const needsResume: { id: string; url: string }[] = [];

    for (const mc of allCandidates) {
      processed++;
      const existing = await db.candidate.findUnique({ where: { email: mc.email } });

      if (existing) {
        const data: Record<string, unknown> = {};
        if (mc.resumeUrl) data.resumeUrl = mc.resumeUrl;
        if (mc.jobAppliedTo) data.jobAppliedTo = mc.jobAppliedTo;
        if (mc.experience) data.experience = mc.experience;
        if (mc.phone && !existing.phone) data.phone = mc.phone;
        if (Object.keys(data).length > 0) {
          await db.candidate.update({ where: { id: existing.id }, data });
          updated++;
        }
        if (mc.resumeUrl && !existing.resumeUrl?.startsWith("/api/resumes/")) {
          needsResume.push({ id: existing.id, url: mc.resumeUrl });
        }
      } else {
        const newCandidate = await createCandidate({
          firstName: mc.firstName, lastName: mc.lastName, email: mc.email,
          phone: mc.phone, skills: mc.skills, experience: mc.experience,
          source: mc.source, linkedinUrl: mc.linkedinUrl, notes: mc.notes,
          resumeUrl: mc.resumeUrl, jobAppliedTo: mc.jobAppliedTo, inPipeline: false,
        });
        created++;
        if (mc.resumeUrl && newCandidate?.id) {
          needsResume.push({ id: newCandidate.id, url: mc.resumeUrl });
        }
      }

      if (processed % 50 === 0 || processed === total) {
        yield {
          type: "progress",
          detail: `Importing candidates ${processed}/${total}...`,
          fetched: processed, created, updated, skipped: 0, page: 1, total,
        };
      }
    }

    await db.recruitmentPlatform.update({
      where: { id: platformId },
      data: { lastSyncAt: new Date(), totalSynced: created },
    });

    // Phase 2: Download resume PDFs
    if (!existsSync(RESUMES_DIR)) {
      await mkdir(RESUMES_DIR, { recursive: true });
    }

    let resumesDownloaded = 0;
    let resumesFailed = 0;

    for (let i = 0; i < needsResume.length; i++) {
      const { id, url } = needsResume[i];

      // Skip if already downloaded
      if (existsSync(path.join(RESUMES_DIR, `${id}.pdf`))) {
        await db.candidate.update({ where: { id }, data: { resumeUrl: `/api/resumes/${id}` } });
        resumesDownloaded++;
      } else {
        const ok = await downloadResumePdf(url, id);
        if (ok) {
          await db.candidate.update({ where: { id }, data: { resumeUrl: `/api/resumes/${id}` } });
          resumesDownloaded++;
        } else {
          resumesFailed++;
        }
      }

      if ((i + 1) % 20 === 0 || i === needsResume.length - 1) {
        yield {
          type: "progress",
          detail: `Downloading resumes ${i + 1}/${needsResume.length}...`,
          fetched: processed, created, updated, skipped: 0, page: 2, total,
          resumesDownloaded, resumesFailed,
        };
      }
    }

    revalidatePath("/cv");

    yield {
      type: "complete",
      fetched: processed, created, updated, skipped: 0, page: 2, total,
      resumesDownloaded, resumesFailed,
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
