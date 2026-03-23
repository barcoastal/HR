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
      attachments: { orderBy: { createdAt: "asc" } },
      _count: { select: { comments: true, reactions: true } },
    },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });
}

export async function createFeedPost(data: {
  authorId: string;
  content: string;
  type?: FeedPostType;
  attachments?: { url: string; type: "IMAGE" | "FILE"; name: string }[];
}) {
  const post = await db.feedPost.create({
    data: {
      authorId: data.authorId,
      content: data.content,
      type: data.type || "GENERAL",
    },
  });

  if (data.attachments && data.attachments.length > 0) {
    await db.postAttachment.createMany({
      data: data.attachments.map((a) => ({
        postId: post.id,
        url: a.url,
        type: a.type,
        name: a.name,
      })),
    });
  }

  // Send email notification before revalidating (awaited to ensure execution)
  try {
    const { sendPostNotificationEmail } = await import("@/lib/actions/feed-events");
    await sendPostNotificationEmail(post.id, data.authorId);
  } catch (err) {
    console.error("[feed] notification error:", err);
  }

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
  // Send email notification before revalidating (awaited to ensure execution)
  try {
    const { sendPostNotificationEmail } = await import("@/lib/actions/feed-events");
    await sendPostNotificationEmail(post.id, authorId);
  } catch (err) {
    console.error("[feed] notification error:", err);
  }

  revalidatePath("/");
  return post;
}

export async function deleteFeedPost(postId: string) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
    throw new Error("Not authorized to delete posts");
  }
  await db.feedPost.delete({ where: { id: postId } });
  revalidatePath("/");
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
