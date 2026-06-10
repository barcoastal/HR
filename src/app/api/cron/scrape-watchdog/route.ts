import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const CRON_SECRET = process.env.CRON_SECRET || "";
// Railway personal access token + service ID for the breezy-scraper.
// When both are set, the watchdog will restart the service on stale heartbeat.
const RAILWAY_API_TOKEN = process.env.RAILWAY_API_TOKEN || "";
const RAILWAY_SCRAPER_SERVICE_ID = process.env.RAILWAY_SCRAPER_SERVICE_ID || "";
const RAILWAY_SCRAPER_ENVIRONMENT_ID = process.env.RAILWAY_SCRAPER_ENVIRONMENT_ID || "";

const STALE_AFTER_MS = 15 * 60 * 1000; // 15 minutes
const NOTIFY_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour between notifications

/**
 * GET /api/cron/scrape-watchdog?secret=...
 *
 * Called every few minutes by the hr-cron-sync curl loop. Inspects the
 * breezy-scraper's last heartbeat. If it's been more than STALE_AFTER_MS
 * since the worker checked in:
 *   1. POSTs a Railway GraphQL restart mutation for the service (only if
 *      RAILWAY_API_TOKEN + service IDs are configured).
 *   2. Sends an in-app + email notification to every SUPER_ADMIN.
 * Both actions are throttled by NOTIFY_COOLDOWN_MS so we don't spam.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("secret") !== CRON_SECRET || !CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const heartbeat = await db.workerHeartbeat.findUnique({
    where: { name: "breezy-scraper" },
  });

  // No heartbeat yet → worker has never reported. Could be brand-new deploy.
  // Allow it 30 min to come up before alerting.
  if (!heartbeat) {
    return NextResponse.json({ status: "no-heartbeat-yet" });
  }

  const ageMs = Date.now() - heartbeat.lastTickAt.getTime();
  const stale = ageMs > STALE_AFTER_MS;

  if (!stale) {
    return NextResponse.json({
      status: "healthy",
      ageMinutes: Math.round(ageMs / 60000),
      pending: heartbeat.pendingCount,
    });
  }

  // Stale. Decide whether to act based on cooldown.
  const lastNotified = await getLastNotified();
  const sinceLastNotify = lastNotified ? Date.now() - lastNotified.getTime() : Infinity;
  if (sinceLastNotify < NOTIFY_COOLDOWN_MS) {
    return NextResponse.json({
      status: "stale-but-recently-notified",
      ageMinutes: Math.round(ageMs / 60000),
      lastNotifiedMinutesAgo: Math.round(sinceLastNotify / 60000),
    });
  }

  const ageMinutes = Math.round(ageMs / 60000);
  let restartResult: { tried: boolean; ok?: boolean; error?: string } = { tried: false };
  if (RAILWAY_API_TOKEN && RAILWAY_SCRAPER_SERVICE_ID && RAILWAY_SCRAPER_ENVIRONMENT_ID) {
    restartResult = await restartRailwayService();
  }

  await notifyAdmins(ageMinutes, heartbeat.pendingCount, restartResult);
  await markNotified();

  return NextResponse.json({
    status: "stale-acted",
    ageMinutes,
    pending: heartbeat.pendingCount,
    restart: restartResult,
  });
}

// Track "last notified" in the heartbeat row itself by stashing it in a
// separate name. Simpler than another table.
async function getLastNotified(): Promise<Date | null> {
  const row = await db.workerHeartbeat.findUnique({
    where: { name: "scrape-watchdog:lastNotified" },
  });
  return row?.lastTickAt ?? null;
}
async function markNotified() {
  await db.workerHeartbeat.upsert({
    where: { name: "scrape-watchdog:lastNotified" },
    update: { lastTickAt: new Date() },
    create: { name: "scrape-watchdog:lastNotified" },
  });
}

async function restartRailwayService(): Promise<{ tried: boolean; ok?: boolean; error?: string }> {
  try {
    // First find the latest deployment for the service.
    const deploymentsQuery = `query($serviceId: String!, $environmentId: String!) {
      deployments(input: { serviceId: $serviceId, environmentId: $environmentId }, first: 1) {
        edges { node { id status } }
      }
    }`;
    const dRes = await fetch("https://backboard.railway.app/graphql/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RAILWAY_API_TOKEN}`,
      },
      body: JSON.stringify({
        query: deploymentsQuery,
        variables: { serviceId: RAILWAY_SCRAPER_SERVICE_ID, environmentId: RAILWAY_SCRAPER_ENVIRONMENT_ID },
      }),
    });
    const dJson = await dRes.json();
    const deploymentId = dJson?.data?.deployments?.edges?.[0]?.node?.id;
    if (!deploymentId) {
      return { tried: true, ok: false, error: `no deployment id in response: ${JSON.stringify(dJson).slice(0, 200)}` };
    }

    const restartMutation = `mutation($id: String!) { deploymentRestart(id: $id) }`;
    const rRes = await fetch("https://backboard.railway.app/graphql/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RAILWAY_API_TOKEN}`,
      },
      body: JSON.stringify({
        query: restartMutation,
        variables: { id: deploymentId },
      }),
    });
    const rJson = await rRes.json();
    if (rJson?.errors) {
      return { tried: true, ok: false, error: `restart errors: ${JSON.stringify(rJson.errors).slice(0, 200)}` };
    }
    return { tried: true, ok: true };
  } catch (err) {
    return { tried: true, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function notifyAdmins(
  ageMinutes: number,
  pending: number,
  restart: { tried: boolean; ok?: boolean; error?: string },
) {
  try {
    const admins = await db.user.findMany({
      where: {
        role: "SUPER_ADMIN",
        employeeId: { not: null },
        employee: { status: "ACTIVE" },
      },
      select: { employeeId: true, email: true, emailNotificationsEnabled: true },
    });
    if (admins.length === 0) return;

    const restartLine = restart.tried
      ? restart.ok
        ? "Auto-restart triggered via Railway API."
        : `Auto-restart failed: ${restart.error}. Restart manually in Railway.`
      : "Auto-restart not configured (RAILWAY_API_TOKEN / RAILWAY_SCRAPER_SERVICE_ID missing). Restart manually in Railway.";

    const message =
      `Breezy resume scraper is silent. Last tick ${ageMinutes} min ago, ` +
      `${pending} candidate${pending === 1 ? "" : "s"} waiting on resumes. ${restartLine}`;

    await db.notification.createMany({
      data: admins
        .filter((a) => a.employeeId)
        .map((a) => ({
          recipientId: a.employeeId!,
          type: "BREEZY_SCRAPER_STALE",
          message,
          link: "/cv",
        })),
    });

    // Email the admins too — silent failures are exactly what we want loud.
    const { sendEmail } = await import("@/lib/email");
    for (const a of admins) {
      if (!a.email || !a.emailNotificationsEnabled) continue;
      try {
        await sendEmail(
          a.email,
          "Breezy resume scraper stalled",
          `<p>${message}</p><p>Service: <code>breezy-scraper</code> (handsome-adventure).</p>`,
        );
      } catch (err) {
        console.error("[watchdog] email failed:", err);
      }
    }
  } catch (err) {
    console.error("[watchdog] notify failed:", err);
  }
}
