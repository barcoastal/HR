/**
 * Server-side loaders for the export tool. One Prisma query per entity
 * (plus a recruiter lookup for candidates, whose `recruiterId` has no
 * relation), flattened to plain rows keyed by the registry's column keys.
 *
 * Value conventions: names "First Last"; dates "YYYY-MM-DD"; datetimes ISO
 * 8601; numbers stay numbers; missing values are `null` so the CSV/XLSX
 * writers render an empty cell.
 *
 * Employees go through the default `db` client, which hides archived rows,
 * so People exports (and the recruiter lookup) are active employees only.
 */

import type {
  CandidateStatus,
  EmployeeStatus,
  InterviewStatus,
  Prisma,
  ReviewStatus,
  TimeOffRequestStatus,
} from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { sanitizeExportFilters, type ExportEntityKey } from "./export-registry";

export type ExportRow = Record<string, string | number | null>;

type Filters = Record<string, string>;

type EntityLoader = {
  count: (filters: Filters) => Promise<number>;
  load: (filters: Filters) => Promise<ExportRow[]>;
};

// ---------- value helpers ----------

function date(d: Date | null | undefined): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function dateTime(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

function text(s: string | null | undefined): string | null {
  return s == null ? null : s;
}

function num(n: number | null | undefined): number | null {
  return n == null ? null : n;
}

function fullName(p: { firstName: string; lastName: string } | null | undefined): string | null {
  return p ? `${p.firstName} ${p.lastName}`.trim() : null;
}

/**
 * `${key}From` / `${key}To` (already validated as YYYY-MM-DD) → a Prisma
 * date filter. `To` is inclusive of the whole day so datetimes on that
 * date match.
 */
function dateRange(filters: Filters, key: string): { gte?: Date; lte?: Date } | undefined {
  const from = filters[`${key}From`];
  const to = filters[`${key}To`];
  if (!from && !to) return undefined;
  const range: { gte?: Date; lte?: Date } = {};
  if (from) range.gte = new Date(`${from}T00:00:00.000Z`);
  if (to) range.lte = new Date(`${to}T23:59:59.999Z`);
  return range;
}

// ---------- people ----------

function peopleWhere(f: Filters): Prisma.EmployeeWhereInput {
  return {
    status: (f.status as EmployeeStatus | undefined) ?? undefined,
    departmentId: f.department || undefined,
  };
}

const people: EntityLoader = {
  count: (f) => db.employee.count({ where: peopleWhere(f) }),
  load: async (f) => {
    const rows = await db.employee.findMany({
      where: peopleWhere(f),
      include: {
        department: { select: { name: true } },
        team: { select: { name: true } },
        manager: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    return rows.map((e) => ({
      firstName: e.firstName,
      lastName: e.lastName,
      preferredName: text(e.preferredName),
      pronouns: text(e.pronouns),
      email: e.email,
      personalEmail: text(e.personalEmail),
      phone: text(e.phone),
      jobTitle: e.jobTitle,
      department: e.department?.name ?? null,
      team: e.team?.name ?? null,
      manager: fullName(e.manager),
      status: e.status,
      startDate: date(e.startDate),
      endDate: date(e.endDate),
      birthday: date(e.birthday),
      location: text(e.location),
      address: text(e.address),
      city: text(e.city),
      state: text(e.state),
      zipCode: text(e.zipCode),
      country: text(e.country),
      emergencyContactName: text(e.emergencyContactName),
      emergencyContactPhone: text(e.emergencyContactPhone),
      emergencyContactRelation: text(e.emergencyContactRelation),
      tShirtSize: text(e.tShirtSize),
      createdAt: dateTime(e.createdAt),
    }));
  },
};

// ---------- candidates ----------

function candidatesWhere(f: Filters): Prisma.CandidateWhereInput {
  return {
    status: (f.status as CandidateStatus | undefined) ?? undefined,
    positionId: f.position || undefined,
    appliedAt: dateRange(f, "applied"),
  };
}

const candidates: EntityLoader = {
  count: (f) => db.candidate.count({ where: candidatesWhere(f) }),
  load: async (f) => {
    const rows = await db.candidate.findMany({
      where: candidatesWhere(f),
      include: {
        position: { select: { title: true } },
        manager: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    // recruiterId is a bare id (no relation) — resolve names in one query.
    const recruiterIds = [...new Set(rows.map((c) => c.recruiterId).filter((id): id is string => !!id))];
    const recruiters = recruiterIds.length
      ? await db.employee.findMany({ where: { id: { in: recruiterIds } }, select: { id: true, firstName: true, lastName: true } })
      : [];
    const recruiterName = new Map(recruiters.map((r) => [r.id, fullName(r)]));
    return rows.map((c) => ({
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: text(c.phone),
      status: c.status,
      position: c.position?.title ?? null,
      source: text(c.source),
      recruiter: c.recruiterId ? (recruiterName.get(c.recruiterId) ?? null) : null,
      manager: fullName(c.manager),
      appliedAt: date(c.appliedAt),
      hiredAt: date(c.hiredAt),
      backgroundCheckStatus: text(c.backgroundCheckStatus),
      backgroundCheckDate: date(c.backgroundCheckDate),
      hourlyRate: num(c.hourlyRate),
      linkedinUrl: text(c.linkedinUrl),
    }));
  },
};

// ---------- departments ----------

const departments: EntityLoader = {
  count: () => db.department.count(),
  load: async () => {
    const rows = await db.department.findMany({
      include: {
        head: { select: { firstName: true, lastName: true } },
        parentDepartment: { select: { name: true } },
        _count: { select: { employees: { where: { archivedAt: null } } } },
      },
      orderBy: { name: "asc" },
    });
    return rows.map((d) => ({
      name: d.name,
      description: text(d.description),
      head: fullName(d.head),
      parentDepartment: d.parentDepartment?.name ?? null,
      memberCount: d._count.employees,
      createdAt: dateTime(d.createdAt),
    }));
  },
};

// ---------- time off ----------

function timeOffWhere(f: Filters): Prisma.TimeOffRequestWhereInput {
  return {
    status: (f.status as TimeOffRequestStatus | undefined) ?? undefined,
    startDate: dateRange(f, "start"),
  };
}

const timeOff: EntityLoader = {
  count: (f) => db.timeOffRequest.count({ where: timeOffWhere(f) }),
  load: async (f) => {
    const rows = await db.timeOffRequest.findMany({
      where: timeOffWhere(f),
      include: {
        employee: { select: { firstName: true, lastName: true } },
        policy: { select: { name: true } },
        approver: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    });
    return rows.map((r) => ({
      employee: fullName(r.employee),
      policy: r.policy.name,
      startDate: date(r.startDate),
      endDate: date(r.endDate),
      daysCount: r.daysCount,
      status: r.status,
      approver: fullName(r.approver),
      reason: text(r.reason),
      createdAt: dateTime(r.createdAt),
    }));
  },
};

// ---------- reviews ----------

function reviewsWhere(f: Filters): Prisma.ReviewWhereInput {
  const range = dateRange(f, "cycle");
  return {
    status: (f.status as ReviewStatus | undefined) ?? undefined,
    // "Cycle dates" matches reviews whose cycle overlaps the range at any point.
    cycle: range
      ? {
          ...(range.lte ? { startDate: { lte: range.lte } } : {}),
          ...(range.gte ? { endDate: { gte: range.gte } } : {}),
        }
      : undefined,
  };
}

const reviews: EntityLoader = {
  count: (f) => db.review.count({ where: reviewsWhere(f) }),
  load: async (f) => {
    const rows = await db.review.findMany({
      where: reviewsWhere(f),
      include: {
        employee: { select: { firstName: true, lastName: true } },
        reviewer: { select: { firstName: true, lastName: true } },
        cycle: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => ({
      employee: fullName(r.employee),
      reviewer: fullName(r.reviewer),
      cycle: r.cycle.name,
      type: r.type,
      status: r.status,
      rating: num(r.rating),
      createdAt: dateTime(r.createdAt),
    }));
  },
};

// ---------- interviews ----------

function interviewsWhere(f: Filters): Prisma.InterviewWhereInput {
  return {
    status: (f.status as InterviewStatus | undefined) ?? undefined,
    scheduledAt: dateRange(f, "scheduled"),
  };
}

const interviews: EntityLoader = {
  count: (f) => db.interview.count({ where: interviewsWhere(f) }),
  load: async (f) => {
    const rows = await db.interview.findMany({
      where: interviewsWhere(f),
      include: {
        candidate: { select: { firstName: true, lastName: true } },
        position: { select: { title: true } },
        interviewer: { select: { firstName: true, lastName: true } },
      },
      orderBy: { scheduledAt: "desc" },
    });
    return rows.map((i) => ({
      candidate: fullName(i.candidate),
      position: i.position?.title ?? null,
      interviewer: fullName(i.interviewer),
      scheduledAt: dateTime(i.scheduledAt),
      duration: i.duration,
      type: i.type,
      status: i.status,
      meetLink: text(i.googleMeetLink),
      createdAt: dateTime(i.createdAt),
    }));
  },
};

const LOADERS: Record<ExportEntityKey, EntityLoader> = { people, candidates, departments, timeOff, reviews, interviews };

/** Rows for `entity` matching `filters` (unknown/invalid filters are ignored). Every row has every registry column key. */
export async function loadExportRows(entity: ExportEntityKey, filters: Record<string, string>): Promise<ExportRow[]> {
  return LOADERS[entity].load(sanitizeExportFilters(entity, filters));
}

/** How many rows `loadExportRows` would return — same `where`, no includes. */
export async function countExportRows(entity: ExportEntityKey, filters: Record<string, string>): Promise<number> {
  return LOADERS[entity].count(sanitizeExportFilters(entity, filters));
}
