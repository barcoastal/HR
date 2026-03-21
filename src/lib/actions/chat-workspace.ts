// src/lib/actions/chat-workspace.ts
"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";

/**
 * Get or create the default chat workspace.
 * Auto-creates #general and #random channels, and enrolls all employees as members.
 * Syncs missing employees on every load.
 */
export async function getOrCreateWorkspace() {
  const session = await requireAuth();
  const employeeId = session.user.employeeId!;

  try {
    // Check for existing workspace
    let workspace = await db.chatWorkspace.findFirst({
      include: {
        channels: {
          where: { isArchived: false },
          orderBy: { name: "asc" },
        },
        members: { select: { employeeId: true } },
      },
    });

    if (!workspace) {
      // Create workspace with default channels
      workspace = await db.chatWorkspace.create({
        data: {
          name: "Coastal Debt",
          slug: "coastal-debt",
          channels: {
            create: [
              {
                name: "general",
                slug: "general",
                description: "Company-wide announcements and discussions",
                isDefault: true,
                createdById: employeeId,
              },
              {
                name: "random",
                slug: "random",
                description: "Non-work banter and water cooler chat",
                isDefault: true,
                createdById: employeeId,
              },
            ],
          },
        },
        include: {
          channels: {
            where: { isArchived: false },
            orderBy: { name: "asc" },
          },
          members: { select: { employeeId: true } },
        },
      });
    }

    // Always sync: enroll any active employees who aren't members yet
    const employees = await db.employee.findMany({
      where: { status: { in: ["ACTIVE", "ONBOARDING", "PRE_ONBOARDING"] } },
      select: { id: true },
    });

    const existingMemberIds = new Set(workspace.members.map((m) => m.employeeId));
    const missingEmployees = employees.filter((e) => !existingMemberIds.has(e.id));

    if (missingEmployees.length > 0) {
      // Add missing employees as workspace members
      await db.chatMember.createMany({
        data: missingEmployees.map((e) => ({
          employeeId: e.id,
          workspaceId: workspace!.id,
          role: e.id === employeeId ? "OWNER" : "MEMBER",
        })),
        skipDuplicates: true,
      });

      // Add missing employees to default channels
      const defaultChannels = workspace.channels.filter((c) => c.isDefault);
      for (const channel of defaultChannels) {
        await db.channelMember.createMany({
          data: missingEmployees.map((e) => ({
            channelId: channel.id,
            employeeId: e.id,
          })),
          skipDuplicates: true,
        });
      }

      // Re-fetch workspace with updated members
      workspace = await db.chatWorkspace.findFirst({
        include: {
          channels: {
            where: { isArchived: false },
            orderBy: { name: "asc" },
          },
          members: { select: { employeeId: true } },
        },
      });
    }

    return workspace;
  } catch (error) {
    console.error("[Chat] getOrCreateWorkspace failed:", error);
    throw error;
  }
}

/**
 * Get workspace details with member count.
 */
export async function getWorkspaceById(workspaceId: string) {
  return db.chatWorkspace.findUnique({
    where: { id: workspaceId },
    include: {
      _count: { select: { members: true, channels: true } },
    },
  });
}

/**
 * Get all members of a workspace with employee details.
 */
export async function getWorkspaceMembers(workspaceId: string) {
  await requireAuth();

  const members = await db.chatMember.findMany({
    where: { workspaceId },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          profilePhoto: true,
          jobTitle: true,
          email: true,
        },
      },
    },
    orderBy: { employee: { firstName: "asc" } },
  });

  return members.map((m) => m.employee);
}
