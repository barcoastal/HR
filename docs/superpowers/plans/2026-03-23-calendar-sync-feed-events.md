# Calendar Sync + Feed Events Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-user Google Calendar two-way sync, feed events with RSVP, and email notifications for feed posts.

**Architecture:** Per-user Google Calendar OAuth reusing existing `/api/platforms/[provider]/*` routes with metadata-based branching. Feed events are FeedPosts with `type: EVENT` + EventAttendance model for RSVP. Email notifications via Resend batch API on user-created posts.

**Tech Stack:** Next.js 16, Prisma, PostgreSQL, Google Calendar API, Resend, AES-256-GCM encryption

**Spec:** `docs/superpowers/specs/2026-03-23-calendar-sync-feed-events-design.md`

---

## Chunk 1: Database + Infrastructure

### Task 1: Prisma Schema Changes

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add metadata to OAuthState model**

In `prisma/schema.prisma`, find the `OAuthState` model (around line 848) and add `metadata` field after `redirectUri`:

```prisma
model OAuthState {
  id          String   @id @default(uuid())
  state       String   @unique
  provider    String
  platformId  String?
  userId      String
  redirectUri String
  metadata    Json?
  expiresAt   DateTime
  createdAt   DateTime @default(now())

  @@index([state])
  @@index([expiresAt])
}
```

- [ ] **Step 2: Add fields to User model**

In `prisma/schema.prisma`, find the `User` model (around line 257) and add after `createdAt`:

```prisma
model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String?
  role         UserRole @default(EMPLOYEE)
  employeeId   String?  @unique
  createdAt    DateTime @default(now())

  // Google Calendar per-user sync
  googleCalendarAccessToken   String?
  googleCalendarRefreshToken  String?
  googleCalendarTokenExpiresAt DateTime?
  googleCalendarSyncEnabled   Boolean  @default(false)

  // Email notification preferences
  emailNotificationsEnabled   Boolean  @default(true)

  employee          Employee?          @relation(fields: [employeeId], references: [id])
  eventAttendances  EventAttendance[]
}
```

- [ ] **Step 3: Add EVENT to FeedPostType enum**

Find `enum FeedPostType` (around line 58) and add `EVENT` at the end:

```prisma
enum FeedPostType {
  ANNOUNCEMENT
  GENERAL
  BIRTHDAY
  ANNIVERSARY
  NEW_HIRE
  DEPARTURE
  SHOUTOUT
  EMERGENCY
  EVENT
}
```

- [ ] **Step 4: Add event fields and attendees relation to FeedPost model**

Find the `FeedPost` model (around line 387). Add after existing fields, before relations:

```prisma
  // Event-specific fields (nullable, required at app level when type=EVENT)
  eventDate     DateTime?
  eventEndDate  DateTime?
  eventLocation String?
```

Add to relations section:

```prisma
  attendees         EventAttendance[]
```

- [ ] **Step 5: Add EventAttendance model and AttendanceStatus enum**

Add after the FeedPost model:

```prisma
enum AttendanceStatus {
  GOING
  MAYBE
  NOT_GOING
}

model EventAttendance {
  id                    String           @id @default(uuid())
  feedPostId            String
  feedPost              FeedPost         @relation(fields: [feedPostId], references: [id], onDelete: Cascade)
  userId                String
  user                  User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  status                AttendanceStatus
  googleCalendarEventId String?
  createdAt             DateTime         @default(now())
  updatedAt             DateTime         @updatedAt

  @@unique([feedPostId, userId])
  @@index([userId])
}
```

- [ ] **Step 6: Run migration**

```bash
cd /Users/baralezrah/hr-platform
npx prisma migrate dev --name add_calendar_sync_feed_events
```

- [ ] **Step 7: Generate Prisma client and verify**

```bash
npx prisma generate
```

- [ ] **Step 8: Commit**

```bash
git add prisma/
git commit -m "feat: add schema for calendar sync, feed events, and attendance"
```

---

### Task 2: Extract Shared Encryption Module

**Files:**
- Create: `src/lib/encryption.ts`
- Modify: `src/lib/gusto.ts`

- [ ] **Step 1: Create shared encryption module**

Create `src/lib/encryption.ts`:

```typescript
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY || process.env.GUSTO_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY (or GUSTO_ENCRYPTION_KEY) must be a 64-char hex string (32 bytes)"
    );
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decrypt(encoded: string): string {
  const key = getEncryptionKey();
  const data = Buffer.from(encoded, "base64");
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}
```

- [ ] **Step 2: Update gusto.ts to import from shared module**

In `src/lib/gusto.ts`, replace the encryption section (lines 1-36, everything from imports through `decrypt` function) with:

```typescript
import { db } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";
```

Remove the `import crypto from "crypto"` line if it's only used for encryption (check if crypto is used elsewhere in the file for webhooks — if so, keep the import but remove the encryption functions only).

Verify `encrypt` and `decrypt` are no longer exported from gusto.ts — any other files importing them should switch to `@/lib/encryption`. Search for: `import { encrypt, decrypt } from "@/lib/gusto"` and update.

- [ ] **Step 3: Verify build**

```bash
npx next build 2>&1 | head -50
```

If there are import errors from other files still importing `encrypt`/`decrypt` from gusto, fix them.

- [ ] **Step 4: Commit**

```bash
git add src/lib/encryption.ts src/lib/gusto.ts
git commit -m "refactor: extract shared AES-256-GCM encryption module"
```

---

### Task 3: OAuth Infrastructure — Metadata Support

**Files:**
- Modify: `src/lib/oauth/utils.ts`
- Modify: `src/app/api/platforms/[provider]/authorize/route.ts`
- Modify: `src/app/api/platforms/[provider]/callback/route.ts`

- [ ] **Step 1: Update createOAuthState to accept metadata**

In `src/lib/oauth/utils.ts`, update `createOAuthState` (line 21-39):

```typescript
export async function createOAuthState(
  providerId: string,
  userId: string,
  metadata?: Record<string, unknown>
): Promise<string> {
  const state = generateState();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await db.oAuthState.create({
    data: {
      state,
      provider: providerId,
      userId,
      redirectUri: getCallbackUrl(providerId),
      expiresAt,
      ...(metadata ? { metadata } : {}),
    },
  });

  return state;
}
```

- [ ] **Step 2: Update validateAndConsumeState to return metadata**

In `src/lib/oauth/utils.ts`, update `validateAndConsumeState` (line 41-59):

```typescript
export async function validateAndConsumeState(
  state: string
): Promise<{
  provider: string;
  userId: string;
  redirectUri: string;
  metadata: Record<string, unknown> | null;
} | null> {
  const record = await db.oAuthState.findUnique({ where: { state } });
  if (!record) return null;
  if (record.expiresAt < new Date()) {
    await db.oAuthState.delete({ where: { id: record.id } });
    return null;
  }

  // One-time use: delete after validation
  await db.oAuthState.delete({ where: { id: record.id } });

  return {
    provider: record.provider,
    userId: record.userId,
    redirectUri: record.redirectUri,
    metadata: (record.metadata as Record<string, unknown>) ?? null,
  };
}
```

- [ ] **Step 3: Update authorize route to pass mode as metadata**

In `src/app/api/platforms/[provider]/authorize/route.ts`, find where `createOAuthState` is called in the real OAuth path (around line 71). Read the `mode` query param and pass it:

```typescript
// Before the createOAuthState call:
const mode = url.searchParams.get("mode");
const metadata = mode ? { mode } : undefined;
const state = await createOAuthState(providerId, userId, metadata);
```

Replace the existing `const state = await createOAuthState(providerId, userId);` line with the above.

- [ ] **Step 4: Update callback route for google_calendar branching**

In `src/app/api/platforms/[provider]/callback/route.ts`, after the Gusto branch (line 64-75), add the google_calendar branch:

```typescript
  // 6b. Google Calendar personal sync
  if (
    providerId === "google_calendar" &&
    stateData.metadata?.mode === "personal"
  ) {
    try {
      const { handleGoogleCalendarCallback } = await import(
        "@/lib/google-calendar-sync"
      );
      await handleGoogleCalendarCallback(tokens, {
        userId: stateData.userId,
      });
      const calendarUrl = new URL("/calendar", baseUrl);
      calendarUrl.searchParams.set("oauth_success", "Google Calendar");
      return NextResponse.redirect(calendarUrl);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Google Calendar connection failed";
      settingsUrl.searchParams.set("oauth_error", message);
      return NextResponse.redirect(settingsUrl);
    }
  }
```

This goes BEFORE the `RecruitmentPlatform` upsert (line 77). When `mode` is absent, the existing code still falls through to `RecruitmentPlatform` for system-level calendar connects.

- [ ] **Step 5: Verify build**

```bash
npx next build 2>&1 | head -50
```

This will fail because `@/lib/google-calendar-sync` doesn't exist yet — that's expected and fine. The dynamic import means it won't crash at build time.

- [ ] **Step 6: Commit**

```bash
git add src/lib/oauth/utils.ts src/app/api/platforms/
git commit -m "feat: add OAuth metadata support and google_calendar callback branching"
```

---

### Task 4: Google Calendar Sync Module

**Files:**
- Create: `src/lib/google-calendar-sync.ts`

- [ ] **Step 1: Create the per-user Google Calendar sync module**

Create `src/lib/google-calendar-sync.ts`:

```typescript
import { db } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";
import { getOAuthProvider, getOAuthCredentials } from "@/lib/oauth/config";

// ── Types ──────────────────────────────────────────────────

export type GoogleCalendarEvent = {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  htmlLink?: string;
};

// ── Token refresh (per-user mutex) ─────────────────────────

const refreshLocks = new Map<string, Promise<void>>();

async function ensureValidToken(
  userId: string
): Promise<{ accessToken: string }> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      googleCalendarAccessToken: true,
      googleCalendarRefreshToken: true,
      googleCalendarTokenExpiresAt: true,
      googleCalendarSyncEnabled: true,
    },
  });

  if (
    !user ||
    !user.googleCalendarSyncEnabled ||
    !user.googleCalendarAccessToken ||
    !user.googleCalendarRefreshToken
  ) {
    throw new Error("Google Calendar is not connected");
  }

  const now = new Date();
  const bufferMs = 5 * 60 * 1000;
  const expiresAt = user.googleCalendarTokenExpiresAt ?? new Date(0);

  if (expiresAt.getTime() - bufferMs > now.getTime()) {
    return { accessToken: decrypt(user.googleCalendarAccessToken) };
  }

  // Deduplicate concurrent refresh calls per user
  if (!refreshLocks.has(userId)) {
    const promise = (async () => {
      try {
        const provider = getOAuthProvider("google_calendar");
        const creds = provider ? getOAuthCredentials(provider) : null;
        if (!provider || !creds) throw new Error("Google Calendar OAuth not configured");

        const body = new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: decrypt(user.googleCalendarRefreshToken!),
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
        });

        const res = await fetch(provider.tokenUrl, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString(),
        });

        if (!res.ok) {
          // Mark as disconnected on refresh failure
          await db.user.update({
            where: { id: userId },
            data: { googleCalendarSyncEnabled: false },
          });
          throw new Error("Google Calendar token refresh failed");
        }

        const tokens = await res.json();
        await db.user.update({
          where: { id: userId },
          data: {
            googleCalendarAccessToken: encrypt(tokens.access_token),
            ...(tokens.refresh_token
              ? { googleCalendarRefreshToken: encrypt(tokens.refresh_token) }
              : {}),
            googleCalendarTokenExpiresAt: new Date(
              Date.now() + (tokens.expires_in ?? 3600) * 1000
            ),
          },
        });
      } finally {
        refreshLocks.delete(userId);
      }
    })();
    refreshLocks.set(userId, promise);
  }

  await refreshLocks.get(userId);

  const refreshed = await db.user.findUnique({
    where: { id: userId },
    select: { googleCalendarAccessToken: true },
  });
  if (!refreshed?.googleCalendarAccessToken) {
    throw new Error("Token refresh failed");
  }
  return { accessToken: decrypt(refreshed.googleCalendarAccessToken) };
}

// ── API helpers ────────────────────────────────────────────

async function googleFetch<T>(
  userId: string,
  path: string,
  options?: RequestInit
): Promise<T> {
  const { accessToken } = await ensureValidToken(userId);
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google Calendar API error ${res.status}: ${text}`);
  }

  return res.json();
}

// ── Public API ─────────────────────────────────────────────

export async function fetchGoogleCalendarEvents(
  userId: string,
  timeMin: string,
  timeMax: string
): Promise<GoogleCalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });

  const data = await googleFetch<{ items?: GoogleCalendarEvent[] }>(
    userId,
    `/calendars/primary/events?${params}`
  );

  return data.items ?? [];
}

export async function pushEventToGoogleCalendar(
  userId: string,
  event: {
    summary: string;
    description?: string;
    location?: string;
    startDateTime: string;
    endDateTime: string;
  }
): Promise<string> {
  const created = await googleFetch<{ id: string }>(
    userId,
    "/calendars/primary/events",
    {
      method: "POST",
      body: JSON.stringify({
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: { dateTime: event.startDateTime },
        end: { dateTime: event.endDateTime },
      }),
    }
  );
  return created.id;
}

export async function deleteEventFromGoogleCalendar(
  userId: string,
  googleEventId: string
): Promise<void> {
  const { accessToken } = await ensureValidToken(userId);
  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
}

// ── OAuth callback handler ─────────────────────────────────

export async function handleGoogleCalendarCallback(
  tokens: {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  },
  context: { userId: string }
): Promise<void> {
  await db.user.update({
    where: { id: context.userId },
    data: {
      googleCalendarAccessToken: encrypt(tokens.access_token),
      googleCalendarRefreshToken: tokens.refresh_token
        ? encrypt(tokens.refresh_token)
        : undefined,
      googleCalendarTokenExpiresAt: new Date(
        Date.now() + (tokens.expires_in ?? 3600) * 1000
      ),
      googleCalendarSyncEnabled: true,
    },
  });
}
```

- [ ] **Step 2: Verify build**

```bash
npx next build 2>&1 | head -50
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/google-calendar-sync.ts
git commit -m "feat: add per-user Google Calendar sync module with token management"
```

---

### Task 5: Calendar Sync Server Actions

**Files:**
- Create: `src/lib/actions/calendar-sync.ts`

- [ ] **Step 1: Create calendar sync server actions**

Create `src/lib/actions/calendar-sync.ts`:

```typescript
"use server";

import { db } from "@/lib/db";

export async function getCalendarSyncStatus(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      googleCalendarSyncEnabled: true,
      googleCalendarAccessToken: true,
    },
  });
  return {
    connected: !!(user?.googleCalendarSyncEnabled && user?.googleCalendarAccessToken),
  };
}

export async function disconnectGoogleCalendar(userId: string) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  if (session.user?.id !== userId) {
    throw new Error("Not authorized");
  }

  await db.user.update({
    where: { id: userId },
    data: {
      googleCalendarAccessToken: null,
      googleCalendarRefreshToken: null,
      googleCalendarTokenExpiresAt: null,
      googleCalendarSyncEnabled: false,
    },
  });
}

export async function getGoogleCalendarEvents(
  userId: string,
  timeMin: string,
  timeMax: string
) {
  const { fetchGoogleCalendarEvents } = await import(
    "@/lib/google-calendar-sync"
  );
  return fetchGoogleCalendarEvents(userId, timeMin, timeMax);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/calendar-sync.ts
git commit -m "feat: add calendar sync server actions"
```

---

### Task 6: Feed Events Server Actions

**Files:**
- Create: `src/lib/actions/feed-events.ts`

- [ ] **Step 1: Create feed events server actions**

Create `src/lib/actions/feed-events.ts`:

```typescript
"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function createFeedEvent(data: {
  authorId: string;
  content: string;
  eventDate: string;
  eventEndDate: string;
  eventLocation?: string;
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
    },
  });

  // Async email notification (fire-and-forget)
  sendFeedPostNotificationAsync(post.id, data.authorId).catch((err) =>
    console.error("[feed-events] notification error:", err)
  );

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

  // Get the event post for calendar push context
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

  // Get existing attendance to check for Google Calendar event cleanup
  const existing = await db.eventAttendance.findUnique({
    where: {
      feedPostId_userId: {
        feedPostId: data.feedPostId,
        userId: data.userId,
      },
    },
  });

  // Upsert attendance
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
      // Don't throw — RSVP saved locally even if calendar push fails
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
  return { going, maybe, total: going.length + maybe.length };
}

// ── Email notification helper ──────────────────────────────

async function sendFeedPostNotificationAsync(
  postId: string,
  authorEmployeeId: string
) {
  const post = await db.feedPost.findUnique({
    where: { id: postId },
    include: { author: { select: { firstName: true, lastName: true } } },
  });
  if (!post) return;

  // Only notify for user-created post types
  const notifyTypes = ["GENERAL", "SHOUTOUT", "EVENT"];
  if (!notifyTypes.includes(post.type)) return;

  const authorName = `${post.author.firstName} ${post.author.lastName}`;

  // Get all users with notifications enabled, excluding author
  const users = await db.user.findMany({
    where: {
      emailNotificationsEnabled: true,
      employee: {
        status: "ACTIVE",
        id: { not: authorEmployeeId },
      },
    },
    select: { email: true },
  });

  if (users.length === 0) return;

  const { sendFeedPostNotification } = await import("@/lib/email");
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  const isEvent = post.type === "EVENT";
  const subject = isEvent
    ? `New event: ${post.content.slice(0, 60)}`
    : `New post from ${authorName}`;

  let bodyHtml = `<p style="margin:0 0 12px">${post.content}</p>`;
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
      bodyHtml += `<p style="margin:0 0 12px;color:#666"><strong>Where:</strong> ${post.eventLocation}</p>`;
    }
  }

  const ctaLabel = isEvent ? "RSVP in App" : "View in App";
  bodyHtml += `<p style="margin:16px 0 0"><a href="${baseUrl}" style="display:inline-block;padding:12px 24px;background:#3052FF;color:white;text-decoration:none;border-radius:8px;font-weight:600">${ctaLabel}</a></p>`;

  const emails = users.map((u) => u.email);
  await sendFeedPostNotification(emails, subject, bodyHtml);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/feed-events.ts
git commit -m "feat: add feed events server actions with RSVP and Google Calendar push"
```

---

### Task 7: Email Batch Notification

**Files:**
- Modify: `src/lib/email.ts`

- [ ] **Step 1: Add sendFeedPostNotification function**

At the bottom of `src/lib/email.ts` (after the last exported function, around line 259), add:

```typescript
export async function sendFeedPostNotification(
  recipients: string[],
  subject: string,
  bodyHtml: string
) {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY not set — skipping feed notification`);
    return;
  }

  const branding = await getCompanyBranding();
  const senderName = branding.senderName.replace(/[<>"]/g, "").trim();
  const senderEmail = branding.senderEmail.trim();
  const from = senderName ? `${senderName} <${senderEmail}>` : senderEmail;
  const html = wrapHtml(bodyHtml, branding.companyName, branding.logoUrl);

  // Chunk into batches of 100 (Resend batch limit)
  const BATCH_SIZE = 100;
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const chunk = recipients.slice(i, i + BATCH_SIZE);
    try {
      await resend.batch.send(
        chunk.map((to) => ({ from, to, subject, html }))
      );
      console.log(
        `[email] Feed notification batch sent: ${chunk.length} recipients`
      );
    } catch (error) {
      console.error(`[email] Feed notification batch error:`, error);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/email.ts
git commit -m "feat: add batch email notification for feed posts"
```

---

## Chunk 2: Feed UI — Event Creation + Event Card

### Task 8: Create Event Dialog

**Files:**
- Create: `src/components/feed/create-event-dialog.tsx`

- [ ] **Step 1: Create the event creation dialog**

Create `src/components/feed/create-event-dialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { createFeedEvent } from "@/lib/actions/feed-events";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";

export function CreateEventDialog({
  employeeId,
  onClose,
}: {
  employeeId: string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventEndDate, setEventEndDate] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !eventDate || !eventEndDate) return;
    setLoading(true);
    try {
      await createFeedEvent({
        authorId: employeeId,
        content: title.trim(),
        eventDate,
        eventEndDate,
        eventLocation: eventLocation.trim() || undefined,
      });
      router.refresh();
      onClose();
    } catch (err) {
      console.error("Failed to create event:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className={cn(
          "w-full max-w-lg rounded-2xl p-6",
          "bg-[var(--color-surface)] border border-[var(--color-border)]"
        )}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Create Event
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[var(--color-surface-hover)]"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-[var(--color-text-muted)] mb-1 block">
              Event Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Team lunch, all-hands meeting..."
              required
              className={cn(
                "w-full rounded-lg px-3 py-2 text-sm",
                "bg-[var(--color-background)] border border-[var(--color-border)]",
                "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
                "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-[var(--color-text-muted)] mb-1 block">
                Start
              </label>
              <input
                type="datetime-local"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                required
                className={cn(
                  "w-full rounded-lg px-3 py-2 text-sm",
                  "bg-[var(--color-background)] border border-[var(--color-border)]",
                  "text-[var(--color-text-primary)]",
                  "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
                )}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--color-text-muted)] mb-1 block">
                End
              </label>
              <input
                type="datetime-local"
                value={eventEndDate}
                onChange={(e) => setEventEndDate(e.target.value)}
                required
                className={cn(
                  "w-full rounded-lg px-3 py-2 text-sm",
                  "bg-[var(--color-background)] border border-[var(--color-border)]",
                  "text-[var(--color-text-primary)]",
                  "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
                )}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-[var(--color-text-muted)] mb-1 block">
              Location (optional)
            </label>
            <input
              value={eventLocation}
              onChange={(e) => setEventLocation(e.target.value)}
              placeholder="Office, Zoom link, restaurant..."
              className={cn(
                "w-full rounded-lg px-3 py-2 text-sm",
                "bg-[var(--color-background)] border border-[var(--color-border)]",
                "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
                "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
              )}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || !eventDate || !eventEndDate || loading}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium",
                "bg-[var(--color-accent)] text-white",
                "hover:bg-[var(--color-accent-hover)]",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {loading ? "Creating..." : "Create Event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/feed/create-event-dialog.tsx
git commit -m "feat: add event creation dialog component"
```

---

### Task 9: Event Card Component

**Files:**
- Create: `src/components/feed/event-card.tsx`

- [ ] **Step 1: Create the event card component**

Create `src/components/feed/event-card.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { cn, timeAgo, getInitials } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { upsertEventAttendance, getEventAttendees } from "@/lib/actions/feed-events";
import type { AttendanceStatus } from "@/generated/prisma/client";

type EventPostProps = {
  post: {
    id: string;
    content: string;
    eventDate: Date | null;
    eventEndDate: Date | null;
    eventLocation: string | null;
    createdAt: Date;
    author: {
      id: string;
      firstName: string;
      lastName: string;
      jobTitle: string;
      profilePhoto?: string | null;
    };
  };
  currentUserId: string;
  currentEmployeeId: string;
  reactionsBar: React.ReactNode;
  commentsSection: React.ReactNode;
};

const avatarColors = [
  "bg-indigo-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-purple-500",
  "bg-cyan-500",
];

export function EventCard({
  post,
  currentUserId,
  currentEmployeeId,
  reactionsBar,
  commentsSection,
}: EventPostProps) {
  const [myStatus, setMyStatus] = useState<AttendanceStatus | null>(null);
  const [goingCount, setGoingCount] = useState(0);
  const [maybeCount, setMaybeCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const initials = getInitials(post.author.firstName, post.author.lastName);
  const colorIdx = post.author.firstName.charCodeAt(0) % avatarColors.length;

  useEffect(() => {
    getEventAttendees(post.id).then((data) => {
      setGoingCount(data.going.length);
      setMaybeCount(data.maybe.length);
      const mine = [...data.going, ...data.maybe].find(
        (a) => a.user.id === currentUserId
      );
      if (mine) setMyStatus(mine.status);
    });
  }, [post.id, currentUserId]);

  async function handleRSVP(status: AttendanceStatus) {
    setLoading(true);
    try {
      await upsertEventAttendance({
        feedPostId: post.id,
        userId: currentUserId,
        status,
      });
      // Refresh counts
      const data = await getEventAttendees(post.id);
      setGoingCount(data.going.length);
      setMaybeCount(data.maybe.length);
      setMyStatus(status);
    } catch (err) {
      console.error("RSVP failed:", err);
    } finally {
      setLoading(false);
    }
  }

  const eventDate = post.eventDate
    ? new Date(post.eventDate).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <article
      className={cn(
        "rounded-2xl overflow-hidden",
        "bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-purple-500/5",
        "border border-blue-400/20"
      )}
    >
      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Icon name="event" size={20} className="text-blue-500" />
          <span className="text-sm font-medium text-blue-600">Event</span>
          <span className="text-sm text-[var(--color-text-muted)]">
            · {timeAgo(post.createdAt)}
          </span>
        </div>

        {/* Author */}
        <div className="flex items-center gap-3 mb-3">
          {post.author.profilePhoto ? (
            <img
              src={post.author.profilePhoto}
              alt=""
              className="h-10 w-10 rounded-full object-cover shrink-0"
            />
          ) : (
            <div
              className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0",
                avatarColors[colorIdx]
              )}
            >
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[var(--color-text-primary)]">
              {post.author.firstName} {post.author.lastName}
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">
              {post.author.jobTitle}
            </p>
          </div>
        </div>

        {/* Event title */}
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
          {post.content}
        </h3>

        {/* Event details */}
        <div className="space-y-1.5 mb-4">
          {eventDate && (
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
              <Icon name="schedule" size={16} />
              <span>{eventDate}</span>
            </div>
          )}
          {post.eventLocation && (
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
              <Icon name="location_on" size={16} />
              <span>{post.eventLocation}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <Icon name="group" size={16} />
            <span>
              {goingCount} going{maybeCount > 0 ? `, ${maybeCount} maybe` : ""}
            </span>
          </div>
        </div>

        {/* RSVP buttons */}
        <div className="flex gap-2 mb-4">
          {(["GOING", "MAYBE", "NOT_GOING"] as const).map((status) => {
            const isActive = myStatus === status;
            const labels: Record<string, { label: string; icon: string }> = {
              GOING: { label: "Going", icon: "check_circle" },
              MAYBE: { label: "Maybe", icon: "help" },
              NOT_GOING: { label: "Can't go", icon: "cancel" },
            };
            const { label, icon } = labels[status];
            return (
              <button
                key={status}
                onClick={() => handleRSVP(status)}
                disabled={loading}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors",
                  isActive
                    ? "bg-[var(--color-accent)] text-white"
                    : "bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]",
                  loading && "opacity-50"
                )}
              >
                <Icon name={icon} size={16} />
                {label}
              </button>
            );
          })}
        </div>

        <div className="pt-3 border-t border-blue-400/20">
          {reactionsBar}
          {commentsSection}
        </div>
      </div>
    </article>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/feed/event-card.tsx
git commit -m "feat: add event card component with RSVP buttons"
```

---

### Task 10: Integrate Event Card into PostCard + Add Event Button to PostComposer

**Files:**
- Modify: `src/components/feed/post-card.tsx`
- Modify: `src/components/feed/post-composer.tsx`
- Modify: `src/app/(dashboard)/page.tsx`

- [ ] **Step 1: Update PostWithRelations type and add EVENT rendering in PostCard**

In `src/components/feed/post-card.tsx`:

Update the `PostWithRelations` type (line 11-23) to include event fields:

```typescript
type PostWithRelations = {
  id: string;
  content: string;
  type: string;
  pinned: boolean;
  createdAt: Date;
  eventDate?: Date | null;
  eventEndDate?: Date | null;
  eventLocation?: string | null;
  author: { id: string; firstName: string; lastName: string; jobTitle: string; pronouns?: string | null; profilePhoto?: string | null };
  mentionedEmployee?: { id: string; firstName: string; lastName: string; jobTitle: string } | null;
  reactions: { id: string; type: string; employeeId: string }[];
  comments: { id: string; content: string; createdAt: Date; author: { id: string; firstName: string; lastName: string } }[];
  attachments?: { id: string; url: string; type: string; name: string }[];
  _count: { comments: number; reactions: number };
};
```

Add `currentUserId` prop to the component:

```typescript
export function PostCard({
  post,
  currentEmployeeId,
  currentUserId,
  userRole,
}: {
  post: PostWithRelations;
  currentEmployeeId: string;
  currentUserId?: string;
  userRole?: string;
}) {
```

Before the SHOUTOUT check (line 159), add the EVENT rendering. Import EventCard at the top:

```typescript
import { EventCard } from "@/components/feed/event-card";
```

Then before `if (post.type === "SHOUTOUT" ...`:

```typescript
  if (post.type === "EVENT" && currentUserId) {
    return (
      <EventCard
        post={post as any}
        currentUserId={currentUserId}
        currentEmployeeId={currentEmployeeId}
        reactionsBar={reactionsBar}
        commentsSection={commentsSection}
      />
    );
  }
```

- [ ] **Step 2: Add Event button to PostComposer**

In `src/components/feed/post-composer.tsx`:

Import CreateEventDialog at the top:

```typescript
import { CreateEventDialog } from "@/components/feed/create-event-dialog";
```

Add state for showing the dialog inside the component (after existing state declarations around line 36):

```typescript
const [showEventDialog, setShowEventDialog] = useState(false);
```

In the button bar (after the Shoutout button, around line 348), add:

```tsx
          <button
            onClick={() => setShowEventDialog(true)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors",
              "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
            )}
          >
            <Icon name="event" size={16} />
            Event
          </button>
```

Before the closing `</div>` of the component (before line 364's final `</div>`), add:

```tsx
      {showEventDialog && (
        <CreateEventDialog
          employeeId={employeeId}
          onClose={() => setShowEventDialog(false)}
        />
      )}
```

- [ ] **Step 3: Pass currentUserId to PostCard in feed page**

In `src/app/(dashboard)/page.tsx`, update the PostCard usage to include `currentUserId`:

```tsx
          <PostCard
            key={post.id}
            post={post as any}
            currentEmployeeId={session.user.employeeId || ""}
            currentUserId={session.user.id}
            userRole={session.user.role}
          />
```

- [ ] **Step 4: Update getFeedPosts to include event fields**

In `src/lib/actions/feed.ts`, update `getFeedPosts` (line 7-19) to include the new event fields in the select/include. Add these fields to the `findMany`:

```typescript
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
```

Note: since FeedPost now has `eventDate`, `eventEndDate`, and `eventLocation` as model fields, they are automatically included in the default query result. No changes needed here — Prisma returns all scalar fields by default.

- [ ] **Step 5: Verify build**

```bash
npx next build 2>&1 | head -50
```

- [ ] **Step 6: Commit**

```bash
git add src/components/feed/ src/app/\(dashboard\)/page.tsx src/lib/actions/feed.ts
git commit -m "feat: integrate event card into feed with create event button"
```

---

## Chunk 3: Calendar Page + Google Calendar Connect

### Task 11: Google Calendar Connect Component

**Files:**
- Create: `src/components/calendar/google-calendar-connect.tsx`

- [ ] **Step 1: Create Google Calendar connect component**

Create `src/components/calendar/google-calendar-connect.tsx`:

```tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { disconnectGoogleCalendar } from "@/lib/actions/calendar-sync";
import { useRouter } from "next/navigation";

export function GoogleCalendarConnect({
  connected,
  userId,
}: {
  connected: boolean;
  userId: string;
}) {
  const [disconnecting, setDisconnecting] = useState(false);
  const router = useRouter();

  async function handleDisconnect() {
    if (!confirm("Disconnect Google Calendar? Your synced events will remain in Google Calendar.")) return;
    setDisconnecting(true);
    try {
      await disconnectGoogleCalendar(userId);
      router.refresh();
    } catch (err) {
      console.error("Failed to disconnect:", err);
    } finally {
      setDisconnecting(false);
    }
  }

  if (connected) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-emerald-600">
          <Icon name="check_circle" size={16} />
          <span>Google Calendar connected</span>
        </div>
        <button
          onClick={handleDisconnect}
          disabled={disconnecting}
          className="text-sm text-red-500 hover:text-red-600 underline"
        >
          {disconnecting ? "Disconnecting..." : "Disconnect"}
        </button>
      </div>
    );
  }

  return (
    <a
      href="/api/platforms/google_calendar/authorize?mode=personal"
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
        "bg-[var(--color-accent)] text-white",
        "hover:bg-[var(--color-accent-hover)] transition-colors"
      )}
    >
      <Icon name="calendar_month" size={16} />
      Connect Google Calendar
    </a>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/calendar/google-calendar-connect.tsx
git commit -m "feat: add Google Calendar connect/disconnect component"
```

---

### Task 12: Enhance Calendar Page

**Files:**
- Modify: `src/app/(dashboard)/calendar/page.tsx`
- Modify: `src/components/calendar/calendar-view.tsx` (type update)

- [ ] **Step 1: Update CalendarEvent type to support new event types**

In `src/components/calendar/calendar-view.tsx`, update the `CalendarEvent` type (line 8-17) to add new types:

```typescript
export type CalendarEvent = {
  id: string;
  name: string;
  date: string; // ISO string
  type: "birthday" | "anniversary" | "benefits" | "interview" | "holiday-jewish" | "holiday-muslim" | "holiday-christian" | "holiday-american" | "feed-event" | "google-calendar";
  department?: string;
  years?: number;
  meetLink?: string | null;
  time?: string;
  endDate?: string;
  location?: string;
};
```

Add chip styles for the new types in `chipStyles` (around line 39):

```typescript
const chipStyles: Record<string, string> = {
  birthday: "bg-[var(--color-tertiary-container)]/10 text-[var(--color-tertiary)]",
  anniversary: "bg-[var(--color-tertiary-fixed)] text-[var(--color-on-tertiary-fixed-variant)]",
  interview: "bg-[var(--color-primary)]/10 text-[var(--color-primary)]",
  benefits: "bg-[var(--color-primary-fixed)] text-[var(--color-on-primary-fixed-variant)]",
  "feed-event": "bg-blue-500/10 text-blue-600",
  "google-calendar": "bg-emerald-500/10 text-emerald-600",
};
```

- [ ] **Step 2: Update calendar page to include feed events and Google Calendar events**

Replace `src/app/(dashboard)/calendar/page.tsx` with:

```tsx
import { requireAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { CalendarView, type CalendarEvent } from "@/components/calendar/calendar-view";
import { getUpcomingInterviews } from "@/lib/actions/interviews";
import { getHolidaysForYear } from "@/lib/holidays";
import { getCalendarSyncStatus } from "@/lib/actions/calendar-sync";
import { GoogleCalendarConnect } from "@/components/calendar/google-calendar-connect";
import { CalendarGoogleEvents } from "@/components/calendar/calendar-google-events";

export default async function CalendarPage() {
  const session = await requireAuth();
  const role = session.user?.role;
  const userId = session.user?.id;
  const isManagerOrAbove = role === "SUPER_ADMIN" || role === "ADMIN" || role === "HR" || role === "MANAGER";

  const [employees, interviews, syncStatus, feedEvents] = await Promise.all([
    db.employee.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        birthday: true,
        anniversaryDate: true,
        benefitsEligibleDate: true,
        startDate: true,
        department: { select: { name: true } },
      },
    }),
    isManagerOrAbove ? getUpcomingInterviews() : Promise.resolve([]),
    userId ? getCalendarSyncStatus(userId) : { connected: false },
    db.feedPost.findMany({
      where: { type: "EVENT", eventDate: { not: null } },
      select: {
        id: true,
        content: true,
        eventDate: true,
        eventEndDate: true,
        eventLocation: true,
      },
    }),
  ]);

  const now = new Date();
  const currentYear = now.getFullYear();
  const events: CalendarEvent[] = [];

  for (const emp of employees) {
    const name = `${emp.firstName} ${emp.lastName}`;
    const department = emp.department?.name || undefined;

    if (emp.birthday) {
      const bd = emp.birthday;
      events.push({
        id: `bday-${emp.id}`,
        name,
        date: new Date(currentYear, bd.getMonth(), bd.getDate()).toISOString(),
        type: "birthday",
        department,
      });
    }

    if (emp.anniversaryDate) {
      const ad = emp.anniversaryDate;
      const years = currentYear - emp.startDate.getFullYear();
      events.push({
        id: `anniv-${emp.id}`,
        name,
        date: new Date(currentYear, ad.getMonth(), ad.getDate()).toISOString(),
        type: "anniversary",
        department,
        years,
      });
    }

    if (emp.benefitsEligibleDate && isManagerOrAbove) {
      const bed = emp.benefitsEligibleDate;
      events.push({
        id: `benefits-${emp.id}`,
        name,
        date: new Date(bed.getFullYear(), bed.getMonth(), bed.getDate()).toISOString(),
        type: "benefits",
        department,
      });
    }
  }

  for (const interview of interviews) {
    const candidateName = `${interview.candidate.firstName} ${interview.candidate.lastName}`;
    const d = new Date(interview.scheduledAt);
    events.push({
      id: `interview-${interview.id}`,
      name: candidateName,
      date: d.toISOString(),
      type: "interview",
      meetLink: interview.googleMeetLink,
      time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
    });
  }

  const holidays = getHolidaysForYear(currentYear);
  for (const h of holidays) {
    events.push({
      id: `holiday-${h.category}-${h.name.replace(/\s/g, "-").toLowerCase()}`,
      name: h.name,
      date: h.date.toISOString(),
      type: `holiday-${h.category}` as CalendarEvent["type"],
    });
  }

  // Feed events
  for (const fe of feedEvents) {
    if (fe.eventDate) {
      events.push({
        id: `feed-event-${fe.id}`,
        name: fe.content.slice(0, 80),
        date: fe.eventDate.toISOString(),
        type: "feed-event",
        endDate: fe.eventEndDate?.toISOString(),
        location: fe.eventLocation || undefined,
      });
    }
  }

  // Show success/error from OAuth redirect
  const successParam = typeof globalThis !== "undefined" ? "" : "";

  return (
    <div className="px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Calendar</h1>
        {userId && (
          <GoogleCalendarConnect connected={syncStatus.connected} userId={userId} />
        )}
      </div>
      {syncStatus.connected && userId ? (
        <CalendarGoogleEvents
          events={events}
          userId={userId}
        />
      ) : (
        <CalendarView events={events} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create CalendarGoogleEvents client wrapper**

Create `src/components/calendar/calendar-google-events.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { CalendarView, type CalendarEvent } from "@/components/calendar/calendar-view";
import { getGoogleCalendarEvents } from "@/lib/actions/calendar-sync";

export function CalendarGoogleEvents({
  events: serverEvents,
  userId,
}: {
  events: CalendarEvent[];
  userId: string;
}) {
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>(serverEvents);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch Google Calendar events for current month ± 1 month
    const now = new Date();
    const timeMin = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const timeMax = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

    getGoogleCalendarEvents(userId, timeMin, timeMax)
      .then((googleEvents) => {
        const mapped: CalendarEvent[] = googleEvents.map((ge) => ({
          id: `gcal-${ge.id}`,
          name: ge.summary || "Untitled",
          date: ge.start.dateTime || ge.start.date || "",
          type: "google-calendar" as const,
          endDate: ge.end.dateTime || ge.end.date || undefined,
          location: ge.location || undefined,
        }));
        setAllEvents([...serverEvents, ...mapped]);
      })
      .catch((err) => {
        console.error("Failed to fetch Google Calendar events:", err);
        setError("Failed to load Google Calendar events");
      });
  }, [userId, serverEvents]);

  return (
    <div>
      {error && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-red-500/10 text-red-500 text-sm">
          {error}
        </div>
      )}
      <CalendarView events={allEvents} />
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

```bash
npx next build 2>&1 | head -50
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/calendar/ src/components/calendar/
git commit -m "feat: enhance calendar page with feed events and Google Calendar sync"
```

---

## Chunk 4: Email Notification Toggle + Notification Integration

### Task 13: Email Notification Toggle on My Profile

**Files:**
- Modify: `src/app/(dashboard)/my-profile/page.tsx`
- Create: `src/components/my-profile/email-notification-toggle.tsx`

- [ ] **Step 1: Create email notification toggle component**

Create `src/components/my-profile/email-notification-toggle.tsx`:

```tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

export function EmailNotificationToggle({
  userId,
  enabled,
}: {
  userId: string;
  enabled: boolean;
}) {
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    try {
      const { toggleEmailNotifications } = await import(
        "@/lib/actions/calendar-sync"
      );
      await toggleEmailNotifications(userId, !isEnabled);
      setIsEnabled(!isEnabled);
    } catch (err) {
      console.error("Failed to toggle notifications:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center">
          <Icon name="notifications" size={16} className="text-[var(--color-accent)]" />
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            Email Notifications
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            Receive emails for new feed posts and events
          </p>
        </div>
      </div>
      <button
        onClick={handleToggle}
        disabled={loading}
        className={cn(
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
          isEnabled ? "bg-[var(--color-accent)]" : "bg-[var(--color-border)]",
          loading && "opacity-50"
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 rounded-full bg-white transition-transform",
            isEnabled ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add toggleEmailNotifications server action**

In `src/lib/actions/calendar-sync.ts`, add at the bottom:

```typescript
export async function toggleEmailNotifications(
  userId: string,
  enabled: boolean
) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  if (session.user?.id !== userId) {
    throw new Error("Not authorized");
  }

  await db.user.update({
    where: { id: userId },
    data: { emailNotificationsEnabled: enabled },
  });
}
```

- [ ] **Step 3: Add notification toggle and Google Calendar connect to my-profile page**

In `src/app/(dashboard)/my-profile/page.tsx`:

Add imports at the top:

```typescript
import { EmailNotificationToggle } from "@/components/my-profile/email-notification-toggle";
import { GoogleCalendarConnect } from "@/components/calendar/google-calendar-connect";
import { getCalendarSyncStatus } from "@/lib/actions/calendar-sync";
```

After the existing data fetches (after `const profile = await getMyProfile(...)` around line 31), add:

```typescript
  const syncStatus = await getCalendarSyncStatus(session.user.id);
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { emailNotificationsEnabled: true },
  });
```

Add a new "Preferences" section after the "Emergency Contact" section (around line 137), inside the `lg:col-span-2` column:

```tsx
          {/* Preferences */}
          <section className={cn("rounded-[var(--radius-lg)] bg-[var(--color-surface-container-lowest)] p-6")}>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Preferences</h2>
            <div className="space-y-4">
              <EmailNotificationToggle
                userId={session.user.id}
                enabled={user?.emailNotificationsEnabled ?? true}
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center">
                    <Icon name="calendar_month" size={16} className="text-[var(--color-accent)]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">Google Calendar</p>
                    <p className="text-xs text-[var(--color-text-muted)]">Sync your calendar events</p>
                  </div>
                </div>
                <GoogleCalendarConnect connected={syncStatus.connected} userId={session.user.id} />
              </div>
            </div>
          </section>
```

Add `import { db } from "@/lib/db";` at the top if not already present.

- [ ] **Step 4: Verify build**

```bash
npx next build 2>&1 | head -50
```

- [ ] **Step 5: Commit**

```bash
git add src/components/my-profile/ src/app/\(dashboard\)/my-profile/ src/lib/actions/calendar-sync.ts
git commit -m "feat: add email notification toggle and Google Calendar connect to profile"
```

---

### Task 14: Trigger Email Notifications on Feed Post Creation

**Files:**
- Modify: `src/lib/actions/feed.ts`

- [ ] **Step 1: Add email notification trigger to createFeedPost and createShoutoutPost**

In `src/lib/actions/feed.ts`, update `createFeedPost` (line 21-48) to trigger notifications after creating the post:

After `revalidatePath("/");` (line 46), before `return post;`, add:

```typescript
  // Async email notification (fire-and-forget)
  if (data.type === "GENERAL" || !data.type) {
    import("@/lib/actions/feed-events").then(({ default: _, ...mod }) => {
      // Trigger notification via the helper in feed-events
    }).catch(() => {});
  }
```

Actually, the notification logic is already inside `createFeedEvent` for EVENT type. For GENERAL and SHOUTOUT, we need to call the same notification helper. The cleanest approach: extract the notification helper and call it from both places.

Update `createFeedPost` in `src/lib/actions/feed.ts` to add after `revalidatePath("/");`:

```typescript
  // Fire-and-forget email notification for user-created posts
  sendPostNotification(post.id, data.authorId).catch((err) =>
    console.error("[feed] notification error:", err)
  );
```

Similarly update `createShoutoutPost` after `revalidatePath("/");`:

```typescript
  sendPostNotification(post.id, authorId).catch((err) =>
    console.error("[feed] notification error:", err)
  );
```

Add this helper function at the bottom of `src/lib/actions/feed.ts`:

```typescript
async function sendPostNotification(postId: string, authorEmployeeId: string) {
  const post = await db.feedPost.findUnique({
    where: { id: postId },
    include: { author: { select: { firstName: true, lastName: true } } },
  });
  if (!post) return;

  const notifyTypes = ["GENERAL", "SHOUTOUT"];
  if (!notifyTypes.includes(post.type)) return;

  const authorName = `${post.author.firstName} ${post.author.lastName}`;
  const users = await db.user.findMany({
    where: {
      emailNotificationsEnabled: true,
      employee: { status: "ACTIVE", id: { not: authorEmployeeId } },
    },
    select: { email: true },
  });

  if (users.length === 0) return;

  const { sendFeedPostNotification } = await import("@/lib/email");
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const subject = `New post from ${authorName}`;
  const bodyHtml = `
    <p style="margin:0 0 12px">${post.content}</p>
    <p style="margin:16px 0 0">
      <a href="${baseUrl}" style="display:inline-block;padding:12px 24px;background:#3052FF;color:white;text-decoration:none;border-radius:8px;font-weight:600">View in App</a>
    </p>
  `;

  await sendFeedPostNotification(
    users.map((u) => u.email),
    subject,
    bodyHtml
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npx next build 2>&1 | head -50
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/feed.ts
git commit -m "feat: add email notifications for feed post and shoutout creation"
```

---

## Chunk 5: Final Integration + Verification

### Task 15: Verify Full Integration

**Files:**
- All modified files

- [ ] **Step 1: Run full build**

```bash
cd /Users/baralezrah/hr-platform
npx next build
```

Fix any type errors or import issues.

- [ ] **Step 2: Run Prisma generate to ensure schema is in sync**

```bash
npx prisma generate
```

- [ ] **Step 3: Verify the migration was applied**

```bash
npx prisma migrate status
```

- [ ] **Step 4: Start dev server and smoke test**

```bash
npx next dev
```

Verify in browser:
- Feed page (`/`): "Event" button appears in post composer, creating an event works
- Event cards render with RSVP buttons in the feed
- Calendar page (`/calendar`): Feed events appear, "Connect Google Calendar" button shows
- My Profile (`/my-profile`): Preferences section with email notification toggle and Google Calendar connect
- RSVP on an event updates attendee count

- [ ] **Step 5: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve integration issues from calendar sync + feed events"
```
