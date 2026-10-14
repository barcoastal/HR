"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { requireAuth, getRecruiterScope } from "@/lib/auth-helpers";
import { canAccessRecruitment } from "@/lib/permissions";
import { getPipelineStages } from "@/lib/actions/company-settings";
import { LEGACY_STAGE_ID_BY_STATUS } from "@/lib/pipeline-stage-utils";
import { dateKey } from "@/lib/time-zone";
import { displayName } from "@/lib/utils";
import {
  countByColor,
  isClassColor,
  isPastClass,
  isValidDateKey,
  sortMembers,
  stageLabelFor,
  type ClassColor,
  type ClassStatus,
} from "@/lib/recruitment-classes/logic";
import type {
  CandidateClassesPayload,
  CandidatePickerOption,
  ClassDetail,
  ClassPermissions,
  ClassSummary,
} from "@/lib/recruitment-classes/types";
import type { UserRole } from "@/generated/prisma/client";

type Viewer = {
  userId: string | null;
  role: UserRole;
  /** Employee id a recruiter is scoped to, or null for unrestricted viewers. */
  scope: string | null;
  canManage: boolean;
};

const CLASS_STATUSES: ClassStatus[] = ["UPCOMING", "STARTED", "CANCELLED"];

function canManageClassesRole(role: UserRole) {
  return role === "SUPER_ADMIN" || role === "ADMIN" || role === "HR";
}

/** Anyone who can open Recruitment can view classes (same check as the sidebar). */
async function requireClassViewer(): Promise<Viewer> {
  const session = await requireAuth();
  const role = (session.user?.role || "EMPLOYEE") as UserRole;
  if (!canAccessRecruitment(role)) throw new Error("Forbidden");
  const scope = await getRecruiterScope();
  return { userId: session.user?.id ?? null, role, scope, canManage: canManageClassesRole(role) };
}

async function requireClassManager(): Promise<Viewer> {
  const viewer = await requireClassViewer();
  if (!viewer.canManage) throw new Error("Only admins and HR can create, edit or delete classes.");
  return viewer;
}

function permissionsFor(viewer: Viewer): ClassPermissions {
  return { canManage: viewer.canManage, canEditMembers: viewer.canManage || !!viewer.scope };
}

/** Whether the viewer may add/edit/remove this candidate's membership. */
function canEditCandidate(viewer: Viewer, recruiterId: string | null) {
  if (viewer.canManage) return true;
  return !!viewer.scope && recruiterId === viewer.scope;
}

function toDateKey(d: Date): string {
  // startDate is a DATE column, returned as UTC midnight.
  return d.toISOString().slice(0, 10);
}

function todayKey() {
  return dateKey(new Date());
}

function revalidateClasses(classId?: string) {
  revalidatePath("/classes");
  if (classId) revalidatePath(`/classes/${classId}`);
  revalidatePath("/cv");
}

function defaultClassName(role: string, startDate: string) {
  const d = new Date(`${startDate}T00:00:00Z`);
  const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${role} – ${label}`;
}

async function recruiterNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (unique.length === 0) return new Map();
  const rows = await db.employee.findMany({
    where: { id: { in: unique } },
    select: { id: true, firstName: true, lastName: true, preferredName: true },
  });
  return new Map(rows.map((r) => [r.id, displayName(r)]));
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export async function getClassPermissions(): Promise<ClassPermissions> {
  return permissionsFor(await requireClassViewer());
}

export async function listRecruitmentClasses(): Promise<ClassSummary[]> {
  await requireClassViewer();
  const classes = await db.recruitmentClass.findMany({
    include: {
      position: { select: { title: true } },
      members: { select: { color: true } },
    },
    orderBy: { startDate: "asc" },
  });
  return classes.map((c) => ({
    id: c.id,
    name: c.name,
    role: c.role,
    positionId: c.positionId,
    positionTitle: c.position?.title ?? null,
    startDate: toDateKey(c.startDate),
    targetCount: c.targetCount,
    notes: c.notes,
    status: c.status,
    counts: countByColor(c.members),
  }));
}

export async function getRecruitmentClass(id: string): Promise<ClassDetail | null> {
  const viewer = await requireClassViewer();
  const c = await db.recruitmentClass.findUnique({
    where: { id },
    include: {
      position: { select: { title: true } },
      members: {
        include: {
          candidate: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              status: true,
              stageId: true,
              recruiterId: true,
              doNotCall: true,
            },
          },
        },
      },
    },
  });
  if (!c) return null;

  // Aggregate counts cover the whole class; a scoped recruiter only sees the
  // rows (and contact details) of candidates assigned to them.
  const counts = countByColor(c.members);
  const visible = viewer.scope ? c.members.filter((m) => m.candidate.recruiterId === viewer.scope) : c.members;
  const [stages, names] = await Promise.all([
    getPipelineStages(),
    recruiterNames(visible.map((m) => m.candidate.recruiterId)),
  ]);

  const members = sortMembers(
    visible.map((m) => ({
      id: m.id,
      candidateId: m.candidate.id,
      name: `${m.candidate.firstName} ${m.candidate.lastName}`.trim(),
      email: m.candidate.email,
      phone: m.candidate.phone,
      stage: stageLabelFor(m.candidate, stages, LEGACY_STAGE_ID_BY_STATUS),
      recruiter: m.candidate.recruiterId ? names.get(m.candidate.recruiterId) ?? null : null,
      doNotCall: m.candidate.doNotCall,
      color: m.color as ClassColor,
      note: m.note,
      canEdit: canEditCandidate(viewer, m.candidate.recruiterId),
    })),
  );

  return {
    id: c.id,
    name: c.name,
    role: c.role,
    positionId: c.positionId,
    positionTitle: c.position?.title ?? null,
    startDate: toDateKey(c.startDate),
    targetCount: c.targetCount,
    notes: c.notes,
    status: c.status,
    counts,
    members,
    totalMembers: c.members.length,
    scoped: !!viewer.scope,
  };
}

/** Positions offered when linking a class to a job opening. */
export async function getClassPositionOptions(): Promise<{ id: string; title: string; status: string }[]> {
  await requireClassViewer();
  const rows = await db.position.findMany({
    select: { id: true, title: true, status: true },
    orderBy: [{ status: "asc" }, { title: "asc" }],
  });
  return rows;
}

/** Candidate search for the "Add candidates" picker. Respects recruiter scoping. */
export async function searchCandidatesForClass(classId: string, query: string): Promise<CandidatePickerOption[]> {
  const viewer = await requireClassViewer();
  if (!permissionsFor(viewer).canEditMembers) return [];
  const q = query.trim();
  if (q.length < 2) return [];

  const terms = q.split(/\s+/).slice(0, 3);
  const nameMatch = (t: string) => [
    { firstName: { contains: t, mode: "insensitive" as const } },
    { lastName: { contains: t, mode: "insensitive" as const } },
    { email: { contains: t, mode: "insensitive" as const } },
    { phone: { contains: t } },
  ];

  const rows = await db.candidate.findMany({
    where: {
      AND: [
        ...terms.map((t) => ({ OR: nameMatch(t) })),
        ...(viewer.scope ? [{ recruiterId: viewer.scope }] : []),
        { classMemberships: { none: { classId } } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      status: true,
      stageId: true,
      position: { select: { title: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });
  const stages = await getPipelineStages();
  return rows.map((r) => ({
    id: r.id,
    name: `${r.firstName} ${r.lastName}`.trim(),
    email: r.email,
    stage: stageLabelFor(r, stages, LEGACY_STAGE_ID_BY_STATUS),
    positionTitle: r.position?.title ?? null,
  }));
}

/** Classes a candidate belongs to, plus the classes they could be added to. */
export async function getCandidateClasses(candidateId: string): Promise<CandidateClassesPayload> {
  const viewer = await requireClassViewer();
  const candidate = await db.candidate.findUnique({ where: { id: candidateId }, select: { recruiterId: true } });
  if (!candidate) return { memberships: [], options: [], canAdd: false, canEdit: false };
  if (viewer.scope && candidate.recruiterId !== viewer.scope) throw new Error("Forbidden");

  const canEdit = canEditCandidate(viewer, candidate.recruiterId);
  const [memberships, classes] = await Promise.all([
    db.recruitmentClassMember.findMany({
      where: { candidateId },
      include: { class: { select: { id: true, name: true, role: true, startDate: true, status: true } } },
    }),
    canEdit
      ? db.recruitmentClass.findMany({
          where: { status: "UPCOMING", members: { none: { candidateId } } },
          select: { id: true, name: true, startDate: true, status: true },
          orderBy: { startDate: "asc" },
        })
      : Promise.resolve([]),
  ]);
  const today = todayKey();
  return {
    memberships: memberships
      .map((m) => ({
        memberId: m.id,
        classId: m.class.id,
        className: m.class.name,
        role: m.class.role,
        startDate: toDateKey(m.class.startDate),
        status: m.class.status,
        color: m.color as ClassColor,
      }))
      .sort((a, b) => a.startDate.localeCompare(b.startDate)),
    options: classes
      .map((c) => ({ id: c.id, name: c.name, startDate: toDateKey(c.startDate), status: c.status }))
      .filter((c) => !isPastClass(c, today))
      .map(({ id, name, startDate }) => ({ id, name, startDate })),
    canAdd: canEdit,
    canEdit,
  };
}

// ─── Class CRUD (admins / HR) ────────────────────────────────────────────────

type ClassInput = {
  name?: string;
  role: string;
  positionId?: string | null;
  startDate: string;
  targetCount?: number | null;
  notes?: string | null;
  status?: ClassStatus;
};

type Result<T = object> = ({ success: true } & T) | { success: false; error: string };

async function normalizeClassInput(input: ClassInput): Promise<{ data: { name: string; role: string; positionId: string | null; startDate: Date; targetCount: number | null; notes: string | null; status: ClassStatus } } | { error: string }> {
  let role = (input.role || "").trim();
  const startDate = (input.startDate || "").trim();
  if (!isValidDateKey(startDate)) return { error: "Pick a valid start date." };

  let positionId: string | null = input.positionId || null;
  if (positionId) {
    const pos = await db.position.findUnique({ where: { id: positionId }, select: { title: true } });
    if (!pos) return { error: "That position no longer exists." };
    if (!role) role = pos.title;
  }
  if (!role) return { error: "Enter the role for this class." };

  let targetCount: number | null = null;
  if (input.targetCount != null && !Number.isNaN(Number(input.targetCount))) {
    const n = Math.floor(Number(input.targetCount));
    if (n < 0 || n > 10000) return { error: "Target headcount must be between 0 and 10,000." };
    targetCount = n > 0 ? n : null;
  }
  const status = input.status && CLASS_STATUSES.includes(input.status) ? input.status : "UPCOMING";
  const name = (input.name || "").trim() || defaultClassName(role, startDate);
  return {
    data: {
      name: name.slice(0, 200),
      role: role.slice(0, 200),
      positionId,
      startDate: new Date(`${startDate}T00:00:00Z`),
      targetCount,
      notes: (input.notes || "").trim() || null,
      status,
    },
  };
}

export async function createRecruitmentClass(input: ClassInput): Promise<Result<{ id: string }>> {
  const viewer = await requireClassManager();
  const parsed = await normalizeClassInput(input);
  if ("error" in parsed) return { success: false, error: parsed.error };
  const created = await db.recruitmentClass.create({ data: { ...parsed.data, createdById: viewer.userId } });
  await audit({ action: "recruitment_class.created", entityType: "RecruitmentClass", entityId: created.id, details: { name: created.name } });
  revalidateClasses(created.id);
  return { success: true, id: created.id };
}

export async function updateRecruitmentClass(id: string, input: ClassInput): Promise<Result> {
  await requireClassManager();
  const existing = await db.recruitmentClass.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { success: false, error: "Class not found." };
  const parsed = await normalizeClassInput(input);
  if ("error" in parsed) return { success: false, error: parsed.error };
  await db.recruitmentClass.update({ where: { id }, data: parsed.data });
  await audit({ action: "recruitment_class.updated", entityType: "RecruitmentClass", entityId: id, details: { name: parsed.data.name } });
  revalidateClasses(id);
  return { success: true };
}

export async function deleteRecruitmentClass(id: string): Promise<Result> {
  await requireClassManager();
  const existing = await db.recruitmentClass.findUnique({ where: { id }, select: { name: true } });
  if (!existing) return { success: false, error: "Class not found." };
  await db.recruitmentClass.delete({ where: { id } });
  await audit({ action: "recruitment_class.deleted", entityType: "RecruitmentClass", entityId: id, details: { name: existing.name } });
  revalidateClasses(id);
  return { success: true };
}

// ─── Members ─────────────────────────────────────────────────────────────────

export async function addCandidatesToClass(classId: string, candidateIds: string[]): Promise<Result<{ added: number }>> {
  const viewer = await requireClassViewer();
  if (!permissionsFor(viewer).canEditMembers) return { success: false, error: "You can view classes but not change them." };
  const cls = await db.recruitmentClass.findUnique({ where: { id: classId }, select: { id: true } });
  if (!cls) return { success: false, error: "Class not found." };

  const ids = [...new Set(candidateIds.filter((x) => typeof x === "string" && x))].slice(0, 200);
  if (ids.length === 0) return { success: true, added: 0 };
  const candidates = await db.candidate.findMany({ where: { id: { in: ids } }, select: { id: true, recruiterId: true } });
  if (candidates.length !== ids.length) return { success: false, error: "One or more candidates no longer exist." };
  if (candidates.some((c) => !canEditCandidate(viewer, c.recruiterId))) return { success: false, error: "Forbidden" };

  const res = await db.recruitmentClassMember.createMany({
    data: ids.map((candidateId) => ({ classId, candidateId, addedById: viewer.userId })),
    skipDuplicates: true,
  });
  await audit({ action: "recruitment_class.members_added", entityType: "RecruitmentClass", entityId: classId, details: { candidateIds: ids } });
  revalidateClasses(classId);
  return { success: true, added: res.count };
}

async function loadEditableMember(viewer: Viewer, memberId: string) {
  const member = await db.recruitmentClassMember.findUnique({
    where: { id: memberId },
    select: { id: true, classId: true, candidateId: true, candidate: { select: { recruiterId: true } } },
  });
  if (!member) return { error: "That candidate is no longer in this class." } as const;
  if (!canEditCandidate(viewer, member.candidate.recruiterId)) return { error: "Forbidden" } as const;
  return { member } as const;
}

export async function updateClassMember(memberId: string, patch: { color?: ClassColor; note?: string | null }): Promise<Result> {
  const viewer = await requireClassViewer();
  const loaded = await loadEditableMember(viewer, memberId);
  if ("error" in loaded) return { success: false, error: loaded.error ?? "Forbidden" };

  const data: { color?: ClassColor; note?: string | null } = {};
  if (patch.color !== undefined) {
    if (!isClassColor(patch.color)) return { success: false, error: "Unknown color." };
    data.color = patch.color;
  }
  if (patch.note !== undefined) data.note = (patch.note || "").trim().slice(0, 2000) || null;
  if (Object.keys(data).length === 0) return { success: true };

  await db.recruitmentClassMember.update({ where: { id: memberId }, data });
  if (data.color) {
    await audit({
      action: "recruitment_class.member_color",
      entityType: "RecruitmentClass",
      entityId: loaded.member.classId,
      details: { candidateId: loaded.member.candidateId, color: data.color },
    });
  }
  revalidateClasses(loaded.member.classId);
  return { success: true };
}

export async function removeClassMember(memberId: string): Promise<Result> {
  const viewer = await requireClassViewer();
  const loaded = await loadEditableMember(viewer, memberId);
  if ("error" in loaded) return { success: false, error: loaded.error ?? "Forbidden" };
  await db.recruitmentClassMember.delete({ where: { id: memberId } });
  await audit({
    action: "recruitment_class.member_removed",
    entityType: "RecruitmentClass",
    entityId: loaded.member.classId,
    details: { candidateId: loaded.member.candidateId },
  });
  revalidateClasses(loaded.member.classId);
  return { success: true };
}
