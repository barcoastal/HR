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
      bankruptcy?: "Y" | "N";
      civil_judgment?: "Y" | "N";
      tax_lien?: "Y" | "N";
      credit_report?: "Y" | "N";
    };
  };

  if (!candidateId) {
    return NextResponse.json({ error: "candidateId is required" }, { status: 400 });
  }

  if (!BG_CHECK_API_KEY) {
    console.error("[background-check] BACKGROUND_CHECK_API_KEY is not set on the server");
    return NextResponse.json(
      { error: "Background check is not configured on the server (missing API key)" },
      { status: 500 }
    );
  }

  const candidate = await db.candidate.findUnique({
    where: { id: candidateId },
    include: { position: true },
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  if (!candidate.email) {
    return NextResponse.json(
      { error: "Candidate has no email on file — cannot send background check" },
      { status: 400 }
    );
  }

  const drugTest = options?.drug_test || "N";
  const payload: Record<string, unknown> = {
    report_sku: options?.report_sku || "HIRE1",
    order_quantity: 1,
    applicant_emails: [candidate.email],
    drug_test: drugTest,
    mvr: options?.mvr || "N",
    employment: options?.employment || "Y",
    education: options?.education || "Y",
    blj: options?.blj || "Y",
    federal_criminal: options?.federal_criminal || "Y",
    bankruptcy: options?.bankruptcy || "N",
    civil_judgment: options?.civil_judgment || "N",
    tax_lien: options?.tax_lien || "N",
    credit_report: options?.credit_report || "N",
    terms_agree: "Y",
  };
  // drug_sku is only valid when drug_test is requested
  if (drugTest === "Y") {
    payload.drug_sku = options?.drug_sku || "drug";
  }

  console.log(`[background-check] submitting order for ${candidate.email} (${candidateId})`);

  let response: Response;
  try {
    response = await fetch(apiUrl("/orders/new"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      redirect: "manual",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[background-check] fetch to backgroundchecks.com failed:", msg);
    return NextResponse.json(
      { error: "Could not reach backgroundchecks.com", details: msg },
      { status: 502 }
    );
  }

  // backgroundchecks.com responds to an invalid/expired api_token by redirecting
  // to /login (302) instead of returning 401. Catch that explicitly.
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location") || "";
    console.error(
      `[background-check] backgroundchecks.com redirected ${response.status} → ${location}`
    );
    if (location.includes("/login")) {
      return NextResponse.json(
        {
          error: "Background check API token was rejected",
          details:
            "backgroundchecks.com redirected the request to its login page. The BACKGROUND_CHECK_API_KEY on the server is likely expired or invalid. Regenerate it at app.backgroundchecks.com and update Railway.",
        },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: `Unexpected redirect from backgroundchecks.com`, details: location },
      { status: 502 }
    );
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error(
      `[background-check] backgroundchecks.com returned ${response.status}: ${errorText}`
    );
    return NextResponse.json(
      {
        error: `Background check API returned ${response.status}`,
        details: errorText || response.statusText,
      },
      { status: 502 }
    );
  }

  const rawBody = await response.text();
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("json")) {
    console.error(
      `[background-check] expected JSON but got ${contentType}: ${rawBody.slice(0, 500)}`
    );
    return NextResponse.json(
      {
        error: "Background check API returned non-JSON response",
        details: `Content-Type: ${contentType}. First 300 chars: ${rawBody.slice(0, 300)}`,
      },
      { status: 502 }
    );
  }

  let data: { applicants?: Array<{ report_key?: string; applicant_invite_url?: string }> };
  try {
    data = JSON.parse(rawBody);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(
      `[background-check] invalid JSON from backgroundchecks.com: ${msg}. Body: ${rawBody.slice(0, 500)}`
    );
    return NextResponse.json(
      { error: "Invalid response from backgroundchecks.com", details: msg },
      { status: 502 }
    );
  }

  const reportKey = data.applicants?.[0]?.report_key || null;
  const inviteUrl = data.applicants?.[0]?.applicant_invite_url || null;

  if (!reportKey) {
    console.error(
      "[background-check] backgroundchecks.com response missing report_key:",
      JSON.stringify(data)
    );
    return NextResponse.json(
      { error: "Background check service did not return an order ID", details: data },
      { status: 502 }
    );
  }

  await db.candidate.update({
    where: { id: candidateId },
    data: {
      status: "BACKGROUND_CHECK",
      backgroundCheckStatus: "AWAITING_APPLICANT",
      backgroundCheckId: reportKey,
      backgroundCheckDate: new Date(),
      backgroundCheckOptions: JSON.stringify(options || {}),
    },
  });

  console.log(
    `[background-check] order created for ${candidate.email}: report_key=${reportKey}`
  );

  return NextResponse.json({
    success: true,
    reportKey,
    inviteUrl,
    status: "AWAITING_APPLICANT",
  });
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
        { method: "GET", headers: { Accept: "application/json" }, redirect: "manual" }
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
          if (newStatus === "FAILED") {
            try {
              const { sendAdverseActionLetter } = await import("@/lib/actions/adverse-action");
              await sendAdverseActionLetter(candidateId, "information revealed by your background report");
            } catch (e) {
              console.error("[background-check] adverse action send failed:", e);
            }
          }
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

  if (status === "FAILED") {
    try {
      const { sendAdverseActionLetter } = await import("@/lib/actions/adverse-action");
      await sendAdverseActionLetter(candidateId, "information revealed by your background report");
    } catch (e) {
      console.error("[background-check] adverse action send failed:", e);
    }
  }

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
