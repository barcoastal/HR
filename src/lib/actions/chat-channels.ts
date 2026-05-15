// src/lib/actions/chat-channels.ts
"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

export async function getChannels(workspaceId: string) {
  const session = await requireAuth();
  const employeeId = session.user.employeeId!;

  return db.channel.findMany({
    where: {
      workspaceId,
      isArchived: false,
      OR: [
        { isPrivate: false },
        { members: { some: { employeeId } } },
      ],
    },
    include: {
      _count: { select: { members: true, messages: true } },
      members: {
        where: { employeeId },
        select: { lastReadAt: true, isMuted: true, isStarred: true },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function getChannelById(channelId: string) {
  const session = await requireAuth();
  const employeeId = session.user?.employeeId;
  if (!employeeId) return null;

  const channel = await db.channel.findUnique({
    where: { id: channelId },
    include: {
      _count: { select: { members: true, messages: true } },
      members: {
        include: {
          employee: {
            select: { id: true, firstName: true, lastName: true, profilePhoto: true, jobTitle: true },
          },
        },
      },
    },
  });
  if (!channel) return null;
  // Private channels are only visible to current members
  if (channel.isPrivate) {
    const isMember = channel.members.some((m) => m.employeeId === employeeId);
    if (!isMember) return null;
  }
  return channel;
}

export async function createChannel(data: {
  workspaceId: string;
  name: string;
  description?: string;
  topic?: string;
  isPrivate?: boolean;
}) {
  const session = await requireAuth();
  const employeeId = session.user.employeeId!;

  const slug = data.name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const channel = await db.channel.create({
    data: {
      workspaceId: data.workspaceId,
      name: data.name,
      slug,
      description: data.description,
      topic: data.topic,
      isPrivate: data.isPrivate ?? false,
      createdById: employeeId,
      members: {
        create: { employeeId, isAdmin: true },
      },
    },
  });

  revalidatePath("/chat");
  return channel;
}

export async function joinChannel(channelId: string) {
  const session = await requireAuth();
  const employeeId = session.user.employeeId!;

  // Private channels can only be joined by invitation (addMembersToChannel) —
  // self-join is restricted to public channels.
  const channel = await db.channel.findUnique({
    where: { id: channelId },
    select: { isPrivate: true },
  });
  if (!channel) throw new Error("Channel not found");
  if (channel.isPrivate) {
    throw new Error("This channel is private — you need to be invited");
  }

  await db.channelMember.upsert({
    where: { channelId_employeeId: { channelId, employeeId } },
    create: { channelId, employeeId },
    update: {},
  });

  revalidatePath("/chat");
}

export async function leaveChannel(channelId: string) {
  const session = await requireAuth();
  const employeeId = session.user.employeeId!;

  await db.channelMember.deleteMany({
    where: { channelId, employeeId },
  });

  revalidatePath("/chat");
}

async function assertCanAdminChannel(channelId: string, employeeId: string, callerRole: string | undefined) {
  if (callerRole === "SUPER_ADMIN" || callerRole === "ADMIN") return;
  const member = await db.channelMember.findUnique({
    where: { channelId_employeeId: { channelId, employeeId } },
    select: { isAdmin: true },
  });
  if (!member?.isAdmin) {
    throw new Error("Only a channel admin can perform this action");
  }
}

export async function addMembersToChannel(channelId: string, employeeIds: string[]) {
  const session = await requireAuth();
  const employeeId = session.user?.employeeId;
  if (!employeeId) throw new Error("No employee profile linked to this account");
  await assertCanAdminChannel(channelId, employeeId, session.user?.role);

  await db.channelMember.createMany({
    data: employeeIds.map((id) => ({
      channelId,
      employeeId: id,
    })),
    skipDuplicates: true,
  });

  revalidatePath("/chat");
}

export async function updateChannel(channelId: string, data: {
  name?: string;
  topic?: string;
  description?: string;
}) {
  const session = await requireAuth();
  const employeeId = session.user?.employeeId;
  if (!employeeId) throw new Error("No employee profile linked to this account");
  await assertCanAdminChannel(channelId, employeeId, session.user?.role);

  await db.channel.update({
    where: { id: channelId },
    data: {
      ...(data.name ? { name: data.name, slug: data.name.toLowerCase().replace(/[^a-z0-9-]/g, "-") } : {}),
      ...(data.topic !== undefined ? { topic: data.topic } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
    },
  });

  revalidatePath("/chat");
}

export async function archiveChannel(channelId: string) {
  const session = await requireAuth();
  const employeeId = session.user?.employeeId;
  if (!employeeId) throw new Error("No employee profile linked to this account");
  await assertCanAdminChannel(channelId, employeeId, session.user?.role);
  await db.channel.update({
    where: { id: channelId },
    data: { isArchived: true },
  });
  revalidatePath("/chat");
}

export async function toggleMuteChannel(channelId: string) {
  const session = await requireAuth();
  const employeeId = session.user.employeeId!;

  const member = await db.channelMember.findUnique({
    where: { channelId_employeeId: { channelId, employeeId } },
  });

  if (member) {
    await db.channelMember.update({
      where: { id: member.id },
      data: { isMuted: !member.isMuted },
    });
  }

  revalidatePath("/chat");
  return { muted: member ? !member.isMuted : false };
}

export async function toggleStarChannel(channelId: string) {
  const session = await requireAuth();
  const employeeId = session.user.employeeId!;

  const member = await db.channelMember.findUnique({
    where: { channelId_employeeId: { channelId, employeeId } },
  });

  if (member) {
    await db.channelMember.update({
      where: { id: member.id },
      data: { isStarred: !member.isStarred },
    });
  }

  revalidatePath("/chat");
  return { starred: member ? !member.isStarred : false };
}

export async function updateLastRead(channelId: string) {
  const session = await requireAuth();
  const employeeId = session.user.employeeId!;

  await db.channelMember.updateMany({
    where: { channelId, employeeId },
    data: { lastReadAt: new Date() },
  });
}
