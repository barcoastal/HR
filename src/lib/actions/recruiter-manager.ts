"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import type { CandidateStatus } from "@/generated/prisma/client";
import type {
  RecruiterSummary,
  CandidateRow,
  RecruiterManagerData,
} from "@/lib/actions/recruiter-manager-types";

async function requireSuperAdmin() {
  const session = await requireAuth();
  if (session.user?.role !== "SUPER_ADMIN") {
    throw new Error("Forbidden");
  }
  return session;
}

export async function getRecruiterManagerData(): Promise<RecruiterManagerData> {
  await requireSuperAdmin();

  const settings = await db.companySettings.findUnique({ where: { id: "singleton" } });
  let recruiterIds: string[] = [];
  try {
    recruiterIds = JSON.parse(settings?.recruiterIds || "[]");
  } catch {
    recruiterIds = [];
  }

  const recruiterEmps = await db.employee.findMany({
    where: { id: { in: recruiterIds } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      jobTitle: true,
      status: true,
      user: { select: { email: true } },
    },
  });

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  // "Active in pipeline" = still in recruitment, not yet hired/rejected and not
  // yet in onboarding/offboarding (those have their own pages).
  const ACTIVE_STATUSES: CandidateStatus[] = ["NEW", "CONTACTED", "SCREENING", "INTERVIEW", "OFFER", "BACKGROUND_CHECK"];

  const summaries = await Promise.all(
    recruiterEmps.map(async (r) => {
      const [assigned, activePipeline, hired, rejected, hiredThisMonth, appsThisWeek, interviewsThisWeek, latest] =
        await Promise.all([
          db.candidate.count({ where: { recruiterId: r.id } }),
          db.candidate.count({ where: { recruiterId: r.id, inPipeline: true, status: { in: ACTIVE_STATUSES } } }),
          db.candidate.count({ where: { recruiterId: r.id, status: "HIRED" } }),
          db.candidate.count({ where: { recruiterId: r.id, status: "REJECTED" } }),
          db.candidate.count({ where: { recruiterId: r.id, status: "HIRED", hiredAt: { gte: monthAgo } } }),
          db.candidate.count({ where: { recruiterId: r.id, createdAt: { gte: weekAgo } } }),
          db.interview.count({ where: { candidate: { recruiterId: r.id }, scheduledAt: { gte: weekAgo } } }),
          db.candidate.findFirst({
            where: { recruiterId: r.id },
            orderBy: { updatedAt: "desc" },
            select: { updatedAt: true },
          }),
        ]);

      return {
        id: r.id,
        name: `${r.firstName} ${r.lastName}`,
        jobTitle: r.jobTitle,
        status: r.status,
        hasLoginAccount: !!r.user,
        loginEmail: r.user?.email ?? null,
        totals: {
          assigned,
          activePipeline,
          hired,
          rejected,
          interviewsThisWeek,
          appsThisWeek,
          hiredThisMonth,
        },
        lastActivityAt: latest?.updatedAt ?? null,
      } satisfies RecruiterSummary;
    })
  );

  const unassignedCount = await db.candidate.count({ where: { recruiterId: null } });
  const totalCandidates = await db.candidate.count();

  // Sort: most active pipeline first.
  summaries.sort((a, b) => b.totals.activePipeline - a.totals.activePipeline);

  return { recruiters: summaries, unassignedCount, totalCandidates };
}

export async function getRecruiterCandidates(recruiterId: string | null): Promise<CandidateRow[]> {
  await requireSuperAdmin();
  const where = recruiterId === null
    ? { recruiterId: null }
    : { recruiterId };
  const rows = await db.candidate.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      status: true,
      recruiterId: true,
      createdAt: true,
      inPipeline: true,
      position: { select: { title: true } },
    },
    orderBy: [{ inPipeline: "desc" }, { createdAt: "desc" }],
    take: 500,
  });
  return rows.map((r) => ({
    id: r.id,
    firstName: r.firstName,
    lastName: r.lastName,
    email: r.email,
    status: r.status,
    positionTitle: r.position?.title ?? null,
    recruiterId: r.recruiterId,
    createdAt: r.createdAt,
    inPipeline: r.inPipeline,
  }));
}

/**
 * Reassign every candidate owned by `fromRecruiterId` to `toRecruiterId`.
 * Pass fromRecruiterId === null to claim unassigned candidates.
 * Pass toRecruiterId === null to unassign (rare; admin recovery use case).
 */
export async function reassignAllCandidates(
  fromRecruiterId: string | null,
  toRecruiterId: string | null
): Promise<{ moved: number }> {
  await requireSuperAdmin();
  if (fromRecruiterId === toRecruiterId) return { moved: 0 };

  const result = await db.candidate.updateMany({
    where: { recruiterId: fromRecruiterId },
    data: { recruiterId: toRecruiterId },
  });

  await audit({
    action: "recruiter.reassign.bulk",
    from: fromRecruiterId,
    to: toRecruiterId,
    count: result.count,
  });

  revalidatePath("/recruiter-manager");
  revalidatePath("/cv");
  revalidatePath("/my-candidates");
  return { moved: result.count };
}

/**
 * Reassign a hand-picked set of candidate ids to `toRecruiterId`. Use null
 * to leave them unassigned.
 */
export async function reassignSelectedCandidates(
  candidateIds: string[],
  toRecruiterId: string | null
): Promise<{ moved: number }> {
  await requireSuperAdmin();
  if (candidateIds.length === 0) return { moved: 0 };

  const result = await db.candidate.updateMany({
    where: { id: { in: candidateIds } },
    data: { recruiterId: toRecruiterId },
  });

  await audit({
    action: "recruiter.reassign.selected",
    ids: candidateIds,
    to: toRecruiterId,
    count: result.count,
  });

  revalidatePath("/recruiter-manager");
  revalidatePath("/cv");
  revalidatePath("/my-candidates");
  return { moved: result.count };
}

async function audit(details: Record<string, unknown>) {
  try {
    const { audit: writeAudit } = await import("@/lib/audit");
    await writeAudit({
      action: String(details.action),
      entityType: "recruiter",
      entityId: String(details.from ?? details.to ?? "n/a"),
      details,
    });
  } catch (err) {
    console.error("[recruiter-manager] audit failed:", err);
  }
}
