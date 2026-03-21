# HT Platform — Team Communication Feature for HR Platform

## Overview

HT Platform is a full-featured team communication system built into the Coastal Debt HR Platform, replacing Slack as the primary internal messaging tool. It provides real-time messaging, channels, DMs, threads, file sharing, huddles, and a Slack Migration API to import all historic data from the existing Slack workspace.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Layout | Full takeover at `/chat` | Maximizes chat space; "← HR" button returns to dashboard |
| Widget | Expandable FAB panel on all HR pages | Unobtrusive; shows recent convos + quick reply |
| WebSocket | Raw `ws` server on Railway | No dependencies, no message limits, full control |
| Composer | Minimal + expandable toolbar | Clean by default; "Aa" reveals formatting; keyboard shortcuts always work |
| Database | Shared Prisma/PostgreSQL schema | Shared user references, single deployment |
| Phasing | 7 phases, foundation first | Incremental delivery, each phase is usable |

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────┐
│                    Next.js App                       │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ /chat    │  │ Widget   │  │ /settings/import  │  │
│  │ (full)   │  │ (FAB)    │  │ (Slack migration) │  │
│  └────┬─────┘  └────┬─────┘  └────────┬──────────┘  │
│       │              │                 │             │
│  ┌────┴──────────────┴─────────────────┴──────────┐  │
│  │           Server Actions (Prisma)              │  │
│  └────────────────────┬───────────────────────────┘  │
│                       │                              │
│  ┌────────────────────┴───────────────────────────┐  │
│  │              PostgreSQL (shared)                │  │
│  └────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
         │
         │ WebSocket
         ▼
┌─────────────────────┐
│  WS Server (Railway) │
│  Raw `ws` library    │
│  Separate service    │
└─────────────────────┘
         │
         │ Slack API
         ▼
┌─────────────────────┐
│  Slack Workspace     │
│  OAuth2 + REST API   │
└─────────────────────┘
```

### WebSocket Server

A standalone Node.js service deployed on Railway alongside the Next.js app. Uses the `ws` library directly.

**Responsibilities:**
- Real-time message delivery to connected clients
- Typing indicators
- Presence tracking (online/away/DND/offline)
- Unread count broadcasting

**Authentication:** Clients request a short-lived JWT from `POST /api/ws/auth`, which issues a token containing `{ userId, workspaceId, exp }` signed with a shared secret (`WS_JWT_SECRET` env var, same value on both services). Token expires after 5 minutes (only used for the initial handshake). The WS server validates the token on connection and maps the socket to a user ID. For long-lived connections, the WS server does not re-validate — if the user's session is revoked, the Next.js app sends a `force-disconnect` event to the WS server via the internal HTTP API.

**Message flow:**
1. User sends message → Next.js server action writes to PostgreSQL
2. Server action sends event to WS server via internal HTTP call
3. WS server broadcasts to all connected clients in the channel/DM
4. Clients receive and render optimistically (message already shown locally)

### WebSocket Event Protocol

All messages are JSON with a `type` field:

```typescript
// Client → Server
{ type: "subscribe", channelId: string }
{ type: "unsubscribe", channelId: string }
{ type: "typing:start", channelId: string }
{ type: "typing:stop", channelId: string }
{ type: "presence:update", status: "online" | "away" | "dnd" }
{ type: "ping" }

// Server → Client
{ type: "message:new", channelId: string, message: Message }
{ type: "message:update", channelId: string, messageId: string, content: string }
{ type: "message:delete", channelId: string, messageId: string }
{ type: "reaction:add", channelId: string, messageId: string, emoji: string, userId: string }
{ type: "reaction:remove", channelId: string, messageId: string, emoji: string, userId: string }
{ type: "typing", channelId: string, userId: string, displayName: string }
{ type: "presence:update", userId: string, status: "online" | "away" | "dnd" | "offline" }
{ type: "unread:update", channelId: string, count: number }
{ type: "huddle:start", channelId: string, huddleId: string }
{ type: "huddle:end", channelId: string, huddleId: string }
{ type: "force-disconnect", reason: string }
{ type: "pong" }
```

### Database Schema (additions to existing Prisma schema)

```prisma
// ─── Relations to add to existing Employee model ───
// Add these fields to the Employee model in schema.prisma:
//   chatMembers        ChatMember[]
//   channelMemberships ChannelMember[]
//   createdChannels    Channel[]
//   chatMessages       Message[]
//   chatReactions      Reaction[]
//   dmMemberships      DmMember[]
//   savedMessages      SavedMessage[]
//   chatNotifications  ChatNotification[]
//   messageDrafts      MessageDraft[]
//   chatReminders      Reminder[]
//   huddleParticipations HuddleParticipant[]
//   channelBookmarksCreated ChannelBookmark[]
//   pinnedMessages     PinnedMessage[]
//   userGroupMemberships UserGroupMember[]

// ─── Chat Workspace ───
model ChatWorkspace {
  id          String   @id @default(uuid())
  name        String
  slug        String   @unique
  logoUrl     String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  channels    Channel[]
  members     ChatMember[]
  customEmoji CustomEmoji[]
  userGroups  UserGroup[]
  dmThreads   DmThread[]
  slackImports SlackImport[]
  slackSyncs  SlackSync[]
}

model ChatMember {
  id          String       @id @default(uuid())
  employeeId  String
  workspaceId String
  role        ChatRole     @default(MEMBER)
  status      String?      // status text
  statusEmoji String?      // status emoji
  presence    Presence     @default(OFFLINE)
  dndUntil    DateTime?
  joinedAt    DateTime     @default(now())

  employee    Employee     @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  workspace   ChatWorkspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@unique([employeeId, workspaceId])
}

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

// ─── Channels ───
model Channel {
  id            String       @id @default(uuid())
  workspaceId   String
  name          String
  slug          String
  description   String?
  topic         String?
  isPrivate     Boolean      @default(false)
  isArchived    Boolean      @default(false)
  isDefault     Boolean      @default(false)
  createdById   String
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  workspace     ChatWorkspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  createdBy     Employee     @relation("CreatedChannels", fields: [createdById], references: [id])
  messages      Message[]
  members       ChannelMember[]
  pins          PinnedMessage[]
  bookmarks     ChannelBookmark[]

  @@unique([workspaceId, slug])
}

model ChannelMember {
  id              String   @id @default(uuid())
  channelId       String
  employeeId      String
  isAdmin         Boolean  @default(false)
  isMuted         Boolean  @default(false)
  isStarred       Boolean  @default(false)
  notificationPref NotificationPref @default(ALL)
  lastReadAt      DateTime?
  joinedAt        DateTime @default(now())

  channel         Channel  @relation(fields: [channelId], references: [id], onDelete: Cascade)
  employee        Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)

  @@unique([channelId, employeeId])
}

enum NotificationPref {
  ALL
  MENTIONS
  NOTHING
}

// ─── Messages ───
model Message {
  id            String    @id @default(uuid())
  channelId     String?
  dmThreadId    String?
  parentId      String?
  authorId      String
  content       String    // rich text as JSON (TipTap/ProseMirror format)
  contentPlain  String    // plain text for search
  isEdited      Boolean   @default(false)
  isDeleted     Boolean   @default(false)
  scheduledFor  DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  channel       Channel?  @relation(fields: [channelId], references: [id], onDelete: Cascade)
  dmThread      DmThread? @relation(fields: [dmThreadId], references: [id], onDelete: Cascade)
  parent        Message?  @relation("ThreadReplies", fields: [parentId], references: [id], onDelete: SetNull)
  replies       Message[] @relation("ThreadReplies")
  author        Employee  @relation("ChatMessages", fields: [authorId], references: [id])
  reactions     Reaction[]
  attachments   ChatAttachment[]
  mentions      Mention[]
  pins          PinnedMessage[]
  savedBy       SavedMessage[]

  @@index([channelId, createdAt])
  @@index([dmThreadId, createdAt])
  @@index([parentId])
  @@index([authorId])
}

model Reaction {
  id        String   @id @default(uuid())
  messageId String
  employeeId String
  emoji     String

  message   Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)
  employee  Employee @relation("ChatReactions", fields: [employeeId], references: [id], onDelete: Cascade)

  @@unique([messageId, employeeId, emoji])
  @@index([messageId])
}

model Mention {
  id        String   @id @default(uuid())
  messageId String
  type      MentionType
  targetId  String

  message   Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@index([targetId, type])
  @@index([messageId])
}

enum MentionType {
  USER
  CHANNEL
  HERE
  EVERYONE
  USER_GROUP
}

// Named ChatAttachment to avoid collision with existing Attachment-like models
model ChatAttachment {
  id        String   @id @default(uuid())
  messageId String
  fileName  String
  fileType  String
  fileSize  Int
  url       String
  thumbnailUrl String?
  createdAt DateTime @default(now())

  message   Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@index([messageId])
}

// ─── Direct Messages ───
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

// ─── Pins & Bookmarks ───
model PinnedMessage {
  id        String   @id @default(uuid())
  channelId String
  messageId String
  pinnedById String
  pinnedAt  DateTime @default(now())

  channel   Channel  @relation(fields: [channelId], references: [id], onDelete: Cascade)
  message   Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)
  pinnedBy  Employee @relation(fields: [pinnedById], references: [id])

  @@unique([channelId, messageId])
}

model ChannelBookmark {
  id        String   @id @default(uuid())
  channelId String
  title     String
  url       String
  emoji     String?
  createdById String
  createdAt DateTime @default(now())

  channel   Channel  @relation(fields: [channelId], references: [id], onDelete: Cascade)
  createdBy Employee @relation("ChannelBookmarksCreated", fields: [createdById], references: [id])
}

model SavedMessage {
  id         String   @id @default(uuid())
  employeeId String
  messageId  String
  savedAt    DateTime @default(now())

  employee   Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  message    Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@unique([employeeId, messageId])
}

// ─── Custom Emoji & User Groups ───
model CustomEmoji {
  id          String   @id @default(uuid())
  workspaceId String
  name        String
  imageUrl    String
  createdById String
  createdAt   DateTime @default(now())

  workspace   ChatWorkspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, name])
}

model UserGroup {
  id          String   @id @default(uuid())
  workspaceId String
  name        String
  handle      String   // @team-handle
  description String?
  createdAt   DateTime @default(now())

  workspace   ChatWorkspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  members     UserGroupMember[]

  @@unique([workspaceId, handle])
}

model UserGroupMember {
  id          String   @id @default(uuid())
  userGroupId String
  employeeId  String
  joinedAt    DateTime @default(now())

  userGroup   UserGroup @relation(fields: [userGroupId], references: [id], onDelete: Cascade)
  employee    Employee  @relation(fields: [employeeId], references: [id], onDelete: Cascade)

  @@unique([userGroupId, employeeId])
}

// ─── Notifications ───
model ChatNotification {
  id          String   @id @default(uuid())
  employeeId  String
  type        ChatNotifType
  messageId   String?
  channelId   String?
  isRead      Boolean  @default(false)
  createdAt   DateTime @default(now())

  employee    Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)

  @@index([employeeId, isRead, createdAt])
  @@index([messageId])
}

enum ChatNotifType {
  MENTION
  DM
  THREAD_REPLY
  REACTION
  CHANNEL_INVITE
}

// ─── Slack Migration ───
model SlackImport {
  id            String       @id @default(uuid())
  workspaceId   String
  slackTeamId   String
  slackTeamName String
  accessToken   String       // encrypted
  status        ImportStatus @default(PENDING)
  config        Json         // what to import, date range, conflict resolution
  progress      Json?        // per-category progress counts
  startedAt     DateTime?
  completedAt   DateTime?
  errorLog      Json?
  createdAt     DateTime     @default(now())

  workspace     ChatWorkspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
}

enum ImportStatus {
  PENDING
  IN_PROGRESS
  PAUSED
  COMPLETED
  FAILED
  CANCELLED
}

model SlackSync {
  id            String   @id @default(uuid())
  workspaceId   String
  slackTeamId   String
  accessToken   String   // encrypted
  isActive      Boolean  @default(false)
  syncMode      SyncMode @default(ONE_WAY)
  channelMap    Json     // which Slack channels map to which HT channels
  lastSyncAt    DateTime?
  messagesSync  Int      @default(0)
  errorsToday   Int      @default(0)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  workspace     ChatWorkspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
}

enum SyncMode {
  ONE_WAY
  TWO_WAY
  SCHEDULED
}

// ─── Huddles ───
model Huddle {
  id          String   @id @default(uuid())
  channelId   String?
  dmThreadId  String?
  startedById String
  isActive    Boolean  @default(true)
  startedAt   DateTime @default(now())
  endedAt     DateTime?

  participants HuddleParticipant[]

  @@index([channelId, isActive])
  @@index([dmThreadId, isActive])
}

model HuddleParticipant {
  id         String  @id @default(uuid())
  huddleId   String
  employeeId String
  isMuted    Boolean @default(false)
  hasVideo   Boolean @default(false)
  isSharing  Boolean @default(false)

  huddle     Huddle  @relation(fields: [huddleId], references: [id], onDelete: Cascade)
  employee   Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)

  @@unique([huddleId, employeeId])
}

// ─── Drafts & Reminders ───
model MessageDraft {
  id          String   @id @default(uuid())
  employeeId  String
  channelId   String?
  dmThreadId  String?
  parentId    String?
  content     String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  employee    Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)

  @@index([employeeId])
}

model Reminder {
  id          String   @id @default(uuid())
  employeeId  String
  messageId   String?
  channelId   String?
  text        String
  remindAt    DateTime
  isCompleted Boolean  @default(false)
  createdAt   DateTime @default(now())

  employee    Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)

  @@index([employeeId, isCompleted, remindAt])
}
```

**Note on full-text search:** PostgreSQL full-text search requires a raw migration to add a `tsvector` column and GIN index on `Message.contentPlain`. This cannot be expressed in Prisma schema and will be added via `prisma migrate` with a custom SQL migration:
```sql
ALTER TABLE "Message" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', "contentPlain")) STORED;
CREATE INDEX "Message_search_idx" ON "Message" USING GIN ("search_vector");
```

## Feature Breakdown by Phase

### Phase 1: Foundation
**Goal:** Basic real-time messaging in channels and DMs.

**Scope:**
- Prisma schema: ChatWorkspace, Channel, ChannelMember, Message, DmThread, DmMember, ChatMember
- WebSocket server: connection auth, channel subscriptions, message broadcast, presence
- Server actions: `createChannel`, `sendMessage`, `getMessages` (paginated), `getChannels`, `createDmThread`, `getDmThreads`
- Basic `/chat` page with channel list sidebar and message feed
- Simple text-only message input (no rich text yet)
- Optimistic message sending
- Auto-create workspace + #general + #random on first access
- Auto-create ChatMember for all employees

### Phase 2: Rich Messaging
**Goal:** Full message composer and display with all formatting and features.

**Scope:**
- Rich text editor using TipTap (ProseMirror-based, works well with React)
- Formatting: bold, italic, strikethrough, inline code, code blocks, bullet/numbered lists, blockquotes, links
- Emoji picker with search + custom emoji support
- @mentions: users, channels, @here, @channel, @everyone — with autocomplete dropdown
- File uploads: drag & drop + button, store in Railway volume or S3-compatible storage
- Image/file preview in messages, lightbox for images
- Reactions: add/remove emoji reactions, show who reacted
- Message actions: edit, delete, pin, save/bookmark, copy link, mark unread
- Syntax-highlighted code blocks (using Prism.js or Shiki)
- Link previews with Open Graph card fetching

### Phase 3: Chat UI Polish
**Goal:** Complete the full-screen layout and floating widget.

**Scope:**
- Full `/chat` layout: dark sidebar (#1A1D21), channel list, starred channels, DM list, threads link, files link, people link
- Channel header: name, topic, member count, pinned count, search, call button, settings
- Thread panel: right-side slide panel, "Also send to channel" checkbox, thread participant avatars
- Floating FAB widget: expandable panel with recent convos, unread badges, quick reply, "Open full chat"
- Sidebar: workspace name, collapsible channel sections, unread bold + count badges, user profile at bottom
- Channel settings modal: edit name/topic/description, manage members, notification preferences, mute, archive
- User profile modal: avatar, display name, title, status emoji + text, timezone
- Dark mode + light mode with system preference detection
- Skeleton loaders for message list, channel list
- Keyboard shortcuts: Cmd+K (search), Cmd+N (new message), Esc (close panels)
- Mobile responsive: collapsible sidebar, touch-friendly

### Phase 4: Search & Notifications
**Goal:** Global search and notification system.

**Scope:**
- Global search (Cmd+K): search messages, files, channels, people
- Search filters: `from:`, `in:`, `before:`, `after:`, `has:link`, `has:file`, `has:reaction`
- Search results grouped by type with message previews and highlighted matches
- Quick switcher: type to jump to any channel, DM, or person
- Recent searches history
- PostgreSQL full-text search on `contentPlain` field
- Desktop push notifications (browser Notification API)
- In-app notification bell with dropdown
- ChatNotification model: mentions, DMs, thread replies, reactions
- Per-channel notification preferences: all, mentions only, nothing
- DND mode with schedule
- Unread tracking: `lastReadAt` on ChannelMember/DmMember, unread count calculation

### Phase 5: Huddles & Calls
**Goal:** Live audio/video calling within channels and DMs.

**Scope:**
- Huddle button in channel/DM header
- WebRTC for peer-to-peer audio/video
- Huddle UI: participant avatars in circle, mute/unmute, camera toggle, screen share, leave
- Active huddle indicator in sidebar (green dot + participant count)
- Huddle model tracks active sessions and participants
- Screen sharing via `getDisplayMedia` API
- Signaling via the existing WebSocket server
- TURN/STUN servers: use Cloudflare TURN (free tier) or Twilio TURN for NAT traversal — required for remote employees behind firewalls

### Phase 6: Slack Migration
**Goal:** Import all data from an existing Slack workspace.

**Scope:**
- `/settings/import` — multi-step wizard UI
- Step 1: Slack OAuth2 connection — connect workspace, input API token, test connection
- Step 2: Select what to import — toggleable checklist (users, channels, messages, threads, reactions, pins, files, emoji, user groups), date range selector, estimated size
- Step 3: Field mapping — Slack field → HT field table, conflict resolution (skip/rename/merge)
- Step 4: Import progress — real-time dashboard with per-category progress bars, speed, ETA, live log, error log, pause/resume/cancel
- Step 5: Complete — summary report, error list, CSV download, "Go to workspace" CTA
- Slack API integration: use `@slack/web-api` package
  - `conversations.list` → channels
  - `conversations.history` → messages
  - `conversations.replies` → threads
  - `users.list` → users/profiles
  - `reactions.get` → reactions
  - `pins.list` → pins
  - `files.list` + `files.info` → file metadata + download
  - `emoji.list` → custom emoji
  - `usergroups.list` → user groups
- Rate limit handling: respect Slack's tier limits, implement exponential backoff
- Background job processing: import runs as a background job on the WS server (which is a long-running Node process, not bound by HTTP timeouts). The Next.js app triggers the import via an internal HTTP call to the WS server, which executes the Slack API calls, writes to PostgreSQL, and broadcasts progress updates over WebSocket to the client. The `api/slack/import/route.ts` endpoint provides an SSE fallback for progress if WebSocket is unavailable.
- SlackImport model tracks import state, config, progress, errors

### Phase 7: Ongoing Sync & Admin
**Goal:** Keep Slack data flowing and provide workspace administration.

**Scope:**
- `/settings/integrations/slack` — ongoing sync management
- Real-time sync: Slack Events API webhook for new messages
- Scheduled sync: cron-based pull every X hours
- Selective channel sync: choose which Slack channels stay synced
- Two-way sync: post messages from HT back to Slack via `chat.postMessage`
- Sync status dashboard: last sync time, messages today, errors
- API rate limit monitor: visual gauge
- Workspace admin settings: name, logo, default channels, permissions
- Member management: invite, deactivate, change roles (Owner/Admin/Member/Guest)
- Permissions matrix: who can create channels, post in #general, install apps
- Billing page placeholder: Free/Pro/Enterprise tier comparison
- Analytics dashboard: messages sent, active users, top channels, growth chart (using real data)
- Workflow builder placeholder: visual if/then automation builder UI
- /remind slash command: set reminders
- Scheduled messages: compose now, send later with date/time picker
- Channel welcome messages for new members

## File Structure

```
src/
├── app/
│   ├── (dashboard)/
│   │   └── chat/
│   │       ├── layout.tsx          # Full takeover layout (no HR sidebar)
│   │       ├── page.tsx            # Default → redirects to #general
│   │       └── [channelId]/
│   │           └── page.tsx        # Channel/DM message view
│   ├── api/
│   │   ├── ws/
│   │   │   └── auth/route.ts      # Issue JWT for WS connection
│   │   ├── chat/
│   │   │   ├── upload/route.ts     # File upload endpoint
│   │   │   └── og/route.ts        # Open Graph link preview fetcher
│   │   └── slack/
│   │       ├── oauth/route.ts      # Slack OAuth callback
│   │       ├── events/route.ts     # Slack Events API webhook
│   │       └── import/route.ts     # Import progress SSE stream
│   └── (dashboard)/
│       └── settings/
│           ├── import/page.tsx     # Slack import wizard
│           └── integrations/
│               └── slack/page.tsx  # Ongoing sync management
├── components/
│   └── chat/
│       ├── chat-layout.tsx         # Main chat layout container
│       ├── chat-sidebar.tsx        # Channel/DM list sidebar
│       ├── channel-header.tsx      # Channel name, topic, actions
│       ├── message-list.tsx        # Virtualized message feed
│       ├── message-item.tsx        # Single message with actions
│       ├── message-composer.tsx    # Rich text input with toolbar
│       ├── thread-panel.tsx        # Right-side thread view
│       ├── chat-widget.tsx         # Floating FAB + expandable panel
│       ├── emoji-picker.tsx        # Searchable emoji picker
│       ├── mention-autocomplete.tsx # @mention dropdown
│       ├── search-modal.tsx        # Cmd+K global search
│       ├── channel-settings.tsx    # Channel settings modal
│       ├── user-profile-modal.tsx  # User profile popup
│       ├── huddle-ui.tsx           # Huddle call interface
│       ├── notification-bell.tsx   # Notification dropdown
│       ├── file-preview.tsx        # Image/file lightbox
│       ├── link-preview.tsx        # OG card component
│       └── slack-import/
│           ├── import-wizard.tsx   # Multi-step import wizard
│           ├── step-connect.tsx    # Step 1: Connect to Slack
│           ├── step-select.tsx     # Step 2: Select data
│           ├── step-mapping.tsx    # Step 3: Field mapping
│           ├── step-progress.tsx   # Step 4: Import progress
│           └── step-complete.tsx   # Step 5: Summary
├── lib/
│   ├── actions/
│   │   ├── chat-channels.ts       # Channel CRUD
│   │   ├── chat-messages.ts       # Send, edit, delete, pin messages
│   │   ├── chat-members.ts        # Member management, presence
│   │   ├── chat-threads.ts        # Thread operations
│   │   ├── chat-dms.ts            # DM thread management
│   │   ├── chat-reactions.ts      # Add/remove reactions
│   │   ├── chat-search.ts         # Full-text search
│   │   ├── chat-notifications.ts  # Notification CRUD
│   │   ├── chat-files.ts          # File upload/management
│   │   ├── slack-import.ts        # Slack data import logic
│   │   └── slack-sync.ts          # Ongoing sync management
│   ├── chat/
│   │   ├── ws-client.ts           # WebSocket client hook
│   │   ├── ws-types.ts            # WebSocket event types
│   │   └── presence.ts            # Presence tracking logic
│   └── slack/
│       ├── api.ts                 # Slack API wrapper
│       ├── importers/
│       │   ├── users.ts           # Import users
│       │   ├── channels.ts        # Import channels
│       │   ├── messages.ts        # Import messages + threads
│       │   ├── files.ts           # Import files
│       │   ├── reactions.ts       # Import reactions
│       │   └── emoji.ts           # Import custom emoji
│       └── field-mapping.ts       # Slack → HT field mapping
ws-server/                         # At project root, separate Railway service
├── package.json
├── tsconfig.json
├── Dockerfile                     # Railway deployment config
└── src/
    ├── index.ts                   # WS server entry
    ├── auth.ts                    # JWT validation
    ├── rooms.ts                   # Channel/DM room management
    ├── presence.ts                # Online/away tracking
    ├── handlers.ts                # Message event handlers
    └── import-worker.ts           # Slack import background job runner
```

## UI Design Specifications

### Color Palette
> Note: The chat feature intentionally uses purple (#7C3AED) as its primary accent rather than the HR platform's brand blue (#3052FF). This gives the chat its own visual identity within the platform.

- **Chat sidebar:** #1A1D21 (dark)
- **Primary accent:** #7C3AED (purple)
- **Online indicator:** #22C55E (green)
- **Mention highlight:** #F59E0B (orange background tint)
- **Error/unread badge:** #EF4444 (red)
- **Light mode background:** #FFFFFF
- **Dark mode background:** #1E1E1E
- **Message hover:** #F8F9FA (light) / #2A2A2A (dark)
- **Neutral grays:** #F3F4F6, #E5E7EB, #9CA3AF, #6B7280

### Typography
- **Font:** Inter (already used in HR platform)
- **Base size:** 14px
- **Message text:** 14px / 1.5 line-height
- **Timestamps:** 11px, gray
- **Channel names:** 13px, medium weight
- **Section headers:** 11px, uppercase, gray

### Chat Layout (Full Takeover)
- Chat sidebar: 260px wide, dark background (#1A1D21)
- "← HR" button: top-left corner, subtle, returns to HR dashboard
- Main message area: flex remaining width, white/dark background
- Thread panel: 400px wide, slides in from right, pushes message area
- Channel header: 52px tall, bottom border

### Floating Widget
- FAB: 56px circle, purple (#7C3AED), bottom-right corner, 20px offset
- Unread badge: red circle on FAB
- Expanded panel: 380px wide, 480px tall, slides up from FAB position
- Panel header: dark (#1A1D21), "HT Chat" title, minimize/close buttons
- Recent conversations list with avatar, name, preview, timestamp
- Quick reply input at bottom

### Message Composer
- Border: 1.5px solid gray, 12px border-radius
- Text area: 14px, auto-grows, min-height 44px
- Bottom bar: attachments, emoji, @mention, "Aa" formatting toggle, slash commands
- "Aa" expands: bold, italic, strikethrough, code, lists, blockquote toolbar above text area
- Send button: 32px purple circle, right side
- "Send later" dropdown next to send button

### Message Display
- Avatar: 32px, 6px border-radius
- Author name: 13px, semibold
- Timestamp: 11px, gray, relative ("2m ago"), full time on hover
- Reactions: pill-shaped, 10px font, gray background, count
- Thread indicator: purple text, "N replies", participant avatars
- Hover toolbar: appears on message hover, contains react, reply, more actions
- Edited indicator: "(edited)" text after message, gray, 11px

## Key Technical Decisions

### Rich Text Editor
Use **TipTap** (built on ProseMirror). It's React-native, extensible, and handles all required formatting. Store content as TipTap JSON, with a plain-text version (`contentPlain`) for search.

### Message Virtualization
Use **react-window** or **@tanstack/virtual** for the message list. Chat can have thousands of messages — rendering all of them kills performance. Load in pages of 50, virtualize the scroll.

### File Storage
Store uploaded files on Railway volume or an S3-compatible service (e.g., Cloudflare R2). Generate thumbnails server-side for images.

### Search
PostgreSQL full-text search using `tsvector` on `contentPlain`. Add a GIN index. For the scale of an internal team tool, this is more than sufficient — no need for Elasticsearch.

### Optimistic Updates
Messages appear instantly in the sender's UI before the server confirms. If the server action fails, show an error indicator on the message with a retry button.

### WebSocket Reconnection
Client auto-reconnects with exponential backoff. On reconnect, fetch any messages missed during disconnection using the last known message timestamp.
