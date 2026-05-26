"use server";

import { db } from "@/lib/db";
import type { FeedPostType, PollVisibility, ReactionType } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-helpers";

export type PollOptionView = {
  id: string;
  label: string;
  order: number;
  voteCount: number | null; // null when totals are hidden from this viewer
  voters: { id: string; firstName: string; lastName: string; profilePhoto: string | null }[] | null;
};

export type PollView = {
  id: string;
  question: string;
  visibility: PollVisibility;
  allowMultiple: boolean;
  closesAt: Date | null;
  totalVotes: number | null;
  myOptionIds: string[];
  resultsHidden: boolean; // true => non-admin viewing ADMIN_ANONYMOUS poll, show "hidden" UI
  options: PollOptionView[];
};

export async function getFeedPosts(currentEmployeeId?: string, role?: string) {
  const posts = await db.feedPost.findMany({
    include: {
      author: true,
      mentionedEmployee: true,
      reactions: true,
      comments: { include: { author: true }, orderBy: { createdAt: "asc" } },
      attachments: { orderBy: { createdAt: "asc" } },
      _count: { select: { comments: true, reactions: true } },
      poll: {
        include: {
          options: {
            orderBy: { order: "asc" },
            include: {
              votes: {
                include: {
                  employee: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });

  const isSuperAdmin = role === "SUPER_ADMIN";

  return posts.map((post) => {
    if (!post.poll) return post;

    const poll = post.poll;
    const showResults =
      poll.visibility === "OPEN" ||
      poll.visibility === "PUBLIC_ANONYMOUS" ||
      (poll.visibility === "ADMIN_ANONYMOUS" && isSuperAdmin);
    const showVoters =
      poll.visibility === "OPEN" ||
      (poll.visibility === "ADMIN_ANONYMOUS" && isSuperAdmin);

    const totalVotesAll = poll.options.reduce((sum, o) => sum + o.votes.length, 0);
    const myOptionIds = currentEmployeeId
      ? poll.options
          .filter((o) => o.votes.some((v) => v.employeeId === currentEmployeeId))
          .map((o) => o.id)
      : [];

    const pollView: PollView = {
      id: poll.id,
      question: poll.question,
      visibility: poll.visibility,
      allowMultiple: poll.allowMultiple,
      closesAt: poll.closesAt,
      totalVotes: showResults ? totalVotesAll : null,
      myOptionIds,
      resultsHidden: !showResults,
      options: poll.options.map((o) => ({
        id: o.id,
        label: o.label,
        order: o.order,
        voteCount: showResults ? o.votes.length : null,
        voters: showVoters
          ? o.votes.map((v) => ({
              id: v.employee.id,
              firstName: v.employee.firstName,
              lastName: v.employee.lastName,
              profilePhoto: v.employee.profilePhoto,
            }))
          : null,
      })),
    };

    return { ...post, pollView };
  });
}

export async function createFeedPost(data: {
  authorId: string;
  content: string;
  type?: FeedPostType;
  attachments?: { url: string; type: "IMAGE" | "FILE"; name: string }[];
  emailTarget?: "all" | "none";
}) {
  const post = await db.feedPost.create({
    data: {
      authorId: data.authorId,
      content: data.content,
      type: data.type || "GENERAL",
      notifyViaEmail: data.emailTarget !== "none",
      emailTargetType: data.emailTarget || "all",
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

  // Send email notification (targeted)
  if (data.emailTarget !== "none") {
    try {
      const { sendPostNotificationEmail } = await import("@/lib/actions/feed-events");
      await sendPostNotificationEmail(post.id, data.authorId);
    } catch (err) {
      console.error("[feed] notification error:", err);
    }
  }

  // Create in-app notifications for users who opted in
  const inAppUsers = await db.user.findMany({
    where: {
      employee: { status: "ACTIVE" },
      employeeId: { not: data.authorId },
      notifyFeedPostInApp: true,
    },
    select: { employeeId: true },
  });
  if (inAppUsers.length > 0) {
    await db.notification.createMany({
      data: inAppUsers
        .filter((u) => u.employeeId)
        .map((u) => ({
          recipientId: u.employeeId!,
          type: "FEED_POST",
          message: "New post in feed",
          link: "/feed",
        })),
    });
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

  // Notify post author about the comment
  const post = await db.feedPost.findUnique({
    where: { id: postId },
    select: { authorId: true, author: { select: { firstName: true, lastName: true } } },
  });

  if (post && post.authorId !== authorId) {
    const commenter = await db.employee.findUnique({
      where: { id: authorId },
      select: { firstName: true, lastName: true },
    });
    const commenterName = commenter
      ? `${commenter.firstName} ${commenter.lastName}`
      : "Someone";

    // Check post author's notification preferences
    const postAuthorUser = await db.user.findUnique({
      where: { employeeId: post.authorId },
      select: { notifyCommentInApp: true, notifyCommentEmail: true, emailNotificationsEnabled: true, email: true },
    });

    if (postAuthorUser?.notifyCommentInApp) {
      await db.notification.create({
        data: {
          recipientId: post.authorId,
          type: "FEED_COMMENT",
          message: `${commenterName} commented on your post`,
          link: "/feed",
        },
      });
    }

    if (postAuthorUser?.emailNotificationsEnabled && postAuthorUser?.notifyCommentEmail && postAuthorUser?.email) {
      try {
        const { sendEmail } = await import("@/lib/email");
        await sendEmail(
          postAuthorUser.email,
          `${commenterName} commented on your post`,
          `<p>${commenterName} left a comment on your post:</p><p style="color:#666;font-style:italic">"${content.slice(0, 200)}"</p><p><a href="${process.env.NEXTAUTH_URL || "http://localhost:3000"}/feed" style="color:#3052FF">View in App</a></p>`
        );
      } catch (err) {
        console.error("[feed] comment notification email error:", err);
      }
    }
  }

  revalidatePath("/");
  return comment;
}

export async function createShoutoutPost(
  authorId: string,
  mentionedEmployeeId: string,
  content: string,
  emailTarget?: "all" | "none"
) {
  const post = await db.feedPost.create({
    data: {
      authorId,
      content,
      type: "SHOUTOUT",
      mentionedEmployeeId,
      notifyViaEmail: emailTarget !== "none",
      emailTargetType: emailTarget || "all",
    },
  });

  // Send email notification (targeted)
  if (emailTarget !== "none") {
    try {
      const { sendPostNotificationEmail } = await import("@/lib/actions/feed-events");
      await sendPostNotificationEmail(post.id, authorId);
    } catch (err) {
      console.error("[feed] notification error:", err);
    }
  }

  const author = await db.employee.findUnique({
    where: { id: authorId },
    select: { firstName: true, lastName: true },
  });
  const authorName = author ? `${author.firstName} ${author.lastName}` : "Someone";

  // Create in-app notifications for users who opted in
  const inAppUsers = await db.user.findMany({
    where: {
      employee: { status: "ACTIVE" },
      employeeId: { not: authorId },
      notifyFeedPostInApp: true,
    },
    select: { employeeId: true },
  });
  if (inAppUsers.length > 0) {
    await db.notification.createMany({
      data: inAppUsers
        .filter((u) => u.employeeId)
        .map((u) => ({
          recipientId: u.employeeId!,
          type: "FEED_POST",
          message: "New shoutout in feed",
          link: "/feed",
        })),
    });
  }

  // Notify the mentioned employee specifically (shoutout notification)
  if (mentionedEmployeeId !== authorId) {
    const mentionedUser = await db.user.findUnique({
      where: { employeeId: mentionedEmployeeId },
      select: { notifyShoutoutInApp: true, notifyShoutoutEmail: true, emailNotificationsEnabled: true, email: true },
    });

    if (mentionedUser?.notifyShoutoutInApp) {
      await db.notification.create({
        data: {
          recipientId: mentionedEmployeeId,
          type: "FEED_SHOUTOUT",
          message: `${authorName} gave you a shoutout!`,
          link: "/feed",
        },
      });
    }

    if (mentionedUser?.emailNotificationsEnabled && mentionedUser?.notifyShoutoutEmail && mentionedUser?.email) {
      try {
        const { sendEmail } = await import("@/lib/email");
        await sendEmail(
          mentionedUser.email,
          `${authorName} gave you a shoutout!`,
          `<p>${authorName} recognized you in the team feed:</p><p style="color:#666;font-style:italic">"${content.slice(0, 300)}"</p><p><a href="${process.env.NEXTAUTH_URL || "http://localhost:3000"}/feed" style="color:#3052FF">View in App</a></p>`
        );
      } catch (err) {
        console.error("[feed] shoutout notification email error:", err);
      }
    }
  }

  revalidatePath("/");
  return post;
}

export async function createPollPost(data: {
  authorId: string;
  question: string;
  options: string[];
  visibility: PollVisibility;
  allowMultiple: boolean;
  closesAt?: Date | null;
  emailTarget?: "all" | "none";
}) {
  const cleanOptions = data.options.map((o) => o.trim()).filter(Boolean);
  if (!data.question.trim()) throw new Error("Poll question is required");
  if (cleanOptions.length < 2) throw new Error("Add at least two options");
  if (cleanOptions.length > 10) throw new Error("Maximum 10 options");

  const post = await db.feedPost.create({
    data: {
      authorId: data.authorId,
      content: data.question.trim(),
      type: "POLL",
      notifyViaEmail: data.emailTarget !== "none",
      emailTargetType: data.emailTarget || "all",
      poll: {
        create: {
          question: data.question.trim(),
          visibility: data.visibility,
          allowMultiple: data.allowMultiple,
          closesAt: data.closesAt ?? null,
          options: {
            create: cleanOptions.map((label, i) => ({ label, order: i })),
          },
        },
      },
    },
  });

  if (data.emailTarget !== "none") {
    try {
      const { sendPostNotificationEmail } = await import("@/lib/actions/feed-events");
      await sendPostNotificationEmail(post.id, data.authorId);
    } catch (err) {
      console.error("[feed] poll notification error:", err);
    }
  }

  const inAppUsers = await db.user.findMany({
    where: {
      employee: { status: "ACTIVE" },
      employeeId: { not: data.authorId },
      notifyFeedPostInApp: true,
    },
    select: { employeeId: true },
  });
  if (inAppUsers.length > 0) {
    await db.notification.createMany({
      data: inAppUsers
        .filter((u) => u.employeeId)
        .map((u) => ({
          recipientId: u.employeeId!,
          type: "FEED_POST",
          message: "New poll in feed",
          link: "/feed",
        })),
    });
  }

  revalidatePath("/");
  return post;
}

export async function submitPollVote(pollId: string, optionIds: string[]) {
  const session = await requireAuth();
  const employeeId = session.user.employeeId;
  if (!employeeId) throw new Error("Link an employee profile to vote");

  const poll = await db.feedPoll.findUnique({
    where: { id: pollId },
    select: { id: true, allowMultiple: true, closesAt: true, options: { select: { id: true } } },
  });
  if (!poll) throw new Error("Poll not found");
  if (poll.closesAt && poll.closesAt.getTime() < Date.now()) throw new Error("Poll has closed");

  const validIds = new Set(poll.options.map((o) => o.id));
  const cleanIds = Array.from(new Set(optionIds.filter((id) => validIds.has(id))));
  if (cleanIds.length === 0) throw new Error("Pick at least one option");
  if (!poll.allowMultiple && cleanIds.length > 1) throw new Error("This poll only allows one choice");

  await db.$transaction([
    db.feedPollVote.deleteMany({ where: { pollId, employeeId } }),
    db.feedPollVote.createMany({
      data: cleanIds.map((optionId) => ({ pollId, optionId, employeeId })),
    }),
  ]);

  revalidatePath("/");
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

  let isNewReaction = false;

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
    isNewReaction = true;
  }

  // Notify post author about the reaction (only for new reactions, not changes/removals)
  if (isNewReaction) {
    const post = await db.feedPost.findUnique({
      where: { id: postId },
      select: { authorId: true },
    });

    if (post && post.authorId !== employeeId) {
      const postAuthorUser = await db.user.findUnique({
        where: { employeeId: post.authorId },
        select: { notifyReactionInApp: true },
      });

      if (postAuthorUser?.notifyReactionInApp) {
        const reactor = await db.employee.findUnique({
          where: { id: employeeId },
          select: { firstName: true, lastName: true },
        });
        const reactorName = reactor
          ? `${reactor.firstName} ${reactor.lastName}`
          : "Someone";

        await db.notification.create({
          data: {
            recipientId: post.authorId,
            type: "FEED_REACTION",
            message: `${reactorName} reacted to your post`,
            link: "/feed",
          },
        });
      }
    }
  }

  revalidatePath("/");
}
