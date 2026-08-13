import { NextResponse } from "next/server";
import type { Prisma, UserRole } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireApiAuth, getRecruiterScope } from "@/lib/auth-helpers";
import { canAccessRecruitment } from "@/lib/permissions";
import { canSeeAudiencePost } from "@/lib/event-audience";
import { displayName } from "@/lib/utils";

type SearchResultKind = "employee" | "document" | "candidate" | "position" | "update";

export type GlobalSearchResult = {
  id: string;
  kind: SearchResultKind;
  title: string;
  subtitle: string;
  detail?: string;
  status?: string;
  href: string;
  newTab?: boolean;
};

const EMPLOYEE_STATUSES = ["PENDING", "ACTIVE", "PRE_ONBOARDING", "ONBOARDING", "OFFBOARDED"] as const;
const CANDIDATE_STATUSES = ["NEW", "CONTACTED", "SCREENING", "INTERVIEW", "OFFER", "BACKGROUND_CHECK", "PRE_ONBOARDING", "ONBOARDING", "OFFBOARDING", "HIRED", "REJECTED"] as const;
const POSITION_STATUSES = ["OPEN", "CLOSED", "FILLED"] as const;

function readableStatus(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function matchingStatuses<T extends string>(values: readonly T[], token: string): T[] {
  const normalized = token.toLowerCase().replace(/[\s_-]+/g, "");
  return values.filter((value) => value.toLowerCase().replaceAll("_", "").includes(normalized));
}

function textCondition(token: string) {
  return { contains: token, mode: "insensitive" as const };
}

function employeeTokenFilter(token: string): Prisma.EmployeeWhereInput {
  const statuses = matchingStatuses(EMPLOYEE_STATUSES, token);
  return {
    OR: [
      { firstName: textCondition(token) },
      { middleName: textCondition(token) },
      { preferredName: textCondition(token) },
      { lastName: textCondition(token) },
      { email: textCondition(token) },
      { phone: textCondition(token) },
      { jobTitle: textCondition(token) },
      { location: textCondition(token) },
      { department: { name: textCondition(token) } },
      ...(statuses.length ? [{ status: { in: statuses } }] : []),
    ],
  };
}

function candidateTokenFilter(token: string): Prisma.CandidateWhereInput {
  const statuses = matchingStatuses(CANDIDATE_STATUSES, token);
  return {
    OR: [
      { firstName: textCondition(token) },
      { lastName: textCondition(token) },
      { email: textCondition(token) },
      { phone: textCondition(token) },
      { jobAppliedTo: textCondition(token) },
      { source: textCondition(token) },
      { skills: textCondition(token) },
      { position: { title: textCondition(token) } },
      ...(statuses.length ? [{ status: { in: statuses } }] : []),
    ],
  };
}

function positionTokenFilter(token: string): Prisma.PositionWhereInput {
  const statuses = matchingStatuses(POSITION_STATUSES, token);
  return {
    OR: [
      { title: textCondition(token) },
      { description: textCondition(token) },
      { location: textCondition(token) },
      { type: textCondition(token) },
      { department: { name: textCondition(token) } },
      ...(statuses.length ? [{ status: { in: statuses } }] : []),
    ],
  };
}

export async function GET(request: Request) {
  const session = await requireApiAuth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawQuery = new URL(request.url).searchParams.get("q")?.trim() || "";
  if (rawQuery.length < 2) {
    return NextResponse.json({ results: [] satisfies GlobalSearchResult[] });
  }

  const query = rawQuery.slice(0, 100);
  const tokens = query.split(/\s+/).filter(Boolean).slice(0, 6);
  const role = session.user.role as UserRole;
  const employeeId = session.user.employeeId;
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN" || role === "HR";
  const isManager = role === "MANAGER";

  const viewerEmployee = employeeId
    ? await db.employee.findUnique({
        where: { id: employeeId },
        select: { departmentId: true },
      })
    : null;

  // Match the profile-page permission boundary: admin/HR may open any profile,
  // managers may open themselves and direct reports, employees only themselves.
  const employeeScope: Prisma.EmployeeWhereInput = isAdmin
    ? {}
    : isManager && employeeId
      ? { OR: [{ id: employeeId }, { managerId: employeeId }] }
      : { id: employeeId || "__none__" };

  const canSearchRecruitment = canAccessRecruitment(role);
  const recruiterScope = canSearchRecruitment ? await getRecruiterScope() : null;

  try {
    const [employees, storedDocuments, signingRequests, candidates, positions, possibleUpdates] = await Promise.all([
      db.employee.findMany({
        where: {
          AND: [employeeScope, { archivedAt: null }, ...tokens.map(employeeTokenFilter)],
        },
        select: {
          id: true,
          firstName: true,
          preferredName: true,
          lastName: true,
          email: true,
          phone: true,
          jobTitle: true,
          status: true,
          department: { select: { name: true } },
        },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
        take: 6,
      }),
      db.document.findMany({
        where: {
          employee: employeeScope,
          ...(!isAdmin ? { visibility: "EVERYONE" as const } : {}),
          AND: tokens.map((token) => ({
            OR: [
              { name: textCondition(token) },
              { employee: employeeTokenFilter(token) },
              ...(["onboarding", "offboarding", "review", "general"]
                .filter((category) => category.includes(token.toLowerCase()))
                .map((category) => ({ category: category.toUpperCase() as "ONBOARDING" | "OFFBOARDING" | "REVIEW" | "GENERAL" }))),
            ],
          })),
        },
        select: {
          id: true,
          name: true,
          url: true,
          category: true,
          employeeId: true,
          employee: { select: { firstName: true, preferredName: true, lastName: true } },
        },
        orderBy: { uploadedAt: "desc" },
        take: 5,
      }),
      db.signingRequest.findMany({
        where: {
          employee: employeeScope,
          AND: tokens.map((token) => ({
            OR: [
              { documentName: textCondition(token) },
              { signerName: textCondition(token) },
              { signerEmail: textCondition(token) },
              { status: textCondition(token) },
              { employee: employeeTokenFilter(token) },
            ],
          })),
        },
        select: {
          id: true,
          documentName: true,
          status: true,
          employeeId: true,
          employee: { select: { firstName: true, preferredName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      canSearchRecruitment
        ? db.candidate.findMany({
            where: {
              ...(recruiterScope ? { recruiterId: recruiterScope } : {}),
              AND: tokens.map(candidateTokenFilter),
            },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              status: true,
              position: { select: { title: true } },
            },
            orderBy: { updatedAt: "desc" },
            take: 5,
          })
        : Promise.resolve([]),
      canSearchRecruitment
        ? db.position.findMany({
            where: { AND: tokens.map(positionTokenFilter) },
            select: {
              id: true,
              title: true,
              location: true,
              type: true,
              status: true,
              department: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 5,
          })
        : Promise.resolve([]),
      db.feedPost.findMany({
        where: {
          AND: tokens.map((token) => ({
            OR: [
              { content: textCondition(token) },
              { eventDescription: textCondition(token) },
              { eventLocation: textCondition(token) },
              { author: { firstName: textCondition(token) } },
              { author: { preferredName: textCondition(token) } },
              { author: { lastName: textCondition(token) } },
            ],
          })),
        },
        select: {
          id: true,
          content: true,
          type: true,
          createdAt: true,
          audienceType: true,
          audienceDeptIds: true,
          audienceEmployeeIds: true,
          authorId: true,
          author: { select: { firstName: true, preferredName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    const results: GlobalSearchResult[] = [];

    results.push(
      ...employees.map((employee) => ({
        id: `employee-${employee.id}`,
        kind: "employee" as const,
        title: displayName(employee),
        subtitle: [employee.jobTitle, employee.department?.name].filter(Boolean).join(" · ") || "Employee",
        detail: [employee.email, employee.phone].filter(Boolean).join(" · "),
        status: readableStatus(employee.status),
        href: employee.id === employeeId ? "/my-profile" : `/people/${employee.id}`,
      }))
    );

    results.push(
      ...storedDocuments.map((document) => ({
        id: `document-${document.id}`,
        kind: "document" as const,
        title: document.name,
        subtitle: displayName(document.employee),
        detail: readableStatus(document.category),
        status: "On File",
        href: document.url,
        newTab: true,
      })),
      ...signingRequests.map((document) => ({
        id: `signing-${document.id}`,
        kind: "document" as const,
        title: document.documentName,
        subtitle: document.employee ? displayName(document.employee) : "Document request",
        detail: "Signature document",
        status: readableStatus(document.status),
        href: document.employeeId === employeeId ? "/my-documents" : "/documents",
      }))
    );

    results.push(
      ...candidates.map((candidate) => ({
        id: `candidate-${candidate.id}`,
        kind: "candidate" as const,
        title: `${candidate.firstName} ${candidate.lastName}`,
        subtitle: candidate.position?.title || "Candidate",
        detail: [candidate.email, candidate.phone].filter(Boolean).join(" · "),
        status: readableStatus(candidate.status),
        href: recruiterScope ? "/my-candidates" : "/cv",
      })),
      ...positions.map((position) => ({
        id: `position-${position.id}`,
        kind: "position" as const,
        title: position.title,
        subtitle: [position.department?.name, position.location].filter(Boolean).join(" · ") || "Position",
        detail: position.type || undefined,
        status: readableStatus(position.status),
        href: "/cv",
      }))
    );

    const visibleUpdates = possibleUpdates
      .filter((post) =>
        canSeeAudiencePost(post, {
          employeeId,
          departmentId: viewerEmployee?.departmentId,
          role,
        })
      )
      .slice(0, 5);

    results.push(
      ...visibleUpdates.map((post) => ({
        id: `update-${post.id}`,
        kind: "update" as const,
        title: post.content.length > 90 ? `${post.content.slice(0, 87)}...` : post.content,
        subtitle: displayName(post.author),
        detail: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(post.createdAt),
        status: readableStatus(post.type),
        href: `/#post-${post.id}`,
      }))
    );

    return NextResponse.json(
      { results },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("[global-search] Search failed:", error);
    return NextResponse.json({ error: "Search is temporarily unavailable" }, { status: 500 });
  }
}
