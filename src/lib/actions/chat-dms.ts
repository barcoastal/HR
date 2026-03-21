"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";

export async function getDmThreads(workspaceId: string) {
  const session = await requireAuth();
  const employeeId = session.user.employeeId;

  return db.dmThread.findMany({
    where: {
      workspaceId,
      members: { some: { employeeId } },
    },
    include: {
      members: {
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, profilePhoto: true },
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
}

export async function getOrCreateDmThread(
  workspaceId: string,
  participantIds: string[]
) {
  const session = await requireAuth();
  const employeeId = session.user.employeeId;

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
            select: { id: true, firstName: true, lastName: true, profilePhoto: true },
          },
        },
      },
    },
  });

  if (existing) return existing;

  // Create new DM thread
  return db.dmThread.create({
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
            select: { id: true, firstName: true, lastName: true, profilePhoto: true },
          },
        },
      },
    },
  });
}

export async function updateDmLastRead(dmThreadId: string) {
  const session = await requireAuth();
  const employeeId = session.user.employeeId;

  await db.dmMember.updateMany({
    where: { dmThreadId, employeeId },
    data: { lastReadAt: new Date() },
  });
}
