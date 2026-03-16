import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const BG_CHECK_API_URL = "https://app.backgroundchecks.com/api/v1";
const BG_CHECK_API_KEY = process.env.BACKGROUND_CHECK_API_KEY || "";

// POST /api/background-check  — initiate a background check
export async function POST(req: NextRequest) {
  const { candidateId } = await req.json();

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
    const response = await fetch(`${BG_CHECK_API_URL}/checks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${BG_CHECK_API_KEY}`,
      },
      body: JSON.stringify({
        first_name: candidate.firstName,
        last_name: candidate.lastName,
        email: candidate.email,
        phone: candidate.phone || undefined,
        position: candidate.position?.title || undefined,
        package: "standard",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      // If no API key configured, store as pending anyway (manual mode)
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
        backgroundCheckId: data.id || data.check_id || null,
        backgroundCheckDate: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      checkId: data.id || data.check_id,
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
        `${BG_CHECK_API_URL}/checks/${candidate.backgroundCheckId}`,
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

// PATCH /api/background-check  — manually update status (for when no API key)
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
  if (s === "clear" || s === "passed" || s === "complete") return "PASSED";
  if (s === "failed" || s === "alert" || s === "flagged") return "FAILED";
  if (s === "error") return "ERROR";
  return "PENDING";
}
