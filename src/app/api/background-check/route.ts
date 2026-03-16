import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const BG_CHECK_API_URL = "https://app.backgroundchecks.com";
const BG_CHECK_API_KEY = process.env.BACKGROUND_CHECK_API_KEY || "";

// POST /api/background-check  — initiate a background check order
export async function POST(req: NextRequest) {
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
      order_quantity: "1",
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

    const response = await fetch(`${BG_CHECK_API_URL}/orders/new`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${BG_CHECK_API_KEY}`,
      },
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

    const data = await response.json();

    await db.candidate.update({
      where: { id: candidateId },
      data: {
        status: "BACKGROUND_CHECK",
        backgroundCheckStatus: "PENDING",
        backgroundCheckId: data.applicants?.[0]?.id || data.id || null,
        backgroundCheckDate: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      checkId: data.applicants?.[0]?.id || data.id,
      status: "PENDING",
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

// GET /api/background-check?candidateId=xxx  — check status
export async function GET(req: NextRequest) {
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

  // If we have an external check ID, try to fetch latest status
  if (candidate.backgroundCheckId && BG_CHECK_API_KEY) {
    try {
      const response = await fetch(
        `${BG_CHECK_API_URL}/orders/${candidate.backgroundCheckId}`,
        {
          headers: { Authorization: `Bearer ${BG_CHECK_API_KEY}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        const newStatus = mapExternalStatus(data.status);

        if (newStatus !== candidate.backgroundCheckStatus) {
          await db.candidate.update({
            where: { id: candidateId },
            data: { backgroundCheckStatus: newStatus },
          });
          return NextResponse.json({ status: newStatus, externalStatus: data.status });
        }
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

function mapExternalStatus(externalStatus: string): string {
  const s = externalStatus?.toLowerCase();
  if (s === "clear" || s === "passed" || s === "complete" || s === "completed") return "PASSED";
  if (s === "failed" || s === "alert" || s === "flagged") return "FAILED";
  if (s === "error") return "ERROR";
  return "PENDING";
}
