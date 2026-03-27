"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function createFeedEvent(data: {
  authorId: string;
  content: string;
  eventDate: string;
  eventEndDate: string;
  eventLocation?: string;
  emailTarget?: "all" | "none";
}) {
  if (!data.eventDate || !data.eventEndDate) {
    throw new Error("Event start and end dates are required");
  }

  const post = await db.feedPost.create({
    data: {
      authorId: data.authorId,
      content: data.content,
      type: "EVENT",
      eventDate: new Date(data.eventDate),
      eventEndDate: new Date(data.eventEndDate),
      eventLocation: data.eventLocation || null,
      notifyViaEmail: data.emailTarget !== "none",
      emailTargetType: data.emailTarget || "all",
    },
  });

  // Send email notification (targeted)
  if (data.emailTarget !== "none") {
    try {
      await sendPostNotificationEmail(post.id, data.authorId);
    } catch (err) {
      console.error("[feed-events] notification error:", err);
    }
  }

  // Create in-app notifications for users who opted in
  const inAppUsers = await db.user.findMany({
    where: {
      employee: { status: "ACTIVE" },
      employeeId: { not: data.authorId },
      notifyFeedEventInApp: true,
    },
    select: { employeeId: true },
  });
  if (inAppUsers.length > 0) {
    await db.notification.createMany({
      data: inAppUsers
        .filter((u) => u.employeeId)
        .map((u) => ({
          recipientId: u.employeeId!,
          type: "FEED_EVENT",
          message: `New event: ${data.content}`,
          link: "/feed",
        })),
    });
  }

  revalidatePath("/");
  return post;
}

export async function upsertEventAttendance(data: {
  feedPostId: string;
  userId: string;
  status: "GOING" | "MAYBE" | "NOT_GOING";
}) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  if (session.user?.id !== data.userId) {
    throw new Error("Not authorized");
  }

  const feedPost = await db.feedPost.findUnique({
    where: { id: data.feedPostId },
    select: {
      id: true,
      content: true,
      eventDate: true,
      eventEndDate: true,
      eventLocation: true,
      type: true,
    },
  });
  if (!feedPost || feedPost.type !== "EVENT") {
    throw new Error("Event not found");
  }

  const existing = await db.eventAttendance.findUnique({
    where: {
      feedPostId_userId: {
        feedPostId: data.feedPostId,
        userId: data.userId,
      },
    },
  });

  const attendance = await db.eventAttendance.upsert({
    where: {
      feedPostId_userId: {
        feedPostId: data.feedPostId,
        userId: data.userId,
      },
    },
    create: {
      feedPostId: data.feedPostId,
      userId: data.userId,
      status: data.status,
    },
    update: {
      status: data.status,
    },
  });

  // Google Calendar sync
  const user = await db.user.findUnique({
    where: { id: data.userId },
    select: { googleCalendarSyncEnabled: true },
  });

  if (user?.googleCalendarSyncEnabled) {
    try {
      if (data.status === "GOING" && feedPost.eventDate && feedPost.eventEndDate) {
        const { pushEventToGoogleCalendar } = await import(
          "@/lib/google-calendar-sync"
        );
        const googleEventId = await pushEventToGoogleCalendar(data.userId, {
          summary: feedPost.content.slice(0, 200),
          location: feedPost.eventLocation || undefined,
          startDateTime: feedPost.eventDate.toISOString(),
          endDateTime: feedPost.eventEndDate.toISOString(),
        });
        await db.eventAttendance.update({
          where: { id: attendance.id },
          data: { googleCalendarEventId: googleEventId },
        });
      } else if (
        data.status === "NOT_GOING" &&
        existing?.googleCalendarEventId
      ) {
        const { deleteEventFromGoogleCalendar } = await import(
          "@/lib/google-calendar-sync"
        );
        await deleteEventFromGoogleCalendar(
          data.userId,
          existing.googleCalendarEventId
        );
        await db.eventAttendance.update({
          where: { id: attendance.id },
          data: { googleCalendarEventId: null },
        });
      }
    } catch (err) {
      console.error("[feed-events] Google Calendar sync error:", err);
    }
  }

  revalidatePath("/");
  return attendance;
}

export async function getEventAttendance(feedPostId: string) {
  return db.eventAttendance.findMany({
    where: { feedPostId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          employee: {
            select: {
              firstName: true,
              lastName: true,
              profilePhoto: true,
            },
          },
        },
      },
    },
  });
}

export async function getEventAttendees(feedPostId: string) {
  const attendance = await getEventAttendance(feedPostId);
  const going = attendance.filter((a) => a.status === "GOING");
  const maybe = attendance.filter((a) => a.status === "MAYBE");
  const notGoing = attendance.filter((a) => a.status === "NOT_GOING");
  return { going, maybe, notGoing, total: going.length + maybe.length };
}

// ── Email notification helper (shared — also called from feed.ts) ────

export async function sendPostNotificationEmail(
  postId: string,
  authorEmployeeId: string
) {
  console.log(`[feed-notify] Starting notification for post ${postId}, author employee ${authorEmployeeId}`);

  const post = await db.feedPost.findUnique({
    where: { id: postId },
    include: { author: { select: { firstName: true, lastName: true } } },
  });
  if (!post) {
    console.log(`[feed-notify] Post ${postId} not found, skipping`);
    return;
  }

  const notifyTypes = ["GENERAL", "SHOUTOUT", "EVENT"];
  if (!notifyTypes.includes(post.type)) {
    console.log(`[feed-notify] Post type ${post.type} not in notify list, skipping`);
    return;
  }

  const authorName = `${post.author.firstName} ${post.author.lastName}`;

  // Get all users with active employee profiles who opted into feed emails
  const isEvent = post.type === "EVENT";
  const users = await db.user.findMany({
    where: {
      emailNotificationsEnabled: true,
      ...(isEvent
        ? { notifyFeedEventEmail: true }
        : { notifyFeedPostEmail: true }),
      employee: {
        status: "ACTIVE",
      },
    },
    select: { email: true },
  });

  console.log(`[feed-notify] Found ${users.length} recipients (excluding author ${authorEmployeeId})`);

  if (users.length === 0) return;

  const { sendFeedPostNotification } = await import("@/lib/email");
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  const safeContent = post.content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const subject = isEvent
    ? `New event: ${post.content.slice(0, 60)}`
    : `New post from ${authorName}`;

  let bodyHtml = `<p style="margin:0 0 12px">${safeContent}</p>`;
  if (isEvent && post.eventDate) {
    const dateStr = new Date(post.eventDate).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    bodyHtml += `<p style="margin:0 0 4px;color:#666"><strong>When:</strong> ${dateStr}</p>`;
    if (post.eventLocation) {
      const safeLocation = post.eventLocation
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      bodyHtml += `<p style="margin:0 0 12px;color:#666"><strong>Where:</strong> ${safeLocation}</p>`;
    }
  }

  const ctaLabel = isEvent ? "RSVP in App" : "View in App";
  bodyHtml += `<p style="margin:16px 0 0"><a href="${baseUrl}" style="display:inline-block;padding:12px 24px;background:#3052FF;color:white;text-decoration:none;border-radius:8px;font-weight:600">${ctaLabel}</a></p>`;

  const emails = users.map((u) => u.email);
  await sendFeedPostNotification(emails, subject, bodyHtml);
}
