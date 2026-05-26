import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

const BG_CHECK_BASE = "https://app.backgroundchecks.com/api";
const BG_CHECK_API_KEY = process.env.BACKGROUND_CHECK_API_KEY || "";

/**
 * POST /api/background-check/link
 * Body: { candidateId: string }
 *
 * Searches backgroundchecks.com for any report tied to the candidate's email
 * address and, if exactly one match is found, persists its report_key on the
 * candidate as backgroundCheckId. The next "View Report" hit then streams the
 * PDF and caches it as a FileBlob via the existing /pdf route.
 *
 * Used when a report was ordered outside of CALATRAVA (or the order failed to
 * record the key on our side) and an admin needs to wire it up after the fact.
 */
export async function POST(req: NextRequest) {
  const session = await requireApiAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!BG_CHECK_API_KEY) {
    return NextResponse.json({ error: "BACKGROUND_CHECK_API_KEY not configured" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const candidateId = typeof body?.candidateId === "string" ? body.candidateId : null;
  if (!candidateId) return NextResponse.json({ error: "candidateId required" }, { status: 400 });

  const candidate = await db.candidate.findUnique({
    where: { id: candidateId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      backgroundCheckId: true,
    },
  });
  if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  if (candidate.backgroundCheckId) {
    return NextResponse.json({ alreadyLinked: true, reportKey: candidate.backgroundCheckId });
  }

  const apiUrl = (path: string) => {
    const sep = path.includes("?") ? "&" : "?";
    return `${BG_CHECK_BASE}${path}${sep}api_token=${BG_CHECK_API_KEY}`;
  };
  const probes = [
    `/reports?applicant_email=${encodeURIComponent(candidate.email)}`,
    `/reports?email=${encodeURIComponent(candidate.email)}`,
    `/applicants?email=${encodeURIComponent(candidate.email)}`,
    `/orders?applicant_email=${encodeURIComponent(candidate.email)}`,
  ];

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
      if (!res.ok || !ct.includes("json")) continue;
      const text = await res.text();
      const data = JSON.parse(text) as ReportHit | ReportHit[] | { applicants?: ReportHit[]; reports?: ReportHit[]; data?: ReportHit[] };
      let items: ReportHit[] = [];
      if (Array.isArray(data)) items = data;
      else if ("applicants" in data && Array.isArray(data.applicants)) items = data.applicants;
      else if ("reports" in data && Array.isArray(data.reports)) items = data.reports;
      else if ("data" in data && Array.isArray(data.data)) items = data.data;
      else if (typeof data === "object" && data !== null && (data as ReportHit).report_key) items = [data as ReportHit];

      for (const item of items) {
        const key = item.report_key;
        if (key && !found.find((f) => f.report_key === key)) {
          found.push(item);
        }
      }
    } catch {
      // try next probe
    }
  }

  if (found.length === 0) {
    return NextResponse.json(
      {
        error: "No report found for this candidate on backgroundchecks.com",
        details: `Searched by email ${candidate.email}. Confirm the candidate completed their check and that the email on file matches the one used at backgroundchecks.com.`,
      },
      { status: 404 }
    );
  }

  if (found.length > 1) {
    return NextResponse.json(
      {
        error: "Multiple reports matched — cannot link automatically",
        candidates: found,
        details: "Confirm the right report_key on backgroundchecks.com and contact engineering to wire it up.",
      },
      { status: 409 }
    );
  }

  const reportKey = found[0].report_key!;
  await db.candidate.update({
    where: { id: candidate.id },
    data: { backgroundCheckId: reportKey },
  });

  return NextResponse.json({ linkedReportKey: reportKey });
}
