import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

/**
 * One-shot diagnostic: shows what each configured recruiter would see in /cv.
 * Gated to SUPER_ADMIN. Will be deleted once visibility scoping is verified.
 *
 * GET /api/diagnostics/recruiter-scope
 */
export async function GET() {
  const session = await requireApiAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const settings = await db.companySettings.findUnique({ where: { id: "singleton" } });
  let recruiterIds: string[] = [];
  try {
    recruiterIds = JSON.parse(settings?.recruiterIds || "[]");
  } catch {
    recruiterIds = [];
  }

  const recruiters = await db.employee.findMany({
    where: { id: { in: recruiterIds } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      jobTitle: true,
      status: true,
      user: { select: { id: true, email: true } },
    },
  });

  const totalCandidates = await db.candidate.count();

  const breakdown = await Promise.all(
    recruiters.map(async (r) => {
      const assignedCount = await db.candidate.count({ where: { recruiterId: r.id } });
      const sampleAssigned = await db.candidate.findMany({
        where: { recruiterId: r.id },
        select: { id: true, firstName: true, lastName: true, status: true, createdAt: true },
        take: 5,
        orderBy: { createdAt: "desc" },
      });
      const sampleNotAssigned = await db.candidate.findMany({
        where: {
          OR: [
            { recruiterId: null },
            { recruiterId: { not: r.id } },
          ],
        },
        select: { id: true, firstName: true, lastName: true, recruiterId: true, status: true },
        take: 3,
        orderBy: { createdAt: "desc" },
      });
      return {
        recruiter: {
          id: r.id,
          name: `${r.firstName} ${r.lastName}`,
          jobTitle: r.jobTitle,
          status: r.status,
          hasLoginAccount: !!r.user,
          loginEmail: r.user?.email ?? null,
        },
        wouldSeeInRecruitment: assignedCount,
        sampleAssigned: sampleAssigned.map((c) => `${c.firstName} ${c.lastName} (${c.status})`),
        sampleHiddenFromThem: sampleNotAssigned.map((c) => `${c.firstName} ${c.lastName} (recruiterId=${c.recruiterId ?? "null"})`),
      };
    })
  );

  const orphanCount = await db.candidate.count({ where: { recruiterId: null } });

  return NextResponse.json(
    {
      summary: {
        totalCandidates,
        candidatesWithNoRecruiter: orphanCount,
        configuredRecruiterCount: recruiters.length,
        adminViewSees: totalCandidates,
      },
      perRecruiter: breakdown,
      note:
        "If everything is wired correctly: each recruiter's wouldSeeInRecruitment should match what they actually see in /cv after logging in. Admins/HR/SUPER_ADMIN keep seeing the totalCandidates value.",
    },
    { status: 200 }
  );
}
