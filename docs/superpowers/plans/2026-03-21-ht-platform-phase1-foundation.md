# HT Platform Phase 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build basic real-time messaging with channels and DMs — text-only, functional, deployed.

**Architecture:** Next.js server actions write messages to PostgreSQL via Prisma. A separate `ws` WebSocket server on Railway broadcasts events to connected clients. The chat lives at `/chat` with its own layout (full takeover, no HR sidebar). JWT-based auth connects the two services.

**Tech Stack:** Next.js 16 (App Router), Prisma 7 + PostgreSQL, raw `ws` WebSocket, JWT (`jsonwebtoken`), React 19

**Spec:** `docs/superpowers/specs/2026-03-21-ht-platform-design.md`

---

## File Structure

### New files — Prisma & Types
- `prisma/schema.prisma` — **modify**: add chat models + Employee relations
- `src/lib/chat/ws-types.ts` — WebSocket event type definitions (shared between client and server)

### New files — Server Actions
- `src/lib/actions/chat-workspace.ts` — workspace init, get/create workspace
- `src/lib/actions/chat-channels.ts` — channel CRUD, member management
- `src/lib/actions/chat-messages.ts` — send, get (paginated), edit, delete messages
- `src/lib/actions/chat-dms.ts` — DM thread CRUD

### New files — API Routes
- `src/app/api/ws/auth/route.ts` — issue JWT for WebSocket connection
- `src/app/api/chat/broadcast/route.ts` — internal endpoint for WS server to call (or vice versa)

### New files — Chat UI
- `src/app/(chat)/layout.tsx` — chat-specific layout (full takeover, dark sidebar)
- `src/app/(chat)/chat/page.tsx` — default chat page, redirects to #general
- `src/app/(chat)/chat/[channelId]/page.tsx` — channel/DM message view
- `src/components/chat/chat-sidebar.tsx` — channel list, DM list, workspace header
- `src/components/chat/channel-header.tsx` — channel name, topic, member count
- `src/components/chat/message-list.tsx` — scrollable message feed
- `src/components/chat/message-item.tsx` — single message display
- `src/components/chat/message-input.tsx` — simple text input + send button
- `src/components/chat/chat-provider.tsx` — wires WebSocket + Zustand store for active channel
- `src/lib/chat/ws-client.ts` — WebSocket client hook (useWebSocket)
- `src/lib/chat/use-chat-store.ts` — Zustand store for chat state (channels, messages, presence)

### New files — WebSocket Server
- `ws-server/package.json` — dependencies (ws, jsonwebtoken)
- `ws-server/tsconfig.json` — TypeScript config
- `ws-server/src/index.ts` — WS server entry point
- `ws-server/src/auth.ts` — JWT validation
- `ws-server/src/rooms.ts` — channel/DM room management
- `ws-server/src/handlers.ts` — message event handlers

### Modified files
- `src/components/layout/sidebar.tsx` — add Chat link to HR sidebar
- `src/app/(dashboard)/layout.tsx` — (no changes needed, chat uses its own layout group)

---

## Task 1: Add Chat Models to Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add Phase 1 chat models to schema.prisma**

Add these models after the existing models in `prisma/schema.prisma`. Only add the models needed for Phase 1 (workspace, channels, members, messages, DMs). Also add the relation fields to the Employee model.

Add to the Employee model (after line 235, before the `@@index` lines):

```prisma
  // Chat relations
  chatMembers          ChatMember[]
  channelMemberships   ChannelMember[]
  createdChannels      Channel[]        @relation("CreatedChannels")
  chatMessages         Message[]        @relation("ChatMessages")
  dmMemberships        DmMember[]
```

Add these new models at the end of the schema file:

```prisma
// ─── HT Platform: Chat ───

enum ChatRole {
  OWNER
  ADMIN
  MEMBER
  GUEST
}

enum Presence {
  ONLINE
  AWAY
  DND
  OFFLINE
}

model ChatWorkspace {
  id        String   @id @default(uuid())
  name      String
  slug      String   @unique
  logoUrl   String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  channels  Channel[]
  members   ChatMember[]
  dmThreads DmThread[]
}

model ChatMember {
  id          String       @id @default(uuid())
  employeeId  String
  workspaceId String
  role        ChatRole     @default(MEMBER)
  status      String?
  statusEmoji String?
  presence    Presence     @default(OFFLINE)
  dndUntil    DateTime?
  joinedAt    DateTime     @default(now())

  employee    Employee     @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  workspace   ChatWorkspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@unique([employeeId, workspaceId])
}

model Channel {
  id          String       @id @default(uuid())
  workspaceId String
  name        String
  slug        String
  description String?
  topic       String?
  isPrivate   Boolean      @default(false)
  isArchived  Boolean      @default(false)
  isDefault   Boolean      @default(false)
  createdById String
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  workspace   ChatWorkspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  createdBy   Employee     @relation("CreatedChannels", fields: [createdById], references: [id])
  messages    Message[]
  members     ChannelMember[]

  @@unique([workspaceId, slug])
}

model ChannelMember {
  id         String   @id @default(uuid())
  channelId  String
  employeeId String
  isAdmin    Boolean  @default(false)
  isMuted    Boolean  @default(false)
  isStarred  Boolean  @default(false)
  lastReadAt DateTime?
  joinedAt   DateTime @default(now())

  channel    Channel  @relation(fields: [channelId], references: [id], onDelete: Cascade)
  employee   Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)

  @@unique([channelId, employeeId])
}

model Message {
  id           String    @id @default(uuid())
  channelId    String?
  dmThreadId   String?
  parentId     String?
  authorId     String
  content      String
  contentPlain String
  isEdited     Boolean   @default(false)
  isDeleted    Boolean   @default(false)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  channel      Channel?  @relation(fields: [channelId], references: [id], onDelete: Cascade)
  dmThread     DmThread? @relation(fields: [dmThreadId], references: [id], onDelete: Cascade)
  parent       Message?  @relation("ThreadReplies", fields: [parentId], references: [id], onDelete: SetNull)
  replies      Message[] @relation("ThreadReplies")
  author       Employee  @relation("ChatMessages", fields: [authorId], references: [id])

  @@index([channelId, createdAt])
  @@index([dmThreadId, createdAt])
  @@index([parentId])
  @@index([authorId])
}

model DmThread {
  id          String   @id @default(uuid())
  workspaceId String
  isGroup     Boolean  @default(false)
  createdAt   DateTime @default(now())

  workspace   ChatWorkspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  members     DmMember[]
  messages    Message[]
}

model DmMember {
  id         String   @id @default(uuid())
  dmThreadId String
  employeeId String
  lastReadAt DateTime?
  isMuted    Boolean  @default(false)

  dmThread   DmThread @relation(fields: [dmThreadId], references: [id], onDelete: Cascade)
  employee   Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)

  @@unique([dmThreadId, employeeId])
}
```

- [ ] **Step 2: Push schema to database**

Run: `cd /Users/baralezrah/hr-platform && npx prisma db push`
Expected: Schema synced, no errors.

- [ ] **Step 3: Regenerate Prisma client**

Run: `cd /Users/baralezrah/hr-platform && npx prisma generate`
Expected: Client generated successfully.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(chat): add Phase 1 chat models — workspace, channels, messages, DMs"
```

---

## Task 2: WebSocket Event Types (Shared)

**Files:**
- Create: `src/lib/chat/ws-types.ts`

- [ ] **Step 1: Create shared WebSocket event types**

```typescript
// src/lib/chat/ws-types.ts

// ─── Client → Server events ───

export type ClientEvent =
  | { type: "subscribe"; channelId: string }
  | { type: "unsubscribe"; channelId: string }
  | { type: "typing:start"; channelId: string }
  | { type: "typing:stop"; channelId: string }
  | { type: "presence:update"; status: "online" | "away" | "dnd" }
  | { type: "ping" };

// ─── Server → Client events ───

export interface MessagePayload {
  id: string;
  channelId: string | null;
  dmThreadId: string | null;
  parentId: string | null;
  authorId: string;
  content: string;
  contentPlain: string;
  createdAt: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    profilePhoto: string | null;
  };
}

export type ServerEvent =
  | { type: "message:new"; channelId: string; message: MessagePayload }
  | { type: "message:update"; channelId: string; messageId: string; content: string; contentPlain: string }
  | { type: "message:delete"; channelId: string; messageId: string }
  | { type: "typing"; channelId: string; userId: string; displayName: string }
  | { type: "presence:update"; userId: string; status: "online" | "away" | "dnd" | "offline" }
  | { type: "unread:update"; channelId: string; count: number }
  | { type: "force-disconnect"; reason: string }
  | { type: "pong" };

// ─── Internal: Next.js → WS Server HTTP events ───

export type BroadcastEvent =
  | { type: "message:new"; channelId: string; message: MessagePayload }
  | { type: "message:update"; channelId: string; messageId: string; content: string; contentPlain: string }
  | { type: "message:delete"; channelId: string; messageId: string };
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/chat/ws-types.ts
git commit -m "feat(chat): add shared WebSocket event type definitions"
```

---

## Task 3: Server Actions — Workspace Initialization

**Files:**
- Create: `src/lib/actions/chat-workspace.ts`

- [ ] **Step 1: Create workspace server actions**

```typescript
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
  const employeeId = session.user.employeeId;

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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/chat-workspace.ts
git commit -m "feat(chat): add workspace init server action with auto-setup"
```

---

## Task 4: Server Actions — Channels

**Files:**
- Create: `src/lib/actions/chat-channels.ts`

- [ ] **Step 1: Create channel server actions**

```typescript
// src/lib/actions/chat-channels.ts
"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

export async function getChannels(workspaceId: string) {
  const session = await requireAuth();
  const employeeId = session.user.employeeId;

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
  const employeeId = session.user.employeeId;

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
  const employeeId = session.user.employeeId;

  await db.channelMember.upsert({
    where: { channelId_employeeId: { channelId, employeeId } },
    create: { channelId, employeeId },
    update: {},
  });

  revalidatePath("/chat");
}

export async function leaveChannel(channelId: string) {
  const session = await requireAuth();
  const employeeId = session.user.employeeId;

  await db.channelMember.deleteMany({
    where: { channelId, employeeId },
  });

  revalidatePath("/chat");
}

export async function updateLastRead(channelId: string) {
  const session = await requireAuth();
  const employeeId = session.user.employeeId;

  await db.channelMember.updateMany({
    where: { channelId, employeeId },
    data: { lastReadAt: new Date() },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/chat-channels.ts
git commit -m "feat(chat): add channel CRUD server actions"
```

---

## Task 5: Server Actions — Messages

**Files:**
- Create: `src/lib/actions/chat-messages.ts`

- [ ] **Step 1: Create message server actions**

```typescript
// src/lib/actions/chat-messages.ts
"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import type { BroadcastEvent, MessagePayload } from "@/lib/chat/ws-types";

const WS_SERVER_URL = process.env.WS_SERVER_URL || "http://localhost:3001";
const WS_INTERNAL_SECRET = process.env.WS_INTERNAL_SECRET || "dev-secret";

async function broadcastToWs(event: BroadcastEvent) {
  try {
    await fetch(`${WS_SERVER_URL}/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WS_INTERNAL_SECRET}`,
      },
      body: JSON.stringify(event),
    });
  } catch (error) {
    console.error("Failed to broadcast to WS server:", error);
    // Don't throw — message is saved, broadcast failure is non-critical
  }
}

export async function getMessages(
  channelId: string,
  options?: { cursor?: string; limit?: number; type?: "channel" | "dm" }
) {
  await requireAuth();

  const limit = options?.limit ?? 50;
  const isChannel = (options?.type ?? "channel") === "channel";

  const where = isChannel
    ? { channelId, isDeleted: false }
    : { dmThreadId: channelId, isDeleted: false };

  const messages = await db.message.findMany({
    where,
    take: limit + 1, // fetch one extra to check if there are more
    ...(options?.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    orderBy: { createdAt: "desc" },
    include: {
      author: {
        select: { id: true, firstName: true, lastName: true, profilePhoto: true },
      },
    },
  });

  const hasMore = messages.length > limit;
  if (hasMore) messages.pop();

  return {
    messages: messages.reverse(), // oldest first for display
    hasMore,
    nextCursor: hasMore ? messages[0]?.id : undefined,
  };
}

export async function sendMessage(data: {
  channelId: string;
  content: string;
  type?: "channel" | "dm";
}) {
  const session = await requireAuth();
  const employeeId = session.user.employeeId;
  const isChannel = (data.type ?? "channel") === "channel";

  const message = await db.message.create({
    data: {
      ...(isChannel ? { channelId: data.channelId } : { dmThreadId: data.channelId }),
      authorId: employeeId,
      content: data.content,
      contentPlain: data.content, // Phase 1: plain text only, content === contentPlain
    },
    include: {
      author: {
        select: { id: true, firstName: true, lastName: true, profilePhoto: true },
      },
    },
  });

  const payload: MessagePayload = {
    id: message.id,
    channelId: message.channelId,
    dmThreadId: message.dmThreadId,
    parentId: message.parentId,
    authorId: message.authorId,
    content: message.content,
    contentPlain: message.contentPlain,
    createdAt: message.createdAt.toISOString(),
    author: message.author,
  };

  await broadcastToWs({
    type: "message:new",
    channelId: data.channelId,
    message: payload,
  });

  return message;
}

export async function editMessage(messageId: string, content: string) {
  const session = await requireAuth();
  const employeeId = session.user.employeeId;

  const existing = await db.message.findUnique({ where: { id: messageId } });
  if (!existing || existing.authorId !== employeeId) {
    throw new Error("Unauthorized");
  }

  const message = await db.message.update({
    where: { id: messageId },
    data: { content, contentPlain: content, isEdited: true },
  });

  const channelId = message.channelId || message.dmThreadId;
  if (channelId) {
    await broadcastToWs({
      type: "message:update",
      channelId,
      messageId: message.id,
      content: message.content,
      contentPlain: message.contentPlain,
    });
  }

  return message;
}

export async function deleteMessage(messageId: string) {
  const session = await requireAuth();
  const employeeId = session.user.employeeId;

  const existing = await db.message.findUnique({ where: { id: messageId } });
  if (!existing || existing.authorId !== employeeId) {
    throw new Error("Unauthorized");
  }

  await db.message.update({
    where: { id: messageId },
    data: { isDeleted: true },
  });

  const channelId = existing.channelId || existing.dmThreadId;
  if (channelId) {
    await broadcastToWs({
      type: "message:delete",
      channelId,
      messageId,
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/chat-messages.ts
git commit -m "feat(chat): add message send/get/edit/delete server actions with WS broadcast"
```

---

## Task 6: Server Actions — DMs

**Files:**
- Create: `src/lib/actions/chat-dms.ts`

- [ ] **Step 1: Create DM server actions**

```typescript
// src/lib/actions/chat-dms.ts
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/chat-dms.ts
git commit -m "feat(chat): add DM thread server actions"
```

---

## Task 7: WebSocket Auth API Route

**Files:**
- Create: `src/app/api/ws/auth/route.ts`

- [ ] **Step 1: Install jsonwebtoken**

Run: `cd /Users/baralezrah/hr-platform && npm install jsonwebtoken && npm install -D @types/jsonwebtoken`

- [ ] **Step 2: Create WS auth endpoint**

```typescript
// src/app/api/ws/auth/route.ts
import { NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth-helpers";
import jwt from "jsonwebtoken";

const WS_JWT_SECRET = process.env.WS_JWT_SECRET || "dev-ws-secret";

export async function POST() {
  const session = await requireApiAuth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = jwt.sign(
    {
      userId: session.user.employeeId,
      email: session.user.email,
    },
    WS_JWT_SECRET,
    { expiresIn: "5m" }
  );

  return NextResponse.json({ token });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/ws/auth/route.ts package.json package-lock.json
git commit -m "feat(chat): add WS auth JWT endpoint"
```

---

## Task 8: WebSocket Server

**Files:**
- Create: `ws-server/package.json`
- Create: `ws-server/tsconfig.json`
- Create: `ws-server/src/index.ts`
- Create: `ws-server/src/auth.ts`
- Create: `ws-server/src/rooms.ts`
- Create: `ws-server/src/handlers.ts`

- [ ] **Step 1: Create ws-server package**

```json
// ws-server/package.json
{
  "name": "ht-platform-ws-server",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "ws": "^8.18.0",
    "jsonwebtoken": "^9.0.2"
  },
  "devDependencies": {
    "@types/ws": "^8.5.13",
    "@types/jsonwebtoken": "^9.0.7",
    "tsx": "^4.19.0",
    "typescript": "^5.9.3"
  }
}
```

```json
// ws-server/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 2: Install WS server dependencies**

Run: `cd /Users/baralezrah/hr-platform/ws-server && npm install`

- [ ] **Step 3: Create auth module**

```typescript
// ws-server/src/auth.ts
import jwt from "jsonwebtoken";

const WS_JWT_SECRET = process.env.WS_JWT_SECRET || "dev-ws-secret";

export interface TokenPayload {
  userId: string;
  email: string;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, WS_JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Create rooms module**

```typescript
// ws-server/src/rooms.ts
import type { WebSocket } from "ws";

// Maps channelId → Set of connected sockets
const rooms = new Map<string, Set<WebSocket>>();
// Maps socket → userId
const socketUsers = new Map<WebSocket, string>();
// Maps userId → Set of sockets (user may have multiple tabs)
const userSockets = new Map<string, Set<WebSocket>>();

export function registerSocket(ws: WebSocket, userId: string) {
  socketUsers.set(ws, userId);
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId)!.add(ws);
}

export function unregisterSocket(ws: WebSocket) {
  const userId = socketUsers.get(ws);
  if (userId) {
    userSockets.get(userId)?.delete(ws);
    if (userSockets.get(userId)?.size === 0) {
      userSockets.delete(userId);
    }
  }
  socketUsers.delete(ws);

  // Remove from all rooms
  for (const [, sockets] of rooms) {
    sockets.delete(ws);
  }
}

export function joinRoom(ws: WebSocket, channelId: string) {
  if (!rooms.has(channelId)) {
    rooms.set(channelId, new Set());
  }
  rooms.get(channelId)!.add(ws);
}

export function leaveRoom(ws: WebSocket, channelId: string) {
  rooms.get(channelId)?.delete(ws);
}

export function broadcastToRoom(channelId: string, data: string, excludeSocket?: WebSocket) {
  const sockets = rooms.get(channelId);
  if (!sockets) return;

  for (const ws of sockets) {
    if (ws !== excludeSocket && ws.readyState === ws.OPEN) {
      ws.send(data);
    }
  }
}

export function getUserId(ws: WebSocket): string | undefined {
  return socketUsers.get(ws);
}

export function isUserOnline(userId: string): boolean {
  return (userSockets.get(userId)?.size ?? 0) > 0;
}

export function getOnlineUserIds(): string[] {
  return Array.from(userSockets.keys());
}
```

- [ ] **Step 5: Create handlers module**

```typescript
// ws-server/src/handlers.ts
import type { WebSocket } from "ws";
import { joinRoom, leaveRoom, broadcastToRoom, getUserId } from "./rooms";

export function handleClientMessage(ws: WebSocket, raw: string) {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw);
  } catch {
    return;
  }

  switch (data.type) {
    case "subscribe":
      joinRoom(ws, data.channelId as string);
      break;

    case "unsubscribe":
      leaveRoom(ws, data.channelId as string);
      break;

    case "typing:start": {
      const userId = getUserId(ws);
      if (userId) {
        broadcastToRoom(
          data.channelId as string,
          JSON.stringify({
            type: "typing",
            channelId: data.channelId,
            userId,
            displayName: "", // Client fills this from local state
          }),
          ws
        );
      }
      break;
    }

    case "typing:stop":
      // Typing indicators are ephemeral — clients handle timeout
      break;

    case "ping":
      ws.send(JSON.stringify({ type: "pong" }));
      break;
  }
}

export function handleBroadcastEvent(event: Record<string, unknown>) {
  const channelId = event.channelId as string;
  if (!channelId) return;

  broadcastToRoom(channelId, JSON.stringify(event));
}
```

- [ ] **Step 6: Create server entry point**

```typescript
// ws-server/src/index.ts
import { WebSocketServer, WebSocket } from "ws";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { verifyToken } from "./auth";
import { registerSocket, unregisterSocket } from "./rooms";
import { handleClientMessage, handleBroadcastEvent } from "./handlers";
import { URL } from "url";

const PORT = parseInt(process.env.PORT || "3001", 10);
const INTERNAL_SECRET = process.env.WS_INTERNAL_SECRET || "dev-secret";

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  // Health check
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  // Internal broadcast endpoint (called by Next.js server actions)
  if (req.method === "POST" && req.url === "/broadcast") {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${INTERNAL_SECRET}`) {
      res.writeHead(401);
      res.end("Unauthorized");
      return;
    }

    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const event = JSON.parse(body);
        handleBroadcastEvent(event);
        res.writeHead(200);
        res.end("OK");
      } catch {
        res.writeHead(400);
        res.end("Invalid JSON");
      }
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
  // Extract token from query string: ws://host?token=xxx
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const token = url.searchParams.get("token");

  if (!token) {
    ws.close(4001, "Missing token");
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    ws.close(4001, "Invalid token");
    return;
  }

  registerSocket(ws, payload.userId);
  console.log(`[WS] User connected: ${payload.userId}`);

  ws.on("message", (raw) => {
    handleClientMessage(ws, raw.toString());
  });

  ws.on("close", () => {
    console.log(`[WS] User disconnected: ${payload.userId}`);
    unregisterSocket(ws);
  });

  ws.on("error", (err) => {
    console.error(`[WS] Error for ${payload.userId}:`, err.message);
  });
});

server.listen(PORT, () => {
  console.log(`[WS Server] Running on port ${PORT}`);
});
```

- [ ] **Step 7: Commit**

```bash
git add ws-server/
git commit -m "feat(chat): add WebSocket server with JWT auth, rooms, and broadcast"
```

---

## Task 9: WebSocket Client Hook

**Files:**
- Create: `src/lib/chat/ws-client.ts`

- [ ] **Step 1: Create WebSocket client hook**

```typescript
// src/lib/chat/ws-client.ts
"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { ClientEvent, ServerEvent } from "./ws-types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001";
const RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 30000;

type EventHandler = (event: ServerEvent) => void;

export function useWebSocket(onEvent: EventHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempt = useRef(0);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout>>();
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(async () => {
    // Get JWT token from auth endpoint
    let token: string;
    try {
      const res = await fetch("/api/ws/auth", { method: "POST" });
      if (!res.ok) return;
      const data = await res.json();
      token = data.token;
    } catch {
      // Schedule reconnect
      scheduleReconnect();
      return;
    }

    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      reconnectAttempt.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as ServerEvent;
        onEvent(data);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;
      scheduleReconnect();
    };

    ws.onerror = () => {
      ws.close();
    };

    function scheduleReconnect() {
      const delay = Math.min(
        RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempt.current),
        MAX_RECONNECT_DELAY_MS
      );
      reconnectAttempt.current++;
      reconnectTimeout.current = setTimeout(connect, delay);
    }
  }, [onEvent]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimeout.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((event: ClientEvent) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(event));
    }
  }, []);

  return { send, isConnected };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/chat/ws-client.ts
git commit -m "feat(chat): add WebSocket client hook with auto-reconnect"
```

---

## Task 10: Chat State Store (Zustand)

**Files:**
- Create: `src/lib/chat/use-chat-store.ts`

- [ ] **Step 1: Install zustand**

Run: `cd /Users/baralezrah/hr-platform && npm install zustand`

- [ ] **Step 2: Create chat store**

```typescript
// src/lib/chat/use-chat-store.ts
"use client";

import { create } from "zustand";
import type { MessagePayload, ServerEvent } from "./ws-types";

interface ChannelInfo {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  topic: string | null;
  isPrivate: boolean;
  isDefault: boolean;
  memberCount: number;
  isStarred: boolean;
  isMuted: boolean;
  unreadCount: number;
}

interface DmThreadInfo {
  id: string;
  isGroup: boolean;
  members: Array<{
    id: string;
    firstName: string;
    lastName: string;
    profilePhoto: string | null;
  }>;
  lastMessage?: {
    content: string;
    createdAt: string;
    authorId: string;
  };
}

interface ChatState {
  // Workspace
  workspaceId: string | null;
  workspaceName: string | null;

  // Channels
  channels: ChannelInfo[];
  activeChannelId: string | null;
  activeChannelType: "channel" | "dm";

  // Messages
  messages: Map<string, MessagePayload[]>; // channelId → messages
  hasMore: Map<string, boolean>;

  // DMs
  dmThreads: DmThreadInfo[];

  // Typing
  typingUsers: Map<string, Set<string>>; // channelId → Set<userId>

  // Actions
  setWorkspace: (id: string, name: string) => void;
  setChannels: (channels: ChannelInfo[]) => void;
  setActiveChannel: (id: string, type: "channel" | "dm") => void;
  setMessages: (channelId: string, messages: MessagePayload[], hasMore: boolean) => void;
  addMessage: (channelId: string, message: MessagePayload) => void;
  updateMessage: (channelId: string, messageId: string, content: string) => void;
  removeMessage: (channelId: string, messageId: string) => void;
  setDmThreads: (threads: DmThreadInfo[]) => void;
  handleServerEvent: (event: ServerEvent) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  workspaceId: null,
  workspaceName: null,
  channels: [],
  activeChannelId: null,
  activeChannelType: "channel",
  messages: new Map(),
  hasMore: new Map(),
  dmThreads: [],
  typingUsers: new Map(),

  setWorkspace: (id, name) => set({ workspaceId: id, workspaceName: name }),

  setChannels: (channels) => set({ channels }),

  setActiveChannel: (id, type) => set({ activeChannelId: id, activeChannelType: type }),

  setMessages: (channelId, messages, hasMore) =>
    set((state) => {
      const newMessages = new Map(state.messages);
      newMessages.set(channelId, messages);
      const newHasMore = new Map(state.hasMore);
      newHasMore.set(channelId, hasMore);
      return { messages: newMessages, hasMore: newHasMore };
    }),

  addMessage: (channelId, message) =>
    set((state) => {
      const newMessages = new Map(state.messages);
      const existing = newMessages.get(channelId) || [];
      // Deduplicate by ID (optimistic updates may already have it)
      if (!existing.some((m) => m.id === message.id)) {
        newMessages.set(channelId, [...existing, message]);
      }
      return { messages: newMessages };
    }),

  updateMessage: (channelId, messageId, content) =>
    set((state) => {
      const newMessages = new Map(state.messages);
      const existing = newMessages.get(channelId);
      if (existing) {
        newMessages.set(
          channelId,
          existing.map((m) =>
            m.id === messageId ? { ...m, content, contentPlain: content } : m
          )
        );
      }
      return { messages: newMessages };
    }),

  removeMessage: (channelId, messageId) =>
    set((state) => {
      const newMessages = new Map(state.messages);
      const existing = newMessages.get(channelId);
      if (existing) {
        newMessages.set(
          channelId,
          existing.filter((m) => m.id !== messageId)
        );
      }
      return { messages: newMessages };
    }),

  setDmThreads: (threads) => set({ dmThreads: threads }),

  handleServerEvent: (event) => {
    const state = get();
    switch (event.type) {
      case "message:new":
        state.addMessage(event.channelId, event.message);
        break;
      case "message:update":
        state.updateMessage(event.channelId, event.messageId, event.content);
        break;
      case "message:delete":
        state.removeMessage(event.channelId, event.messageId);
        break;
      case "typing": {
        set((s) => {
          const newTyping = new Map(s.typingUsers);
          const users = new Set(newTyping.get(event.channelId) || []);
          users.add(event.userId);
          newTyping.set(event.channelId, users);
          // Auto-clear after 3 seconds
          setTimeout(() => {
            set((s2) => {
              const t = new Map(s2.typingUsers);
              const u = new Set(t.get(event.channelId) || []);
              u.delete(event.userId);
              t.set(event.channelId, u);
              return { typingUsers: t };
            });
          }, 3000);
          return { typingUsers: newTyping };
        });
        break;
      }
    }
  },
}));
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/chat/use-chat-store.ts package.json package-lock.json
git commit -m "feat(chat): add Zustand chat state store"
```

---

## Task 11: Chat Layout & Sidebar UI

**Files:**
- Create: `src/app/(chat)/layout.tsx`
- Create: `src/app/(chat)/chat/page.tsx`
- Create: `src/components/chat/chat-sidebar.tsx`

- [ ] **Step 1: Create chat layout (full takeover)**

```typescript
// src/app/(chat)/layout.tsx
import { requireAuth } from "@/lib/auth-helpers";
import { ChatSidebar } from "@/components/chat/chat-sidebar";

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth();

  return (
    <div className="flex h-screen overflow-hidden">
      <ChatSidebar />
      <main className="flex-1 flex flex-col min-w-0">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Create default chat page (redirect to #general)**

```typescript
// src/app/(chat)/chat/page.tsx
import { redirect } from "next/navigation";
import { getOrCreateWorkspace } from "@/lib/actions/chat-workspace";

export default async function ChatPage() {
  const workspace = await getOrCreateWorkspace();
  const general = workspace.channels.find((c) => c.slug === "general");

  if (general) {
    redirect(`/chat/${general.id}`);
  }

  // Fallback: redirect to first channel
  if (workspace.channels.length > 0) {
    redirect(`/chat/${workspace.channels[0].id}`);
  }

  return (
    <div className="flex items-center justify-center h-full text-gray-500">
      No channels available. Create one to get started.
    </div>
  );
}
```

- [ ] **Step 3: Create chat sidebar**

```tsx
// src/components/chat/chat-sidebar.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getOrCreateWorkspace } from "@/lib/actions/chat-workspace";
import { getChannels } from "@/lib/actions/chat-channels";
import { getDmThreads } from "@/lib/actions/chat-dms";
import { useChatStore } from "@/lib/chat/use-chat-store";
import Link from "next/link";

export function ChatSidebar() {
  const router = useRouter();
  const params = useParams();
  const activeChannelId = params.channelId as string | undefined;
  const { channels, setChannels, setWorkspace, dmThreads, setDmThreads } = useChatStore();
  const [loading, setLoading] = useState(true);
  const [showNewChannel, setShowNewChannel] = useState(false);

  useEffect(() => {
    async function init() {
      const workspace = await getOrCreateWorkspace();
      setWorkspace(workspace.id, workspace.name);

      const channelList = await getChannels(workspace.id);
      setChannels(
        channelList.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          topic: c.topic,
          isPrivate: c.isPrivate,
          isDefault: c.isDefault,
          memberCount: c._count.members,
          isStarred: c.members[0]?.isStarred ?? false,
          isMuted: c.members[0]?.isMuted ?? false,
          unreadCount: 0,
        }))
      );

      const dms = await getDmThreads(workspace.id);
      setDmThreads(
        dms.map((dm) => ({
          id: dm.id,
          isGroup: dm.isGroup,
          members: dm.members.map((m) => m.employee),
          lastMessage: dm.messages[0]
            ? {
                content: dm.messages[0].contentPlain,
                createdAt: dm.messages[0].createdAt.toISOString(),
                authorId: dm.messages[0].authorId,
              }
            : undefined,
        }))
      );

      setLoading(false);
    }
    init();
  }, []);

  const starred = channels.filter((c) => c.isStarred);
  const regular = channels.filter((c) => !c.isStarred);

  return (
    <aside
      className="w-64 flex-shrink-0 flex flex-col h-full overflow-y-auto"
      style={{ backgroundColor: "#1A1D21", color: "#D1D2D3" }}
    >
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-white/10">
        <Link
          href="/"
          className="text-xs px-2 py-1 rounded hover:bg-white/10 text-gray-400 transition-colors"
        >
          &larr; HR
        </Link>
        <h1 className="text-white font-bold text-base">HT Platform</h1>
        <div className="w-10" /> {/* spacer */}
      </div>

      {/* Navigation */}
      <nav className="px-2 py-3 space-y-0.5 text-sm">
        {/* Starred channels */}
        {starred.length > 0 && (
          <>
            <p className="px-3 pt-3 pb-1 text-[11px] uppercase tracking-wider text-gray-500 font-medium">
              Starred
            </p>
            {starred.map((c) => (
              <ChannelLink key={c.id} channel={c} isActive={c.id === activeChannelId} />
            ))}
          </>
        )}

        {/* Channels */}
        <p className="px-3 pt-3 pb-1 text-[11px] uppercase tracking-wider text-gray-500 font-medium flex items-center justify-between">
          <span>Channels</span>
          <button
            onClick={() => setShowNewChannel(true)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            +
          </button>
        </p>
        {loading ? (
          <div className="px-3 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-5 bg-white/5 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          regular.map((c) => (
            <ChannelLink key={c.id} channel={c} isActive={c.id === activeChannelId} />
          ))
        )}

        {/* DMs */}
        <p className="px-3 pt-4 pb-1 text-[11px] uppercase tracking-wider text-gray-500 font-medium">
          Direct Messages
        </p>
        {dmThreads.map((dm) => (
          <DmLink key={dm.id} dm={dm} isActive={dm.id === activeChannelId} />
        ))}
      </nav>
    </aside>
  );
}

function ChannelLink({
  channel,
  isActive,
}: {
  channel: { id: string; name: string; isPrivate: boolean; unreadCount: number };
  isActive: boolean;
}) {
  return (
    <Link
      href={`/chat/${channel.id}`}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${
        isActive
          ? "bg-[#7C3AED]/20 text-white"
          : "hover:bg-white/5 text-gray-400"
      } ${channel.unreadCount > 0 ? "font-semibold text-white" : ""}`}
    >
      <span className="text-xs opacity-60">{channel.isPrivate ? "🔒" : "#"}</span>
      <span className="truncate">{channel.name}</span>
      {channel.unreadCount > 0 && (
        <span className="ml-auto text-[10px] bg-[#EF4444] text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
          {channel.unreadCount}
        </span>
      )}
    </Link>
  );
}

function DmLink({
  dm,
  isActive,
}: {
  dm: {
    id: string;
    members: Array<{ id: string; firstName: string; lastName: string; profilePhoto: string | null }>;
  };
  isActive: boolean;
}) {
  // Show other members' names (exclude current user — but we don't have userId here, so show all)
  const displayName = dm.members.map((m) => m.firstName).join(", ");

  return (
    <Link
      href={`/chat/${dm.id}?type=dm`}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${
        isActive ? "bg-[#7C3AED]/20 text-white" : "hover:bg-white/5 text-gray-400"
      }`}
    >
      <span className="w-5 h-5 rounded-full bg-gray-600 flex-shrink-0" />
      <span className="truncate text-sm">{displayName}</span>
    </Link>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(chat\)/ src/components/chat/chat-sidebar.tsx
git commit -m "feat(chat): add chat layout, default page, and sidebar UI"
```

---

## Task 12: Channel View — Message List & Input

**Files:**
- Create: `src/app/(chat)/chat/[channelId]/page.tsx`
- Create: `src/components/chat/channel-header.tsx`
- Create: `src/components/chat/message-list.tsx`
- Create: `src/components/chat/message-item.tsx`
- Create: `src/components/chat/message-input.tsx`

- [ ] **Step 1: Create channel page (server component)**

```typescript
// src/app/(chat)/chat/[channelId]/page.tsx
import { requireAuth } from "@/lib/auth-helpers";
import { getChannelById } from "@/lib/actions/chat-channels";
import { getMessages } from "@/lib/actions/chat-messages";
import { ChannelHeader } from "@/components/chat/channel-header";
import { MessageList } from "@/components/chat/message-list";
import { MessageInput } from "@/components/chat/message-input";
import { ChatProvider } from "@/components/chat/chat-provider";

interface Props {
  params: Promise<{ channelId: string }>;
  searchParams: Promise<{ type?: string }>;
}

export default async function ChannelPage({ params, searchParams }: Props) {
  await requireAuth();
  const { channelId } = await params;
  const { type } = await searchParams;
  const isDm = type === "dm";

  const channel = isDm ? null : await getChannelById(channelId);
  const { messages, hasMore } = await getMessages(channelId, {
    type: isDm ? "dm" : "channel",
  });

  const serializedMessages = messages.map((m) => ({
    id: m.id,
    channelId: m.channelId,
    dmThreadId: m.dmThreadId,
    parentId: m.parentId,
    authorId: m.authorId,
    content: m.content,
    contentPlain: m.contentPlain,
    createdAt: m.createdAt.toISOString(),
    author: m.author,
  }));

  return (
    <ChatProvider
      channelId={channelId}
      channelType={isDm ? "dm" : "channel"}
      initialMessages={serializedMessages}
      hasMore={hasMore}
    >
      <div className="flex flex-col h-full">
        <ChannelHeader
          name={channel?.name ?? "Direct Message"}
          topic={channel?.topic ?? undefined}
          memberCount={channel?._count.members ?? 0}
          isPrivate={channel?.isPrivate ?? false}
          isDm={isDm}
        />
        <MessageList />
        <MessageInput channelId={channelId} channelType={isDm ? "dm" : "channel"} />
      </div>
    </ChatProvider>
  );
}
```

- [ ] **Step 2: Create ChatProvider (wires WS + store for the active channel)**

```tsx
// src/components/chat/chat-provider.tsx
"use client";

import { useEffect, useCallback } from "react";
import { useChatStore } from "@/lib/chat/use-chat-store";
import { useWebSocket } from "@/lib/chat/ws-client";
import type { MessagePayload, ServerEvent } from "@/lib/chat/ws-types";

interface Props {
  channelId: string;
  channelType: "channel" | "dm";
  initialMessages: MessagePayload[];
  hasMore: boolean;
  children: React.ReactNode;
}

export function ChatProvider({
  channelId,
  channelType,
  initialMessages,
  hasMore,
  children,
}: Props) {
  const { setActiveChannel, setMessages, handleServerEvent } = useChatStore();

  const onEvent = useCallback(
    (event: ServerEvent) => {
      handleServerEvent(event);
    },
    [handleServerEvent]
  );

  const { send, isConnected } = useWebSocket(onEvent);

  // Set active channel and initial messages
  useEffect(() => {
    setActiveChannel(channelId, channelType);
    setMessages(channelId, initialMessages, hasMore);
  }, [channelId, channelType, initialMessages, hasMore]);

  // Subscribe to channel on WS
  useEffect(() => {
    if (isConnected) {
      send({ type: "subscribe", channelId });
      return () => {
        send({ type: "unsubscribe", channelId });
      };
    }
  }, [isConnected, channelId, send]);

  return <>{children}</>;
}
```

- [ ] **Step 3: Create channel header**

```tsx
// src/components/chat/channel-header.tsx
"use client";

interface Props {
  name: string;
  topic?: string;
  memberCount: number;
  isPrivate: boolean;
  isDm: boolean;
}

export function ChannelHeader({ name, topic, memberCount, isPrivate, isDm }: Props) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-white flex-shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        {!isDm && (
          <span className="text-gray-400 text-sm">{isPrivate ? "🔒" : "#"}</span>
        )}
        <h2 className="font-semibold text-gray-900 truncate">{name}</h2>
        {topic && (
          <span className="text-sm text-gray-500 truncate ml-2 hidden md:inline">
            {topic}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-sm text-gray-500">
        {!isDm && (
          <span className="flex items-center gap-1">
            <span className="material-symbols-rounded text-[18px]">group</span>
            {memberCount}
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create message item**

```tsx
// src/components/chat/message-item.tsx
"use client";

import type { MessagePayload } from "@/lib/chat/ws-types";

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function MessageItem({ message }: { message: MessagePayload }) {
  const { author } = message;
  const fullTime = new Date(message.createdAt).toLocaleString();

  return (
    <div className="flex gap-3 px-5 py-2 hover:bg-gray-50 group transition-colors">
      {/* Avatar */}
      {author.profilePhoto ? (
        <img
          src={author.profilePhoto}
          alt={`${author.firstName} ${author.lastName}`}
          className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-9 h-9 rounded-lg bg-[#7C3AED] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
          {getInitials(author.firstName, author.lastName)}
        </div>
      )}

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-sm text-gray-900">
            {author.firstName} {author.lastName}
          </span>
          <span
            className="text-[11px] text-gray-400 cursor-default"
            title={fullTime}
          >
            {timeAgo(message.createdAt)}
          </span>
        </div>
        <p className="text-sm text-gray-800 whitespace-pre-wrap break-words mt-0.5">
          {message.contentPlain}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create message list**

```tsx
// src/components/chat/message-list.tsx
"use client";

import { useEffect, useRef } from "react";
import { useChatStore } from "@/lib/chat/use-chat-store";
import { MessageItem } from "./message-item";

export function MessageList() {
  const { activeChannelId, messages } = useChatStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelMessages = activeChannelId ? messages.get(activeChannelId) || [] : [];

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [channelMessages.length]);

  if (channelMessages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        No messages yet. Start the conversation!
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="py-4">
        {channelMessages.map((msg) => (
          <MessageItem key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create message input**

```tsx
// src/components/chat/message-input.tsx
"use client";

import { useState, useRef, useCallback } from "react";
import { sendMessage } from "@/lib/actions/chat-messages";
import { useChatStore } from "@/lib/chat/use-chat-store";
import type { MessagePayload } from "@/lib/chat/ws-types";

interface Props {
  channelId: string;
  channelType: "channel" | "dm";
}

export function MessageInput({ channelId, channelType }: Props) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { addMessage } = useChatStore();

  const handleSubmit = useCallback(async () => {
    const text = content.trim();
    if (!text || sending) return;

    setSending(true);
    setContent("");

    // Optimistic: add a temporary message
    const tempId = `temp-${Date.now()}`;
    const optimistic: MessagePayload = {
      id: tempId,
      channelId: channelType === "channel" ? channelId : null,
      dmThreadId: channelType === "dm" ? channelId : null,
      parentId: null,
      authorId: "self", // Will be replaced by real message
      content: text,
      contentPlain: text,
      createdAt: new Date().toISOString(),
      author: { id: "self", firstName: "You", lastName: "", profilePhoto: null },
    };
    addMessage(channelId, optimistic);

    try {
      await sendMessage({ channelId, content: text, type: channelType });
    } catch (error) {
      console.error("Failed to send message:", error);
      // TODO: Show error state on the message
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }, [content, sending, channelId, channelType, addMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  return (
    <div className="px-5 py-3 border-t border-gray-200 bg-white flex-shrink-0">
      <div className="border border-gray-300 rounded-xl overflow-hidden focus-within:border-[#7C3AED] focus-within:ring-1 focus-within:ring-[#7C3AED]/20 transition-colors">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${channelType === "channel" ? "#" : ""}${channelId.slice(0, 8)}...`}
          rows={1}
          className="w-full px-4 py-3 text-sm resize-none outline-none bg-transparent"
          style={{ minHeight: "44px", maxHeight: "200px" }}
        />
        <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50/50">
          <div className="flex gap-1 text-gray-400">
            {/* Placeholder buttons for future features */}
          </div>
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || sending}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              content.trim()
                ? "bg-[#7C3AED] text-white hover:bg-[#6D28D9]"
                : "bg-gray-200 text-gray-400"
            }`}
          >
            <span className="material-symbols-rounded text-[18px]">send</span>
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add src/app/\(chat\)/chat/\[channelId\]/page.tsx src/components/chat/
git commit -m "feat(chat): add channel page, message list, message item, and input components"
```

---

## Task 13: Add Chat Link to HR Sidebar

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Add Chat link to the HR sidebar navigation**

Find the navigation links array in `src/components/layout/sidebar.tsx` and add a Chat link. It should appear near the top of the nav, accessible to all roles. Add it after the "Feed" link:

```tsx
{ href: "/chat", icon: "chat", label: "Chat", access: () => true },
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat(chat): add Chat link to HR sidebar navigation"
```

---

## Task 14: Environment Variables & Configuration

**Files:**
- Modify: `.env` or `.env.local` (if exists)

- [ ] **Step 1: Add required environment variables**

Add these environment variables to your `.env` / `.env.local` file (and to Railway for production):

```bash
# WebSocket Server
WS_JWT_SECRET=<generate-a-random-secret>
WS_INTERNAL_SECRET=<generate-a-random-secret>
WS_SERVER_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

For production on Railway, `WS_SERVER_URL` should point to the internal Railway URL of the WS server service, and `NEXT_PUBLIC_WS_URL` should point to the public WebSocket URL.

- [ ] **Step 2: Add .superpowers to .gitignore if not already there**

Check `.gitignore` and add `.superpowers/` if missing.

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: add .superpowers to gitignore"
```

---

## Task 15: Integration Test — End to End

- [ ] **Step 1: Push schema and verify**

Run: `cd /Users/baralezrah/hr-platform && npx prisma db push`
Expected: Schema pushed successfully with all new chat models.

- [ ] **Step 2: Start the WS server in a separate terminal**

Run: `cd /Users/baralezrah/hr-platform/ws-server && npm run dev`
Expected: `[WS Server] Running on port 3001`

- [ ] **Step 3: Start Next.js dev server**

Run: `cd /Users/baralezrah/hr-platform && npm run dev`

- [ ] **Step 4: Navigate to /chat and verify**

Open `http://localhost:3000/chat` in the browser. Verify:
- Redirects to `/chat/<general-channel-id>`
- Dark sidebar shows with channel list (#general, #random)
- "← HR" link in sidebar top-left returns to dashboard
- Channel header shows channel name
- Message input is functional
- Sending a message shows it in the list (optimistic update)
- Messages persist on page reload

- [ ] **Step 5: Test WebSocket connection**

Open browser DevTools → Network → WS tab. Verify:
- WebSocket connects to `ws://localhost:3001`
- `subscribe` event sent for current channel
- Sending a message from another tab/window appears in real-time

- [ ] **Step 6: Final commit — verify everything works**

```bash
git add -A
git commit -m "feat(chat): Phase 1 complete — basic real-time messaging with channels and DMs"
```

- [ ] **Step 7: Push to main for deploy**

```bash
git push origin main
```

Note: The WS server needs to be deployed as a separate Railway service. Set up a new service in Railway pointing to the `ws-server/` directory with `npm run build && npm start` as the start command.
