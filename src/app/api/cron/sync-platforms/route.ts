import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncCandidatesStreaming } from "@/lib/actions/platform-sync-stream";

import { isAuthorizedCronRequest } from "@/lib/cron-auth";

/**
 * GET /api/cron/sync-platforms
 * Auth: `Authorization: Bearer $CRON_SECRET` (preferred) or `?secret=...`
 * Pulls candidates from every connected recruitment platform.
 * Wire to a 5-minute schedule in Railway / external scheduler.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const platforms = await db.recruitmentPlatform.findMany({
    where: { apiKey: { not: null }, status: "ACTIVE" },
    select: { id: true, name: true },
  });

  const results: { platform: string; fetched: number; created: number; updated: number; resumesDownloaded?: number; error?: string }[] = [];

  for (const platform of platforms) {
    let final: { fetched: number; created: number; updated: number; resumesDownloaded?: number; resumesFailed?: number; type: string; detail?: string } | null = null;
    try {
      for await (const evt of syncCandidatesStreaming(platform.id)) {
        final = evt;
      }
      if (!final) {
        results.push({ platform: platform.name, fetched: 0, created: 0, updated: 0 });
        continue;
      }
      results.push({
        platform: platform.name,
        fetched: final.fetched,
        created: final.created,
        updated: final.updated,
        resumesDownloaded: final.resumesDownloaded,
        ...(final.type === "error" ? { error: final.detail } : {}),
      });
    } catch (err) {
      results.push({
        platform: platform.name,
        fetched: 0, created: 0, updated: 0,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ ranAt: new Date().toISOString(), platforms: results });
}
