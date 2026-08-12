"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { displayFirstName } from "@/lib/utils";

// Present the preferred name as `firstName` at the serialization boundary so
// chat client components keep working unchanged.
function withDisplayMembers<
  T extends { members: Array<{ employee: { firstName: string; preferredName?: string | null } } & Record<string, unknown>> },
>(thread: T): T {
  return {
    ...thread,
    members: thread.members.map((m) => ({
      ...m,
      employee: { ...m.employee, firstName: displayFirstName(m.employee) },
    })),
  };
}

export async function getDmThreads(workspaceId: string) {
  const session = await requireAuth();
  const employeeId = session.user.employeeId!;

  const threads = await db.dmThread.findMany({
    where: {
      workspaceId,
      members: { some: { employeeId } },
    },
    include: {
      members: {
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, preferredName: true, profilePhoto: true },
          },
        },
      },
      messages: {
        take: 1,
        orderBy: { createdAt: "desc" },
        select: { content: true, contentPlain: true, createdAt: true, authorId: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return threads.map(withDisplayMembers);
}

export async function getOrCreateDmThread(
  workspaceId: string,
  participantIds: string[]
) {
  const session = await requireAuth();
  const employeeId = session.user.employeeId!;

  const allMemberIds = [...new Set([employeeId, ...participantIds])];
  const isGroup = allMemberIds.length > 2;

  // Try to find existing DM with exact same members
  const existing = await db.dmThread.findFirst({
    where: {
      workspaceId,
      isGroup,
      members: { every: { employeeId: { in: allMemberIds } } },
      AND: { members: { none: { employeeId: { notIn: allMemberIds } } } },
    },
    include: {
      members: {
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, preferredName: true, profilePhoto: true },
          },
        },
      },
    },
  });

  if (existing) return withDisplayMembers(existing);

  // Create new DM thread
  const created = await db.dmThread.create({
    data: {
      workspaceId,
      isGroup,
      members: {
        create: allMemberIds.map((id) => ({ employeeId: id })),
      },
    },
    include: {
      members: {
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, preferredName: true, profilePhoto: true },
          },
        },
      },
    },
  });
  return withDisplayMembers(created);
}

export async function updateDmLastRead(dmThreadId: string) {
  const session = await requireAuth();
  const employeeId = session.user.employeeId!;

  await db.dmMember.updateMany({
    where: { dmThreadId, employeeId },
    data: { lastReadAt: new Date() },
  });
}
