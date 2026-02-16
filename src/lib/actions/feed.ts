"use server";

import { db } from "@/lib/db";
import type { FeedPostType, ReactionType } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";

export async function getFeedPosts() {
  return db.feedPost.findMany({
    include: {
      author: true,
      mentionedEmployee: true,
      reactions: true,
      comments: { include: { author: true }, orderBy: { createdAt: "asc" } },
      _count: { select: { comments: true, reactions: true } },
    },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });
}

export async function createFeedPost(data: {
  authorId: string;
  content: string;
  type?: FeedPostType;
}) {
  const post = await db.feedPost.create({
    data: {
      authorId: data.authorId,
      content: data.content,
      type: data.type || "GENERAL",
    },
  });
  revalidatePath("/");
  return post;
}

export async function createFeedComment(
  postId: string,
  authorId: string,
  content: string
) {
  const comment = await db.feedComment.create({
    data: { postId, authorId, content },
  });
  revalidatePath("/");
  return comment;
}

export async function createShoutoutPost(
  authorId: string,
  mentionedEmployeeId: string,
  content: string
) {
  const post = await db.feedPost.create({
    data: {
      authorId,
      content,
      type: "SHOUTOUT",
      mentionedEmployeeId,
    },
  });
  revalidatePath("/");
  return post;
}

export async function toggleReaction(
  postId: string,
  employeeId: string,
  type: ReactionType
) {
  const existing = await db.feedReaction.findUnique({
    where: { postId_employeeId: { postId, employeeId } },
  });

  if (existing) {
    if (existing.type === type) {
      await db.feedReaction.delete({ where: { id: existing.id } });
    } else {
      await db.feedReaction.update({
        where: { id: existing.id },
        data: { type },
      });
    }
  } else {
    await db.feedReaction.create({
      data: { postId, employeeId, type },
    });
  }
  revalidatePath("/");
}
