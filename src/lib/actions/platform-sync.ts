"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getPlatformClient, hasSyncSupport } from "@/lib/platform-sync";
import { createCandidate } from "./candidates";

export async function connectPlatform(
  platformId: string,
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  const platform = await db.recruitmentPlatform.findUnique({ where: { id: platformId } });
  if (!platform) return { success: false, error: "Platform not found" };

  const client = getPlatformClient(platform.name);
  if (!client) return { success: false, error: "No integration available for this platform" };

  const valid = await client.validateCredentials(apiKey);
  if (!valid) return { success: false, error: "Invalid credentials. Check your API key format." };

  await db.recruitmentPlatform.update({
    where: { id: platformId },
    data: {
      apiKey,
      status: "ACTIVE",
      connectedAt: new Date(),
    },
  });

  revalidatePath("/settings");
  revalidatePath("/cv");
  return { success: true };
}

export async function connectPlatformByName(
  name: string,
  type: "PREMIUM" | "NICHE" | "SOCIAL" | "JOB_BOARD",
  monthlyCost: number,
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  const client = getPlatformClient(name);
  if (!client) return { success: false, error: "No integration available for this platform" };

  const valid = await client.validateCredentials(apiKey);
  if (!valid) return { success: false, error: "Invalid credentials. Check your API key format." };

  await db.recruitmentPlatform.upsert({
    where: { name },
    create: {
      name,
      type,
      monthlyCost,
      status: "ACTIVE",
      apiKey,
      connectedAt: new Date(),
    },
    update: {
      apiKey,
      status: "ACTIVE",
      connectedAt: new Date(),
    },
  });

  revalidatePath("/settings");
  revalidatePath("/cv");
  return { success: true };
}

export async function oauthConnectPlatform(
  name: string,
  type: "PREMIUM" | "NICHE" | "SOCIAL" | "JOB_BOARD",
  monthlyCost: number,
  keyPrefix: string
): Promise<{ success: boolean; error?: string }> {
  // Simulate OAuth flow — generate a token as if returned by the platform's OAuth callback
  const token = `${keyPrefix}oauth-${crypto.randomUUID().slice(0, 12)}`;

  await db.recruitmentPlatform.upsert({
    where: { name },
    create: {
      name,
      type,
      monthlyCost,
      status: "ACTIVE",
      apiKey: token,
      connectedAt: new Date(),
    },
    update: {
      apiKey: token,
      status: "ACTIVE",
      connectedAt: new Date(),
    },
  });

  revalidatePath("/settings");
  revalidatePath("/cv");
  return { success: true };
}

export async function disconnectPlatformByName(
  name: string
): Promise<{ success: boolean }> {
  const platform = await db.recruitmentPlatform.findUnique({ where: { name } });
  if (!platform) return { success: true };

  await db.recruitmentPlatform.update({
    where: { name },
    data: {
      apiKey: null,
      status: "DISCONNECTED",
    },
  });

  revalidatePath("/settings");
  revalidatePath("/cv");
  return { success: true };
}

export async function disconnectPlatform(
  platformId: string
): Promise<{ success: boolean }> {
  await db.recruitmentPlatform.update({
    where: { id: platformId },
    data: {
      apiKey: null,
      status: "DISCONNECTED",
    },
  });

  revalidatePath("/settings");
  revalidatePath("/cv");
  return { success: true };
}

export async function syncCandidatesFromPlatform(
  platformId: string
): Promise<{
  success: boolean;
  candidatesFound: number;
  candidatesCreated: number;
  skippedEmails: string[];
  error?: string;
}> {
  const platform = await db.recruitmentPlatform.findUnique({ where: { id: platformId } });
  if (!platform) return { success: false, candidatesFound: 0, candidatesCreated: 0, skippedEmails: [], error: "Platform not found" };
  if (!platform.apiKey) return { success: false, candidatesFound: 0, candidatesCreated: 0, skippedEmails: [], error: "Platform not connected. Add credentials first." };

  const client = getPlatformClient(platform.name);
  if (!client) return { success: false, candidatesFound: 0, candidatesCreated: 0, skippedEmails: [], error: "No integration available" };

  try {
    const mockCandidates = await client.fetchCandidates();
    let created = 0;
    const skipped: string[] = [];

    for (const mc of mockCandidates) {
      const existing = await db.candidate.findUnique({ where: { email: mc.email } });
      if (existing) {
        skipped.push(mc.email);
        continue;
      }

      await createCandidate({
        firstName: mc.firstName,
        lastName: mc.lastName,
        email: mc.email,
        phone: mc.phone,
        skills: mc.skills,
        experience: mc.experience,
        source: mc.source,
        linkedinUrl: mc.linkedinUrl,
        notes: mc.notes,
      });
      created++;
    }

    await db.platformSyncLog.create({
      data: {
        platformId,
        candidatesFound: mockCandidates.length,
        candidatesNew: created,
        skippedEmails: skipped.length > 0 ? JSON.stringify(skipped) : null,
        status: created > 0 ? "SUCCESS" : skipped.length > 0 ? "PARTIAL" : "SUCCESS",
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

    return {
      success: true,
      candidatesFound: mockCandidates.length,
      candidatesCreated: created,
      skippedEmails: skipped,
    };
  } catch (err) {
    await db.platformSyncLog.create({
      data: {
        platformId,
        candidatesFound: 0,
        candidatesNew: 0,
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : "Unknown error",
      },
    });

    return { success: false, candidatesFound: 0, candidatesCreated: 0, skippedEmails: [], error: "Sync failed. Please try again." };
  }
}

export async function getSyncablePlatforms() {
  const platforms = await db.recruitmentPlatform.findMany({
    include: {
      syncLogs: {
        orderBy: { syncedAt: "desc" },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
  });

  return platforms
    .filter((p) => hasSyncSupport(p.name))
    .map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      status: p.status,
      isConnected: !!p.apiKey,
      lastSyncAt: p.lastSyncAt,
      totalSynced: p.totalSynced,
      lastSyncLog: p.syncLogs[0] || null,
    }));
}
