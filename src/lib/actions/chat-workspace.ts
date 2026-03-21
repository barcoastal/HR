// src/lib/actions/chat-workspace.ts
"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";

/**
 * Get or create the default chat workspace.
 * Auto-creates #general and #random channels, and enrolls all employees as members.
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

    // Enroll all active employees as workspace members
    const employees = await db.employee.findMany({
      where: { status: { in: ["ACTIVE", "ONBOARDING", "PRE_ONBOARDING"] } },
      select: { id: true },
    });

    await db.chatMember.createMany({
      data: employees.map((e) => ({
        employeeId: e.id,
        workspaceId: workspace!.id,
        role: e.id === employeeId ? "OWNER" : "MEMBER",
      })),
      skipDuplicates: true,
    });

    // Add all employees to default channels
    const defaultChannels = workspace.channels.filter((c) => c.isDefault);
    for (const channel of defaultChannels) {
      await db.channelMember.createMany({
        data: employees.map((e) => ({
          channelId: channel.id,
          employeeId: e.id,
        })),
        skipDuplicates: true,
      });
    }
  }

  // Ensure current user is a member (handles new employees)
  const isMember = workspace.members.some((m) => m.employeeId === employeeId);
  if (!isMember) {
    await db.chatMember.create({
      data: {
        employeeId,
        workspaceId: workspace.id,
      },
    });
    // Add to default channels
    const defaultChannels = workspace.channels.filter((c) => c.isDefault);
    for (const channel of defaultChannels) {
      await db.channelMember.upsert({
        where: { channelId_employeeId: { channelId: channel.id, employeeId } },
        create: { channelId: channel.id, employeeId },
        update: {},
      });
    }
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
