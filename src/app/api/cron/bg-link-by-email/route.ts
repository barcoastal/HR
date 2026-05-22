import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const CRON_SECRET = process.env.CRON_SECRET || "";
const BG_CHECK_BASE = "https://app.backgroundchecks.com/api";
const BG_CHECK_API_KEY = process.env.BACKGROUND_CHECK_API_KEY || "";

/**
 * GET /api/cron/bg-link-by-email?secret=...&email=...
 *
 * Looks up the candidate locally by email, then probes backgroundchecks.com
 * for any reports tied to that applicant. If exactly one report is found, we
 * link its report_key to our candidate.backgroundCheckId so the "View
 * Report" button starts working.
 *
 * Returns the probe results either way so we can diagnose.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!BG_CHECK_API_KEY) {
    return NextResponse.json({ error: "BACKGROUND_CHECK_API_KEY not configured" }, { status: 500 });
  }

  const email = url.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "pass ?email=..." }, { status: 400 });

  const candidate = await db.candidate.findUnique({
    where: { email },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      backgroundCheckId: true,
      backgroundCheckStatus: true,
    },
  });
  if (!candidate) {
    return NextResponse.json({ error: "No candidate with that email" }, { status: 404 });
  }

  function apiUrl(path: string) {
    const sep = path.includes("?") ? "&" : "?";
    return `${BG_CHECK_BASE}${path}${sep}api_token=${BG_CHECK_API_KEY}`;
  }

  // Try the documented and common patterns for finding reports by applicant.
  const probes = [
    `/reports?applicant_email=${encodeURIComponent(email)}`,
    `/reports?email=${encodeURIComponent(email)}`,
    `/applicants?email=${encodeURIComponent(email)}`,
    `/orders?applicant_email=${encodeURIComponent(email)}`,
  ];

  type Probe = { path: string; status: number; contentType: string | null; bodyPreview: string };
  const results: Probe[] = [];
  type ReportHit = { report_key?: string; applicant_email?: string; status?: string };
  const found: ReportHit[] = [];

  for (const path of probes) {
    try {
      const res = await fetch(apiUrl(path), {
        method: "GET",
        headers: { Accept: "application/json" },
        redirect: "manual",
      });
      const ct = res.headers.get("content-type") || "";
      const text = await res.text();
      results.push({ path, status: res.status, contentType: ct, bodyPreview: text.slice(0, 400) });
      if (res.ok && ct.includes("json")) {
        try {
          const data = JSON.parse(text) as ReportHit | ReportHit[] | { applicants?: ReportHit[]; reports?: ReportHit[]; data?: ReportHit[] };
          // Flatten common shapes
          let items: ReportHit[] = [];
          if (Array.isArray(data)) items = data;
          else if ("applicants" in data && Array.isArray(data.applicants)) items = data.applicants;
          else if ("reports" in data && Array.isArray(data.reports)) items = data.reports;
          else if ("data" in data && Array.isArray(data.data)) items = data.data;
          else if (typeof data === "object" && data !== null) items = [data as ReportHit];

          for (const item of items) {
            const key = item.report_key;
            if (key && !found.find((f) => f.report_key === key)) {
              found.push(item);
            }
          }
        } catch {
          // not JSON we can use
        }
      }
    } catch (err) {
      results.push({ path, status: 0, contentType: null, bodyPreview: String(err) });
    }
  }

  let linkedReportKey: string | null = null;
  if (found.length === 1 && found[0].report_key) {
    linkedReportKey = found[0].report_key;
    await db.candidate.update({
      where: { id: candidate.id },
      data: { backgroundCheckId: linkedReportKey },
    });
  }

  return NextResponse.json({
    candidate,
    linkedReportKey,
    candidatesFoundOnProvider: found,
    rawProbes: results,
  });
}
