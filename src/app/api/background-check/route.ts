import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiAuth } from "@/lib/auth-helpers";

// Auth: query param ?api_token=XXX
// Base: https://app.backgroundchecks.com/api
const BG_CHECK_BASE = "https://app.backgroundchecks.com/api";
const BG_CHECK_API_KEY = process.env.BACKGROUND_CHECK_API_KEY || "";

function apiUrl(path: string) {
  const sep = path.includes("?") ? "&" : "?";
  return `${BG_CHECK_BASE}${path}${sep}api_token=${BG_CHECK_API_KEY}`;
}

// POST /api/background-check  — initiate a background check order
export async function POST(req: NextRequest) {
  const session = await requireApiAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { candidateId, options } = body as {
    candidateId: string;
    options?: {
      report_sku?: "HIRE1" | "HIRE2" | "HIRE3";
      drug_test?: "Y" | "N";
      drug_sku?: "drug" | "drug9" | "drug10";
      mvr?: "Y" | "N";
      employment?: "Y" | "N";
      education?: "Y" | "N";
      blj?: "Y" | "N";
      federal_criminal?: "Y" | "N";
    };
  };

  if (!candidateId) {
    return NextResponse.json({ error: "candidateId is required" }, { status: 400 });
  }

  const candidate = await db.candidate.findUnique({
    where: { id: candidateId },
    include: { position: true },
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  try {
    const payload = {
      report_sku: options?.report_sku || "HIRE1",
      order_quantity: 1,
      applicant_emails: [candidate.email],
      drug_test: options?.drug_test || "N",
      drug_sku: options?.drug_test === "Y" ? (options?.drug_sku || "drug") : "drug",
      mvr: options?.mvr || "N",
      employment: options?.employment || "Y",
      education: options?.education || "Y",
      blj: options?.blj || "Y",
      federal_criminal: options?.federal_criminal || "Y",
      terms_agree: "Y",
    };

    const response = await fetch(apiUrl("/orders/new"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (!BG_CHECK_API_KEY) {
        await db.candidate.update({
          where: { id: candidateId },
          data: {
            status: "BACKGROUND_CHECK",
            backgroundCheckStatus: "PENDING",
            backgroundCheckDate: new Date(),
          },
        });
        return NextResponse.json({
          success: true,
          status: "PENDING",
          message: "Background check initiated (manual mode — no API key configured)",
        });
      }
      return NextResponse.json(
        { error: "Background check API error", details: errorText },
        { status: 502 }
      );
    }

    // Response: { applicants: [{ applicant_email, report_key, applicant_invite_url }] }
    const data = await response.json();
    const reportKey = data.applicants?.[0]?.report_key || null;

    await db.candidate.update({
      where: { id: candidateId },
      data: {
        status: "BACKGROUND_CHECK",
        backgroundCheckStatus: "AWAITING_APPLICANT",
        backgroundCheckId: reportKey,
        backgroundCheckDate: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      reportKey,
      inviteUrl: data.applicants?.[0]?.applicant_invite_url || null,
      status: "AWAITING_APPLICANT",
    });
  } catch (error) {
    // Fallback: still move candidate to BACKGROUND_CHECK status
    await db.candidate.update({
      where: { id: candidateId },
      data: {
        status: "BACKGROUND_CHECK",
        backgroundCheckStatus: "PENDING",
        backgroundCheckDate: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      status: "PENDING",
      message: "Background check initiated (API unreachable — tracking manually)",
    });
  }
}

// GET /api/background-check?candidateId=xxx  — check/refresh status from API
export async function GET(req: NextRequest) {
  const session = await requireApiAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const candidateId = req.nextUrl.searchParams.get("candidateId");

  if (!candidateId) {
    return NextResponse.json({ error: "candidateId is required" }, { status: 400 });
  }

  const candidate = await db.candidate.findUnique({
    where: { id: candidateId },
    select: {
      backgroundCheckStatus: true,
      backgroundCheckId: true,
      backgroundCheckDate: true,
    },
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  // If we have a report_key, poll the actual status from backgroundchecks.com
  if (candidate.backgroundCheckId && BG_CHECK_API_KEY) {
    try {
      // GET /reports/{report_key}/status
      const response = await fetch(
        apiUrl(`/reports/${candidate.backgroundCheckId}/status`),
        { method: "GET" }
      );

      if (response.ok) {
        const data = await response.json();
        // status: "A" = Awaiting Applicant, "P" = Pending, "C" = Complete
        // flagged_for_end_user_review: boolean
        const newStatus = mapApiStatus(data.status, data.flagged_for_end_user_review);

        if (newStatus !== candidate.backgroundCheckStatus) {
          await db.candidate.update({
            where: { id: candidateId },
            data: { backgroundCheckStatus: newStatus },
          });
        }

        return NextResponse.json({
          status: newStatus,
          apiStatus: data.status,
          flagged: data.flagged_for_end_user_review || false,
          reports: data.reports || null,
          checkId: candidate.backgroundCheckId,
          date: candidate.backgroundCheckDate,
        });
      }
    } catch {
      // API unreachable — return cached status
    }
  }

  return NextResponse.json({
    status: candidate.backgroundCheckStatus,
    checkId: candidate.backgroundCheckId,
    date: candidate.backgroundCheckDate,
  });
}

// PATCH /api/background-check  — manually update status
export async function PATCH(req: NextRequest) {
  const session = await requireApiAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { candidateId, status } = await req.json();

  if (!candidateId || !status) {
    return NextResponse.json({ error: "candidateId and status required" }, { status: 400 });
  }

  if (!["PASSED", "FAILED"].includes(status)) {
    return NextResponse.json({ error: "status must be PASSED or FAILED" }, { status: 400 });
  }

  await db.candidate.update({
    where: { id: candidateId },
    data: { backgroundCheckStatus: status },
  });

  return NextResponse.json({ success: true, status });
}

// Map API status codes to our internal statuses
// A = Awaiting Applicant, P = Pending (processing), C = Complete
function mapApiStatus(apiStatus: string, flagged?: boolean): string {
  switch (apiStatus) {
    case "A":
      return "AWAITING_APPLICANT";
    case "P":
      return "PENDING";
    case "C":
      return flagged ? "FAILED" : "PASSED";
    default:
      return "PENDING";
  }
}
