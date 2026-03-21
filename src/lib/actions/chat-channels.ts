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

  return db.channel.findUnique({
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

export async function updateLastRead(channelId: string) {
  const session = await requireAuth();
  const employeeId = session.user.employeeId!;

  await db.channelMember.updateMany({
    where: { channelId, employeeId },
    data: { lastReadAt: new Date() },
  });
}
