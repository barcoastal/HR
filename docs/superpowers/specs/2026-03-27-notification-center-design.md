# Notification Center Design

## Goal

Build a full notification system for the HR platform: a configurable settings matrix controlling who receives notifications (email + in-app) for which actions, a working notification bell with dropdown and full page, and per-post email targeting for feed posts/events.

## Architecture

Three independent pieces:

1. **Notification rules engine** — `NotificationRule` table + server actions to read/write rules + lookup function used by all notification senders
2. **In-app notification UI** — bell icon with unread count, dropdown panel, full `/notifications` page, mark-as-read
3. **Feed email targeting** — per-post email recipient selection (all, departments, specific people, none)

All notification senders (candidates, signing, onboarding, feed) check the rules engine before sending. The rules engine replaces the current `stageNotifyRecipients`/`stageNotifyEmployeeIds` fields on CompanySettings.

**Out of scope for v1:** TimeOff request/approval notifications, review cycle notifications, emergency alerts. These can be added as new action types later without changing the architecture.

## Tech Stack

- Next.js App Router (server components + client components)
- Prisma ORM (PostgreSQL)
- Resend (email)
- Existing UI patterns (Dialog, Icon, cn utility, CSS variables)

---

## Data Model

### NotificationRule

Stores one row per action × channel × recipient combination.

```prisma
model NotificationRule {
  id        String   @id @default(uuid())
  action    String   // enum-like: see ACTION_TYPES below
  channel   String   // "EMAIL" or "IN_APP"
  recipient String   // "candidate", "recruiter", "manager", "hr_team"
  enabled   Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([action, channel, recipient])
  @@index([action])
}
```

**ACTION_TYPES:**

| Action Key | Description |
|---|---|
| `STAGE_CHANGE` | Candidate moved to a new pipeline stage |
| `OFFER_SENT` | Offer letter sent to candidate |
| `OFFER_SIGNED` | Candidate signed offer letter |
| `DOCUMENT_SIGN_REQUEST` | Document sent for signing |
| `DOCUMENT_SIGNED` | Document signing completed |
| `INTERVIEW_SCHEDULED` | Interview scheduled with candidate |
| `NEW_HIRE` | Candidate hired, onboarding started |
| `TASK_ASSIGNED` | Onboarding/offboarding task assigned |
| `ONBOARDING_COMPLETED` | Employee completed onboarding/pre-onboarding |

**RECIPIENT_TYPES:**

| Recipient Key | Email | In-App | Description |
|---|---|---|---|
| `candidate` | Yes | No | The candidate (no platform account) |
| `recruiter` | Yes | Yes | Assigned recruiter on the candidate |
| `manager` | Yes | Yes | Assigned manager/hiring manager |
| `hr_team` | Yes | Yes | Extra HR employee IDs (separate config) |

**CHANNEL_TYPES:** `EMAIL`, `IN_APP`

Note: `candidate` + `IN_APP` combinations are not valid (candidates don't have accounts). The UI hides this column under in-app.

**Recipient resolution:** `Candidate.recruiterId` and `Candidate.managerId` are bare `String?` fields with no Prisma relation. The `sendNotifications()` function resolves them via manual `db.employee.findUnique({ where: { id } })` lookup — not via relation traversal. For employee-centric actions (TASK_ASSIGNED, ONBOARDING_COMPLETED), recruiter/manager are looked up from the original candidate record if available, otherwise those recipient types simply don't resolve (no notification sent for that recipient).

### NotificationRecipient (extra HR team members)

Keep the existing `stageNotifyEmployeeIds` concept but move it to its own table for cleanliness:

```prisma
model NotificationRecipient {
  id         String   @id @default(uuid())
  employeeId String
  createdAt  DateTime @default(now())

  employee   Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)

  @@unique([employeeId])
}
```

Note: requires adding `notificationRecipients NotificationRecipient[]` relation field on the Employee model.

These are the "HR team" recipients — employees who always get notified for any action where `hr_team` is enabled.

### FeedPost changes

Add email targeting fields to the existing `FeedPost` model:

```prisma
// Add to existing FeedPost model:
notifyViaEmail   Boolean @default(true)
emailTargetType  String  @default("all")  // "all", "departments", "specific", "none"
emailTargetIds   String? // JSON array — department IDs when emailTargetType="departments", employee IDs when emailTargetType="specific". Null when "all" or "none".
```

Default is `notifyViaEmail: true, emailTargetType: "all"` to match current behavior (emailing all employees). This avoids a silent breaking change.

### Notification model (existing, no changes needed)

```prisma
model Notification {
  id          String   @id @default(uuid())
  recipientId String
  type        String
  message     String
  link        String?
  read        Boolean  @default(false)
  createdAt   DateTime @default(now())

  recipient   Employee @relation(fields: [recipientId], references: [id], onDelete: Cascade)
  @@index([recipientId])
}
```

---

## Migration

### Database migration

1. Create `NotificationRule` table
2. Create `NotificationRecipient` table
3. Add `notifyViaEmail`, `emailTargetType`, `emailTargetIds` to `FeedPost`
4. Add `notificationRecipients` relation on Employee model

### Data migration (runs after schema migration, in a transaction)

1. Seed default `NotificationRule` rows for all action × channel × recipient combinations (see defaults table below)
2. Read `CompanySettings.stageNotifyRecipients` → override `STAGE_CHANGE` rules to match existing settings
3. Read `CompanySettings.stageNotifyEmployeeIds` → create `NotificationRecipient` rows
4. Old fields remain on CompanySettings (no breaking change)

Order matters: seed defaults first, then apply existing settings overrides for `STAGE_CHANGE`. All other action types get fresh defaults since they were previously hardcoded.

If migration fails, the transaction rolls back — no partial state.

**Default rules (seeded):**

| Action | Email | In-App |
|---|---|---|
| STAGE_CHANGE | candidate ✓, recruiter ✓, manager ✓, hr_team ✓ | recruiter ✓, manager ✓, hr_team ✓ |
| OFFER_SENT | candidate ✓, recruiter ✓ | recruiter ✓ |
| OFFER_SIGNED | recruiter ✓, hr_team ✓ | recruiter ✓, hr_team ✓ |
| DOCUMENT_SIGN_REQUEST | candidate ✓ | — |
| DOCUMENT_SIGNED | recruiter ✓, hr_team ✓ | recruiter ✓, hr_team ✓ |
| INTERVIEW_SCHEDULED | candidate ✓, recruiter ✓ | recruiter ✓ |
| NEW_HIRE | candidate ✓, recruiter ✓, manager ✓, hr_team ✓ | recruiter ✓, manager ✓, hr_team ✓ |
| TASK_ASSIGNED | — | recruiter ✓ |
| ONBOARDING_COMPLETED | recruiter ✓, manager ✓, hr_team ✓ | recruiter ✓, manager ✓, hr_team ✓ |

---

## Rules Engine

### Core lookup function

```typescript
// src/lib/notifications/rules.ts

export async function getEnabledRecipients(
  action: string,
  channel: "EMAIL" | "IN_APP"
): Promise<string[]>
// Returns array of enabled recipient keys, e.g. ["candidate", "recruiter", "hr_team"]
// If no rules exist for the action (e.g. fresh install before seed), returns [] — fail-closed.

export async function getHrTeamEmployeeIds(): Promise<string[]>
// Returns employee IDs from NotificationRecipient table

export async function shouldNotify(
  action: string,
  channel: "EMAIL" | "IN_APP",
  recipient: string
): Promise<boolean>
// Quick check for a single action+channel+recipient
```

### Send notification helper

```typescript
// src/lib/notifications/send.ts

export async function sendNotifications(params: {
  action: string;
  candidateId?: string;   // For candidate-centric actions (stage change, offer, interview)
  employeeId?: string;    // For employee-centric actions (task assigned, onboarding completed)
  message: string;        // In-app notification message
  link?: string;          // In-app notification link (e.g. "/cv", "/onboarding")
  emailSubject?: string;  // Email subject line
  emailBody?: string;     // Email HTML body
}): Promise<void>
```

This function:
1. Looks up enabled recipients for both EMAIL and IN_APP channels via rules engine
2. Resolves actual email addresses and employee IDs:
   - `candidate`: looks up candidate email from `candidateId`
   - `recruiter`: looks up `candidate.recruiterId` → `employee.email` (manual ID lookup)
   - `manager`: looks up `candidate.managerId` → `employee.email` (manual ID lookup)
   - `hr_team`: looks up all `NotificationRecipient` employee IDs → emails
3. Sends emails to enabled email recipients (individual failures logged, don't block others)
4. Creates `Notification` records for enabled in-app recipients
5. All non-blocking (fire-and-forget with error logging)

**Error handling:** Missing rules = no notifications (fail-closed). Missing email on employee = skip that recipient. Resend API errors = logged, don't block other recipients. Each recipient is independent — one failure doesn't prevent others from being notified.

All notification senders across the codebase call this single function instead of manually constructing email/notification logic. This centralizes the rules check.

---

## Settings UI — Notification Matrix

### Component

`src/components/settings/notification-settings.tsx` — replaces `StageNotificationSettings`

### Authorization

Only accessible to `SUPER_ADMIN` and `ADMIN` roles. The settings page already requires admin via `requireAdmin()`.

### Layout

Matrix grid with:
- **Rows:** 9 action types
- **Column groups:** Email (candidate, recruiter, manager, HR team) | In-App (recruiter, manager, HR team)
- **Cells:** Checkboxes
- **Below matrix:** HR Team Recipients — searchable employee picker with pills (same as current)
- **Save button:** Saves all rules in one batch

### Behavior

- On mount: fetches all `NotificationRule` rows + `NotificationRecipient` list. Shows skeleton loading state while fetching.
- Checkboxes update local state
- Save button writes all rules + recipients in one server action call
- Shows "Saved!" confirmation on success, error toast on failure
- Candidate × In-App cells are hidden (not applicable)
- Last-write-wins if two admins edit simultaneously (acceptable for small team)

### Server actions

```typescript
// src/lib/actions/notification-settings.ts

export async function getNotificationRules(): Promise<NotificationRule[]>
export async function saveNotificationRules(
  rules: { action: string; channel: string; recipient: string; enabled: boolean }[],
  hrTeamEmployeeIds: string[]
): Promise<void>
```

Both actions require `SUPER_ADMIN` or `ADMIN` role.

---

## Notification Bell & Dropdown

### Bell Icon (top bar)

Existing decorative bell in `src/components/layout/top-bar.tsx` becomes functional:

- Fetches unread count on mount (server action)
- Shows red badge with count (hidden when 0, "9+" cap)
- Click toggles dropdown panel
- Polls `getUnreadCount()` every 30 seconds (pauses when tab is hidden via `document.visibilitychange`)

### Dropdown Panel

Client component: `src/components/notifications/notification-dropdown.tsx`

Contents:
- Header: "Notifications" + "Mark all read" button
- Loading spinner on first open while fetching
- List of last 10 notifications, newest first
- Each item: blue dot (unread), message text, relative timestamp (e.g. "2m ago")
- Click item → navigates to `link`, marks as read
- Closes on outside click or navigation
- Footer: "View all notifications" link → `/notifications`
- Empty state: "No notifications"

### Server Actions

```typescript
// src/lib/actions/notifications.ts

export async function getNotifications(params?: {
  limit?: number;
  offset?: number;
  type?: string;       // Filter by notification type category
}): Promise<{ notifications: Notification[]; total: number; unreadCount: number }>

export async function getUnreadCount(): Promise<number>

export async function markAsRead(id: string): Promise<void>

export async function markAllAsRead(): Promise<void>
```

All actions are scoped to the current user's employee ID (from session).

---

## Full Notifications Page

### Route

`src/app/(dashboard)/notifications/page.tsx`

### Layout

- PageHeader: "Notifications" with "Mark all read" button
- Filter dropdown with type categories
- Notification list with "Load more" pagination (20 per page)
- Click notification → navigates to link and marks as read
- Empty state: "No notifications" (or "No notifications matching this filter" when filtered)

### Filter categories → action type mapping

| Filter Label | Notification Types |
|---|---|
| All | (no filter) |
| Stage Changes | `STAGE_CHANGE` |
| Offers & Signing | `OFFER_SENT`, `OFFER_SIGNED`, `DOCUMENT_SIGN_REQUEST`, `DOCUMENT_SIGNED` |
| Hiring & Onboarding | `NEW_HIRE`, `TASK_ASSIGNED`, `ONBOARDING_COMPLETED` |
| Interviews | `INTERVIEW_SCHEDULED` |
| Feed | `FEED_POST`, `FEED_EVENT`, `FEED_COMMENT`, `FEED_REACTION`, `FEED_SHOUTOUT` |
| Promotions | `PROMOTION` |

---

## Feed Post/Event Email Targeting

### Separate path from rules engine

Feed email targeting is intentionally **separate** from the `NotificationRule` system. Rationale: the rules engine controls role-based recipients for structured HR actions (candidate → recruiter/manager/HR). Feed posts are broadcast-style with ad-hoc audience selection by the author. Combining them would add complexity with no benefit.

Feed **in-app** notifications also bypass the rules engine — they always create records for all active employees.

### UI Changes

In the feed post creation form and event creation form, add an email section:

```
📧 Send email notification
  ○ All employees           (default — matches current behavior)
  ○ Specific departments    → [department picker]
  ○ Specific people         → [employee picker]
  ○ Don't send email
```

### Behavior

- Default: "All employees" (preserves current behavior — no silent breaking change)
- Radio buttons control `notifyViaEmail`, `emailTargetType`, `emailTargetIds`
- Department picker: multi-select from existing departments
- People picker: searchable employee list with pills
- On submit: post is created, then email is sent only to selected recipients
- Email targeting is set at creation time and cannot be edited after (email is already sent)

### Email sending logic

Replace the current `sendPostNotificationEmail` function:

```typescript
// Updated flow:
1. If emailTargetType === "none" → skip email entirely
2. If emailTargetType === "all" → email all active employees with emailNotificationsEnabled
3. If emailTargetType === "departments" → email employees in selected departments with emailNotificationsEnabled
4. If emailTargetType === "specific" → email selected employees only (still respect emailNotificationsEnabled)
5. Always respect per-user emailNotificationsEnabled toggle
```

### In-app notifications for feed

Feed posts/events create in-app `Notification` records for all active employees. This wires up the currently broken notification bell for feed activity. For a team of ~50-100 employees, this creates manageable record counts. If the table grows large, a periodic cleanup job can purge notifications older than 90 days.

---

## Code Migration

1. Replace all manual notification sending in `candidates.ts`, `signing.ts`, `employees.ts`, `interviews.ts` with calls to `sendNotifications()`
2. Replace `getStageNotifyRecipients()` / `getStageNotifyEmployeeIds()` calls with rules engine
3. Replace `StageNotificationSettings` component with new `NotificationSettings` matrix
4. Update `feed.ts` / `feed-events.ts` to use targeted email logic instead of `sendPostNotificationEmail`
5. Wire up notification bell in top bar
6. Build `/notifications` page

---

## Files to Create

| File | Purpose |
|---|---|
| `prisma/migrations/xxx_notification_rules/migration.sql` | Schema migration |
| `src/lib/notifications/rules.ts` | Rules engine — lookup functions |
| `src/lib/notifications/send.ts` | Centralized send function |
| `src/lib/actions/notification-settings.ts` | Settings CRUD server actions |
| `src/lib/actions/notifications.ts` | Notification fetch/read server actions |
| `src/components/settings/notification-settings.tsx` | Settings matrix UI |
| `src/components/notifications/notification-dropdown.tsx` | Bell dropdown panel |
| `src/components/notifications/notification-bell.tsx` | Bell icon with unread count |
| `src/app/(dashboard)/notifications/page.tsx` | Full notifications page |

## Files to Modify

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add NotificationRule, NotificationRecipient models; add fields to FeedPost; add relation on Employee |
| `src/components/layout/top-bar.tsx` | Replace decorative bell with NotificationBell component |
| `src/lib/actions/candidates.ts` | Replace manual notification logic with `sendNotifications()` |
| `src/lib/actions/signing.ts` | Add notification calls for sign request/completion |
| `src/lib/actions/employees.ts` | Add notification calls for hire/onboarding completion |
| `src/lib/actions/interviews.ts` | Replace manual email with `sendNotifications()` |
| `src/lib/actions/feed.ts` | Replace `sendPostNotificationEmail` with targeted email logic |
| `src/lib/actions/feed-events.ts` | Same as feed.ts |
| `src/components/feed/create-post-form.tsx` (or equivalent) | Add email targeting UI |
| `src/app/(dashboard)/settings/page.tsx` | Replace StageNotificationSettings with NotificationSettings |
