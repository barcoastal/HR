# Notification Center Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full notification system with configurable rules matrix, working notification bell/dropdown/page, and per-post email targeting.

**Architecture:** NotificationRule table stores action×channel×recipient enabled state. A centralized `sendNotifications()` function replaces all manual notification logic. The notification bell polls for unread count, opens a dropdown, and links to a full `/notifications` page. Feed posts get per-post email targeting controls.

**Tech Stack:** Next.js App Router, Prisma/PostgreSQL, Resend email, existing UI patterns (cn, Icon, Dialog, CSS variables)

**Spec:** `docs/superpowers/specs/2026-03-27-notification-center-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|---|---|
| `src/lib/notifications/rules.ts` | Rules engine — `getEnabledRecipients()`, `shouldNotify()`, `getHrTeamEmployeeIds()` |
| `src/lib/notifications/send.ts` | Centralized `sendNotifications()` — resolves recipients, sends email + creates in-app |
| `src/lib/actions/notification-settings.ts` | Server actions for settings CRUD — `getNotificationRules()`, `saveNotificationRules()` |
| `src/lib/actions/notifications.ts` | Server actions for notification UI — `getNotifications()`, `getUnreadCount()`, `markAsRead()`, `markAllAsRead()` |
| `src/components/settings/notification-settings.tsx` | Admin matrix UI — replaces StageNotificationSettings |
| `src/components/notifications/notification-bell.tsx` | Bell icon + unread badge + dropdown toggle |
| `src/components/notifications/notification-dropdown.tsx` | Dropdown panel — recent notifications list |
| `src/app/(dashboard)/notifications/page.tsx` | Full notifications page with filters |

### Modified Files
| File | Change |
|---|---|
| `prisma/schema.prisma` | Add NotificationRule, NotificationRecipient models; FeedPost fields; Employee relation |
| `src/components/layout/top-bar.tsx` | Replace decorative bell with NotificationBell component |
| `src/app/(dashboard)/settings/page.tsx` | Replace StageNotificationSettings with NotificationSettings |
| `src/lib/actions/candidates.ts` | Replace manual notification logic with `sendNotifications()` |
| `src/lib/actions/signing.ts` | Add notification calls for sign request/completion |
| `src/lib/actions/employees.ts` | Add notification calls for hire/onboarding completion |
| `src/lib/actions/interviews.ts` | Replace manual email with `sendNotifications()` |
| `src/lib/actions/feed.ts` | Use targeted email logic, create in-app notifications |
| `src/lib/actions/feed-events.ts` | Same as feed.ts |
| `src/components/feed/post-composer.tsx` | Add email targeting radio buttons |
| `src/components/feed/create-event-dialog.tsx` | Add email targeting radio buttons |

---

## Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma:231,426-450,895-911`

- [ ] **Step 1: Add NotificationRule and NotificationRecipient models to schema**

Add after the Notification model (after line 544) in `prisma/schema.prisma`:

```prisma
model NotificationRule {
  id        String   @id @default(uuid())
  action    String
  channel   String
  recipient String
  enabled   Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([action, channel, recipient])
  @@index([action])
}

model NotificationRecipient {
  id         String   @id @default(uuid())
  employeeId String
  createdAt  DateTime @default(now())

  employee   Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)

  @@unique([employeeId])
}
```

- [ ] **Step 2: Add notificationRecipients relation on Employee model**

In the Employee model (around line 231, among the other relation fields), add:

```prisma
  notificationRecipients NotificationRecipient[]
```

- [ ] **Step 3: Add email targeting fields to FeedPost model**

In the FeedPost model (after line 438, before the `author` relation), add:

```prisma
  notifyViaEmail   Boolean  @default(true)
  emailTargetType  String   @default("all")
  emailTargetIds   String?
```

- [ ] **Step 4: Run migration**

```bash
npx prisma migrate dev --name notification_rules_and_targeting
```

- [ ] **Step 5: Verify migration**

```bash
npx prisma generate
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add prisma/
git commit -m "feat: add NotificationRule, NotificationRecipient models and FeedPost email targeting fields"
```

---

## Task 2: Seed Default Notification Rules

**Files:**
- Create: `src/lib/notifications/seed.ts`

- [ ] **Step 1: Create the seed script**

Create `src/lib/notifications/seed.ts`:

```typescript
import { db } from "@/lib/db";

const ACTION_TYPES = [
  "STAGE_CHANGE",
  "OFFER_SENT",
  "OFFER_SIGNED",
  "DOCUMENT_SIGN_REQUEST",
  "DOCUMENT_SIGNED",
  "INTERVIEW_SCHEDULED",
  "NEW_HIRE",
  "TASK_ASSIGNED",
  "ONBOARDING_COMPLETED",
] as const;

const CHANNELS = ["EMAIL", "IN_APP"] as const;
const RECIPIENTS = ["candidate", "recruiter", "manager", "hr_team"] as const;

// Default enabled state per action×channel×recipient
const DEFAULTS: Record<string, Record<string, string[]>> = {
  STAGE_CHANGE: {
    EMAIL: ["candidate", "recruiter", "manager", "hr_team"],
    IN_APP: ["recruiter", "manager", "hr_team"],
  },
  OFFER_SENT: {
    EMAIL: ["candidate", "recruiter"],
    IN_APP: ["recruiter"],
  },
  OFFER_SIGNED: {
    EMAIL: ["recruiter", "hr_team"],
    IN_APP: ["recruiter", "hr_team"],
  },
  DOCUMENT_SIGN_REQUEST: {
    EMAIL: ["candidate"],
    IN_APP: [],
  },
  DOCUMENT_SIGNED: {
    EMAIL: ["recruiter", "hr_team"],
    IN_APP: ["recruiter", "hr_team"],
  },
  INTERVIEW_SCHEDULED: {
    EMAIL: ["candidate", "recruiter"],
    IN_APP: ["recruiter"],
  },
  NEW_HIRE: {
    EMAIL: ["candidate", "recruiter", "manager", "hr_team"],
    IN_APP: ["recruiter", "manager", "hr_team"],
  },
  TASK_ASSIGNED: {
    EMAIL: [],
    IN_APP: ["recruiter"],
  },
  ONBOARDING_COMPLETED: {
    EMAIL: ["recruiter", "manager", "hr_team"],
    IN_APP: ["recruiter", "manager", "hr_team"],
  },
};

export async function seedNotificationRules() {
  const existing = await db.notificationRule.count();
  if (existing > 0) return; // Already seeded

  const rules: { action: string; channel: string; recipient: string; enabled: boolean }[] = [];

  for (const action of ACTION_TYPES) {
    for (const channel of CHANNELS) {
      // Skip candidate + IN_APP (candidates don't have accounts)
      const recipients = channel === "IN_APP"
        ? RECIPIENTS.filter((r) => r !== "candidate")
        : RECIPIENTS;

      for (const recipient of recipients) {
        const enabled = DEFAULTS[action]?.[channel]?.includes(recipient) ?? false;
        rules.push({ action, channel, recipient, enabled });
      }
    }
  }

  await db.notificationRule.createMany({ data: rules });

  // Migrate existing CompanySettings recipients for STAGE_CHANGE
  try {
    const settings = await db.companySettings.findUnique({ where: { id: "singleton" } });
    if (settings) {
      const stageRecipients: string[] = JSON.parse(settings.stageNotifyRecipients || "[]");
      const extraIds: string[] = JSON.parse(settings.stageNotifyEmployeeIds || "[]");

      // Override STAGE_CHANGE EMAIL rules based on existing settings
      for (const recipient of ["candidate", "recruiter", "manager"] as const) {
        const enabled = stageRecipients.includes(recipient);
        await db.notificationRule.updateMany({
          where: { action: "STAGE_CHANGE", channel: "EMAIL", recipient },
          data: { enabled },
        });
        // Also set IN_APP to match (except candidate)
        if (recipient !== "candidate") {
          await db.notificationRule.updateMany({
            where: { action: "STAGE_CHANGE", channel: "IN_APP", recipient },
            data: { enabled },
          });
        }
      }

      // hr_team enabled if there are extra employee IDs
      const hrEnabled = extraIds.length > 0 || stageRecipients.includes("hr_team");
      await db.notificationRule.updateMany({
        where: { action: "STAGE_CHANGE", recipient: "hr_team" },
        data: { enabled: hrEnabled },
      });

      // Migrate extra employee IDs to NotificationRecipient table
      for (const employeeId of extraIds) {
        await db.notificationRecipient.upsert({
          where: { employeeId },
          create: { employeeId },
          update: {},
        });
      }
    }
  } catch (e) {
    console.error("[notification-seed] Failed to migrate existing settings:", e);
  }
}
```

- [ ] **Step 2: Call seed on app startup**

Add to the seed API route or call from the settings page server component. The simplest approach: call `seedNotificationRules()` from the settings page's server component (it's idempotent — checks `count > 0` first).

In `src/app/(dashboard)/settings/page.tsx`, add at the top of the `SettingsPage` function (after auth check):

```typescript
import { seedNotificationRules } from "@/lib/notifications/seed";
// ... inside SettingsPage():
await seedNotificationRules();
```

- [ ] **Step 3: Verify seed works**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/notifications/seed.ts src/app/\(dashboard\)/settings/page.tsx
git commit -m "feat: add notification rules seed with migration from existing settings"
```

---

## Task 3: Rules Engine

**Files:**
- Create: `src/lib/notifications/rules.ts`

- [ ] **Step 1: Create the rules engine**

Create `src/lib/notifications/rules.ts`:

```typescript
import { db } from "@/lib/db";

export async function getEnabledRecipients(
  action: string,
  channel: "EMAIL" | "IN_APP"
): Promise<string[]> {
  const rules = await db.notificationRule.findMany({
    where: { action, channel, enabled: true },
    select: { recipient: true },
  });
  return rules.map((r) => r.recipient);
}

export async function shouldNotify(
  action: string,
  channel: "EMAIL" | "IN_APP",
  recipient: string
): Promise<boolean> {
  const rule = await db.notificationRule.findUnique({
    where: { action_channel_recipient: { action, channel, recipient } },
  });
  return rule?.enabled ?? false;
}

export async function getHrTeamEmployeeIds(): Promise<string[]> {
  const recipients = await db.notificationRecipient.findMany({
    select: { employeeId: true },
  });
  return recipients.map((r) => r.employeeId);
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/notifications/rules.ts
git commit -m "feat: add notification rules engine"
```

---

## Task 4: Centralized Send Function

**Files:**
- Create: `src/lib/notifications/send.ts`

- [ ] **Step 1: Create the send function**

Create `src/lib/notifications/send.ts`:

```typescript
import { db } from "@/lib/db";
import { getEnabledRecipients, getHrTeamEmployeeIds } from "./rules";

type SendParams = {
  action: string;
  candidateId?: string;
  employeeId?: string;
  message: string;
  link?: string;
  emailSubject?: string;
  emailBody?: string;
};

type ResolvedRecipient = {
  key: string;
  email?: string;
  employeeId?: string;
  firstName?: string;
};

async function resolveRecipients(
  recipientKeys: string[],
  candidateId?: string,
  employeeId?: string
): Promise<ResolvedRecipient[]> {
  const resolved: ResolvedRecipient[] = [];

  // Load candidate if needed
  let candidate: { email: string; firstName: string; lastName: string; recruiterId: string | null; managerId: string | null } | null = null;
  if (candidateId) {
    candidate = await db.candidate.findUnique({
      where: { id: candidateId },
      select: { email: true, firstName: true, lastName: true, recruiterId: true, managerId: true },
    });
  }

  // Load employee if needed (for employee-centric actions)
  let employee: { email: string; firstName: string; managerId: string | null } | null = null;
  if (employeeId && !candidate) {
    employee = await db.employee.findUnique({
      where: { id: employeeId },
      select: { email: true, firstName: true, managerId: true },
    });
  }

  for (const key of recipientKeys) {
    switch (key) {
      case "candidate": {
        if (candidate?.email) {
          resolved.push({ key, email: candidate.email, firstName: candidate.firstName });
        }
        break;
      }
      case "recruiter": {
        const recruiterId = candidate?.recruiterId;
        if (recruiterId) {
          const recruiter = await db.employee.findUnique({
            where: { id: recruiterId },
            select: { id: true, email: true, firstName: true },
          });
          if (recruiter) {
            resolved.push({ key, email: recruiter.email, employeeId: recruiter.id, firstName: recruiter.firstName });
          }
        }
        break;
      }
      case "manager": {
        const managerId = candidate?.managerId || employee?.managerId;
        if (managerId) {
          const manager = await db.employee.findUnique({
            where: { id: managerId },
            select: { id: true, email: true, firstName: true },
          });
          if (manager) {
            resolved.push({ key, email: manager.email, employeeId: manager.id, firstName: manager.firstName });
          }
        }
        break;
      }
      case "hr_team": {
        const hrIds = await getHrTeamEmployeeIds();
        if (hrIds.length > 0) {
          const hrMembers = await db.employee.findMany({
            where: { id: { in: hrIds } },
            select: { id: true, email: true, firstName: true },
          });
          for (const hr of hrMembers) {
            resolved.push({ key, email: hr.email, employeeId: hr.id, firstName: hr.firstName });
          }
        }
        break;
      }
    }
  }

  return resolved;
}

export async function sendNotifications(params: SendParams): Promise<void> {
  const { action, candidateId, employeeId, message, link, emailSubject, emailBody } = params;

  try {
    // Resolve email recipients
    const emailRecipientKeys = await getEnabledRecipients(action, "EMAIL");
    const inAppRecipientKeys = await getEnabledRecipients(action, "IN_APP");

    const allKeys = [...new Set([...emailRecipientKeys, ...inAppRecipientKeys])];
    if (allKeys.length === 0) return;

    const resolved = await resolveRecipients(allKeys, candidateId, employeeId);

    // Send emails
    if (emailSubject && emailBody && emailRecipientKeys.length > 0) {
      const { sendEmail } = await import("@/lib/email");
      const emailRecipients = resolved.filter((r) => emailRecipientKeys.includes(r.key) && r.email);

      // Deduplicate by email
      const seen = new Set<string>();
      for (const r of emailRecipients) {
        if (r.email && !seen.has(r.email)) {
          seen.add(r.email);
          sendEmail(r.email, emailSubject, emailBody).catch((err) =>
            console.error(`[notifications] Failed to email ${r.email}:`, err)
          );
        }
      }
    }

    // Create in-app notifications
    if (inAppRecipientKeys.length > 0) {
      const inAppRecipients = resolved.filter((r) => inAppRecipientKeys.includes(r.key) && r.employeeId);

      // Deduplicate by employeeId
      const seen = new Set<string>();
      const notificationData: { recipientId: string; type: string; message: string; link: string | null }[] = [];
      for (const r of inAppRecipients) {
        if (r.employeeId && !seen.has(r.employeeId)) {
          seen.add(r.employeeId);
          notificationData.push({
            recipientId: r.employeeId,
            type: action,
            message,
            link: link || null,
          });
        }
      }

      if (notificationData.length > 0) {
        await db.notification.createMany({ data: notificationData });
      }
    }
  } catch (err) {
    console.error(`[notifications] Failed to send notifications for ${action}:`, err);
  }
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/notifications/send.ts
git commit -m "feat: add centralized sendNotifications function with rules-based routing"
```

---

## Task 5: Notification Server Actions (Bell/Page)

**Files:**
- Create: `src/lib/actions/notifications.ts`

- [ ] **Step 1: Create notification actions**

Create `src/lib/actions/notifications.ts`:

```typescript
"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

async function getCurrentEmployeeId(): Promise<string | null> {
  const { getSession } = await import("@/lib/auth-helpers");
  const session = await getSession();
  return session?.user?.employeeId || null;
}

export async function getNotifications(params?: {
  limit?: number;
  offset?: number;
  type?: string;
}): Promise<{ notifications: { id: string; type: string; message: string; link: string | null; read: boolean; createdAt: string }[]; total: number; unreadCount: number }> {
  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) return { notifications: [], total: 0, unreadCount: 0 };

  const limit = params?.limit || 20;
  const offset = params?.offset || 0;

  const where: Record<string, unknown> = { recipientId: employeeId };

  // Map filter categories to notification types
  if (params?.type) {
    const typeMap: Record<string, string[]> = {
      stage_changes: ["STAGE_CHANGE"],
      signing: ["OFFER_SENT", "OFFER_SIGNED", "DOCUMENT_SIGN_REQUEST", "DOCUMENT_SIGNED"],
      onboarding: ["NEW_HIRE", "TASK_ASSIGNED", "ONBOARDING_COMPLETED"],
      interviews: ["INTERVIEW_SCHEDULED"],
      feed: ["FEED_POST", "FEED_EVENT", "FEED_COMMENT", "FEED_REACTION", "FEED_SHOUTOUT"],
      promotions: ["PROMOTION"],
    };
    const types = typeMap[params.type];
    if (types) where.type = { in: types };
  }

  const [notifications, total, unreadCount] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    db.notification.count({ where }),
    db.notification.count({ where: { recipientId: employeeId, read: false } }),
  ]);

  return {
    notifications: notifications.map((n) => ({
      id: n.id,
      type: n.type,
      message: n.message,
      link: n.link,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    })),
    total,
    unreadCount,
  };
}

export async function getUnreadCount(): Promise<number> {
  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) return 0;
  return db.notification.count({ where: { recipientId: employeeId, read: false } });
}

export async function markAsRead(id: string): Promise<void> {
  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) return;
  await db.notification.updateMany({
    where: { id, recipientId: employeeId },
    data: { read: true },
  });
}

export async function markAllAsRead(): Promise<void> {
  const employeeId = await getCurrentEmployeeId();
  if (!employeeId) return;
  await db.notification.updateMany({
    where: { recipientId: employeeId, read: false },
    data: { read: true },
  });
  revalidatePath("/notifications");
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/notifications.ts
git commit -m "feat: add notification server actions (get, unread count, mark read)"
```

---

## Task 6: Settings Server Actions

**Files:**
- Create: `src/lib/actions/notification-settings.ts`

- [ ] **Step 1: Create settings actions**

Create `src/lib/actions/notification-settings.ts`:

```typescript
"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getNotificationRules() {
  return db.notificationRule.findMany({
    orderBy: [{ action: "asc" }, { channel: "asc" }, { recipient: "asc" }],
  });
}

export async function getNotificationRecipients() {
  return db.notificationRecipient.findMany({
    include: { employee: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
}

export async function saveNotificationRules(
  rules: { action: string; channel: string; recipient: string; enabled: boolean }[],
  hrTeamEmployeeIds: string[]
) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
    throw new Error("Not authorized");
  }

  // Upsert all rules
  for (const rule of rules) {
    await db.notificationRule.upsert({
      where: {
        action_channel_recipient: {
          action: rule.action,
          channel: rule.channel,
          recipient: rule.recipient,
        },
      },
      create: {
        action: rule.action,
        channel: rule.channel,
        recipient: rule.recipient,
        enabled: rule.enabled,
      },
      update: { enabled: rule.enabled },
    });
  }

  // Sync HR team recipients
  await db.notificationRecipient.deleteMany({});
  if (hrTeamEmployeeIds.length > 0) {
    await db.notificationRecipient.createMany({
      data: hrTeamEmployeeIds.map((employeeId) => ({ employeeId })),
    });
  }

  revalidatePath("/settings");
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/notification-settings.ts
git commit -m "feat: add notification settings server actions"
```

---

## Task 7: Settings Matrix UI

**Files:**
- Create: `src/components/settings/notification-settings.tsx`
- Modify: `src/app/(dashboard)/settings/page.tsx:33,131-135`

- [ ] **Step 1: Create the notification settings matrix component**

Create `src/components/settings/notification-settings.tsx`:

```typescript
"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { saveNotificationRules } from "@/lib/actions/notification-settings";
import { Icon } from "@/components/ui/icon";

type Rule = {
  id: string;
  action: string;
  channel: string;
  recipient: string;
  enabled: boolean;
};

type Employee = { id: string; firstName: string; lastName: string; email: string };
type Recipient = { id: string; employeeId: string; employee: Employee };

const ACTION_LABELS: Record<string, string> = {
  STAGE_CHANGE: "Candidate Stage Change",
  OFFER_SENT: "Offer Letter Sent",
  OFFER_SIGNED: "Offer Signed",
  DOCUMENT_SIGN_REQUEST: "Document Sign Request",
  DOCUMENT_SIGNED: "Document Signed",
  INTERVIEW_SCHEDULED: "Interview Scheduled",
  NEW_HIRE: "New Hire / Onboarding",
  TASK_ASSIGNED: "Task Assigned",
  ONBOARDING_COMPLETED: "Onboarding Completed",
};

const ACTIONS = Object.keys(ACTION_LABELS);
const EMAIL_RECIPIENTS = ["candidate", "recruiter", "manager", "hr_team"];
const INAPP_RECIPIENTS = ["recruiter", "manager", "hr_team"];
const RECIPIENT_LABELS: Record<string, string> = {
  candidate: "Candidate",
  recruiter: "Recruiter",
  manager: "Manager",
  hr_team: "HR Team",
};

export function NotificationSettings({
  initialRules,
  initialRecipients,
  allEmployees,
}: {
  initialRules: Rule[];
  initialRecipients: Recipient[];
  allEmployees: Employee[];
}) {
  const [rules, setRules] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const r of initialRules) {
      map[`${r.action}:${r.channel}:${r.recipient}`] = r.enabled;
    }
    return map;
  });
  const [hrTeamIds, setHrTeamIds] = useState<string[]>(initialRecipients.map((r) => r.employeeId));
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function getKey(action: string, channel: string, recipient: string) {
    return `${action}:${channel}:${recipient}`;
  }

  function toggle(action: string, channel: string, recipient: string) {
    const key = getKey(action, channel, recipient);
    setRules((prev) => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  }

  function isEnabled(action: string, channel: string, recipient: string) {
    return rules[getKey(action, channel, recipient)] ?? false;
  }

  async function handleSave() {
    setSaving(true);
    const ruleList = Object.entries(rules).map(([key, enabled]) => {
      const [action, channel, recipient] = key.split(":");
      return { action, channel, recipient, enabled };
    });
    await saveNotificationRules(ruleList, hrTeamIds);
    setSaving(false);
    setSaved(true);
  }

  const filteredEmployees = allEmployees.filter(
    (e) =>
      !hrTeamIds.includes(e.id) &&
      (`${e.firstName} ${e.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        e.email.toLowerCase().includes(search.toLowerCase()))
  );

  const inputClass = cn(
    "w-full px-3 py-2 rounded-lg text-sm",
    "bg-[var(--color-background)] border border-[var(--color-border)]",
    "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
  );

  return (
    <div className={cn("rounded-2xl p-6", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
      <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">Notification Settings</h3>
      <p className="text-xs text-[var(--color-text-muted)] mb-4">
        Control who receives email and in-app notifications for each action.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="text-left py-2 pr-4 font-medium text-[var(--color-text-primary)]">Action</th>
              <th colSpan={4} className="text-center py-2 px-1 font-medium text-[var(--color-text-primary)]">Email</th>
              <th className="w-px bg-[var(--color-border)]" />
              <th colSpan={3} className="text-center py-2 px-1 font-medium text-[var(--color-text-primary)]">In-App</th>
            </tr>
            <tr className="border-b border-[var(--color-border)]">
              <th />
              {EMAIL_RECIPIENTS.map((r) => (
                <th key={`eh-${r}`} className="text-center py-1 px-1 font-normal text-[var(--color-text-muted)]">
                  {RECIPIENT_LABELS[r]}
                </th>
              ))}
              <th className="w-px bg-[var(--color-border)]" />
              {INAPP_RECIPIENTS.map((r) => (
                <th key={`ih-${r}`} className="text-center py-1 px-1 font-normal text-[var(--color-text-muted)]">
                  {RECIPIENT_LABELS[r]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ACTIONS.map((action) => (
              <tr key={action} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-hover)]">
                <td className="py-2 pr-4 text-[var(--color-text-primary)] whitespace-nowrap">{ACTION_LABELS[action]}</td>
                {EMAIL_RECIPIENTS.map((r) => (
                  <td key={`e-${r}`} className="text-center py-2 px-1">
                    <input
                      type="checkbox"
                      checked={isEnabled(action, "EMAIL", r)}
                      onChange={() => toggle(action, "EMAIL", r)}
                      className="accent-[var(--color-accent)]"
                    />
                  </td>
                ))}
                <td className="w-px bg-[var(--color-border)]" />
                {INAPP_RECIPIENTS.map((r) => (
                  <td key={`i-${r}`} className="text-center py-2 px-1">
                    <input
                      type="checkbox"
                      checked={isEnabled(action, "IN_APP", r)}
                      onChange={() => toggle(action, "IN_APP", r)}
                      className="accent-[var(--color-accent)]"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* HR Team Recipients */}
      <div className="mt-6">
        <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-2">
          HR Team Recipients
        </label>
        <p className="text-xs text-[var(--color-text-muted)] mb-2">
          These employees receive notifications for any action where &quot;HR Team&quot; is enabled.
        </p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {hrTeamIds.map((id) => {
            const emp = allEmployees.find((e) => e.id === id);
            if (!emp) return null;
            return (
              <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                {emp.firstName} {emp.lastName}
                <button onClick={() => { setHrTeamIds((prev) => prev.filter((x) => x !== id)); setSaved(false); }} className="hover:text-red-500">
                  <Icon name="close" size={12} />
                </button>
              </span>
            );
          })}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={inputClass}
          placeholder="Search employees to add..."
        />
        {search && (
          <div className="mt-1 max-h-32 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-background)]">
            {filteredEmployees.slice(0, 5).map((e) => (
              <button
                key={e.id}
                onClick={() => { setHrTeamIds((prev) => [...prev, e.id]); setSearch(""); setSaved(false); }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--color-surface-hover)]"
              >
                {e.firstName} {e.lastName} <span className="text-[var(--color-text-muted)]">({e.email})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end mt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium",
            "bg-[var(--color-accent)] text-white",
            "hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
          )}
        >
          {saving ? "Saving..." : saved ? "Saved!" : "Save"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update settings page to use new component**

In `src/app/(dashboard)/settings/page.tsx`:

Replace the import (line 33):
```typescript
// OLD: import { StageNotificationSettings } from "@/components/settings/stage-notification-settings";
import { NotificationSettings } from "@/components/settings/notification-settings";
```

Add imports at top:
```typescript
import { getNotificationRules, getNotificationRecipients } from "@/lib/actions/notification-settings";
```

Add data fetching in the server component (after existing queries):
```typescript
const [notificationRules, notificationRecipients] = await Promise.all([
  getNotificationRules(),
  getNotificationRecipients(),
]);
```

Replace the render (lines 131-135):
```typescript
// OLD: <StageNotificationSettings initialRecipients={...} initialEmployeeIds={...} allEmployees={...} />
<NotificationSettings
  initialRules={notificationRules}
  initialRecipients={notificationRecipients}
  allEmployees={employees.map((e) => ({ id: e.id, firstName: e.firstName, lastName: e.lastName, email: e.email }))}
/>
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/notification-settings.tsx src/app/\(dashboard\)/settings/page.tsx
git commit -m "feat: add notification settings matrix UI, replace StageNotificationSettings"
```

---

## Task 8: Notification Bell Component

**Files:**
- Create: `src/components/notifications/notification-bell.tsx`
- Create: `src/components/notifications/notification-dropdown.tsx`
- Modify: `src/components/layout/top-bar.tsx:48-61`

- [ ] **Step 1: Create the notification bell component**

Create `src/components/notifications/notification-bell.tsx`:

```typescript
"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect, useRef, useCallback } from "react";
import { getUnreadCount } from "@/lib/actions/notifications";
import { NotificationDropdown } from "./notification-dropdown";
import { Icon } from "@/components/ui/icon";

export function NotificationBell() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchCount = useCallback(async () => {
    try {
      const c = await getUnreadCount();
      setCount(c);
    } catch {}
  }, []);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(() => {
      if (!document.hidden) fetchCount();
    }, 30000);
    const handleVisibility = () => {
      if (!document.hidden) fetchCount();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchCount]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "relative flex h-10 w-10 items-center justify-center rounded-xl",
          "text-[var(--color-text-muted)] transition-colors duration-200",
          "hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]"
        )}
      >
        <Icon name="notifications" size={18} />
        {count > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <NotificationDropdown
          onClose={() => setOpen(false)}
          onCountChange={setCount}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create the notification dropdown component**

Create `src/components/notifications/notification-dropdown.tsx`:

```typescript
"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { getNotifications, markAsRead, markAllAsRead } from "@/lib/actions/notifications";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";

type NotificationItem = {
  id: string;
  type: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationDropdown({
  onClose,
  onCountChange,
}: {
  onClose: () => void;
  onCountChange: (count: number) => void;
}) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { notifications, unreadCount } = await getNotifications({ limit: 10 });
      setNotifications(notifications);
      onCountChange(unreadCount);
      setLoading(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleClick(n: NotificationItem) {
    if (!n.read) {
      await markAsRead(n.id);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      onCountChange((prev: number) => Math.max(0, prev - 1));
    }
    if (n.link) {
      router.push(n.link);
      onClose();
    }
  }

  async function handleMarkAllRead() {
    await markAllAsRead();
    setNotifications((prev) => prev.map((x) => ({ ...x, read: true })));
    onCountChange(0);
  }

  return (
    <div className={cn(
      "absolute right-0 top-12 z-50 w-80 rounded-2xl shadow-xl",
      "bg-[var(--color-surface)] border border-[var(--color-border)]",
      "overflow-hidden"
    )}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <span className="text-sm font-semibold text-[var(--color-text-primary)]">Notifications</span>
        <button
          onClick={handleMarkAllRead}
          className="text-xs text-[var(--color-accent)] hover:underline"
        >
          Mark all read
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Icon name="progress_activity" className="animate-spin text-[var(--color-text-muted)]" />
          </div>
        ) : notifications.length === 0 ? (
          <p className="text-center text-sm text-[var(--color-text-muted)] py-8">No notifications</p>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={cn(
                "w-full text-left px-4 py-3 flex items-start gap-3",
                "hover:bg-[var(--color-surface-hover)] transition-colors",
                "border-b border-[var(--color-border)]/50 last:border-0"
              )}
            >
              <span className={cn(
                "mt-1.5 h-2 w-2 rounded-full shrink-0",
                n.read ? "bg-transparent" : "bg-[var(--color-accent)]"
              )} />
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm leading-snug",
                  n.read ? "text-[var(--color-text-muted)]" : "text-[var(--color-text-primary)]"
                )}>
                  {n.message}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{timeAgo(n.createdAt)}</p>
              </div>
            </button>
          ))
        )}
      </div>

      <div className="border-t border-[var(--color-border)]">
        <button
          onClick={() => { router.push("/notifications"); onClose(); }}
          className="w-full text-center py-2.5 text-xs font-medium text-[var(--color-accent)] hover:bg-[var(--color-surface-hover)]"
        >
          View all notifications
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire up the bell in top-bar**

In `src/components/layout/top-bar.tsx`:

Add import at top:
```typescript
import { NotificationBell } from "@/components/notifications/notification-bell";
```

Replace lines 48-61 (the decorative bell button) with:
```typescript
        <NotificationBell />
```

Remove the `motion` import from framer-motion if it was only used for the bell animation (check if it's used elsewhere in the file first).

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/components/notifications/ src/components/layout/top-bar.tsx
git commit -m "feat: add functional notification bell with dropdown"
```

---

## Task 9: Full Notifications Page

**Files:**
- Create: `src/app/(dashboard)/notifications/page.tsx`

- [ ] **Step 1: Create the notifications page**

Create `src/app/(dashboard)/notifications/page.tsx`:

```typescript
import { requireAuth } from "@/lib/auth-helpers";
import { NotificationsList } from "./notifications-list";

export default async function NotificationsPage() {
  await requireAuth();
  return <NotificationsList />;
}
```

Create `src/app/(dashboard)/notifications/notifications-list.tsx`:

```typescript
"use client";

import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { getNotifications, markAsRead, markAllAsRead } from "@/lib/actions/notifications";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Icon } from "@/components/ui/icon";

type NotificationItem = {
  id: string;
  type: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

const FILTERS = [
  { key: "", label: "All" },
  { key: "stage_changes", label: "Stage Changes" },
  { key: "signing", label: "Offers & Signing" },
  { key: "onboarding", label: "Hiring & Onboarding" },
  { key: "interviews", label: "Interviews" },
  { key: "feed", label: "Feed" },
];

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationsList() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  async function load(type?: string, offset?: number) {
    setLoading(true);
    const result = await getNotifications({ limit: 20, offset: offset || 0, type: type || undefined });
    if (offset) {
      setNotifications((prev) => [...prev, ...result.notifications]);
    } else {
      setNotifications(result.notifications);
    }
    setTotal(result.total);
    setLoading(false);
  }

  useEffect(() => {
    load(filter);
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleClick(n: NotificationItem) {
    if (!n.read) {
      await markAsRead(n.id);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
    if (n.link) router.push(n.link);
  }

  async function handleMarkAllRead() {
    await markAllAsRead();
    setNotifications((prev) => prev.map((x) => ({ ...x, read: true })));
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <PageHeader title="Notifications" />
        <button
          onClick={handleMarkAllRead}
          className={cn("px-3 py-1.5 rounded-lg text-xs font-medium", "text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10")}
        >
          Mark all read
        </button>
      </div>

      <div className="flex gap-1.5 mb-4 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
              filter === f.key
                ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className={cn("rounded-2xl overflow-hidden", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
        {loading && notifications.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Icon name="progress_activity" className="animate-spin text-[var(--color-text-muted)]" />
          </div>
        ) : notifications.length === 0 ? (
          <p className="text-center text-sm text-[var(--color-text-muted)] py-12">
            {filter ? "No notifications matching this filter" : "No notifications"}
          </p>
        ) : (
          notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={cn(
                "w-full text-left px-5 py-4 flex items-start gap-3",
                "hover:bg-[var(--color-surface-hover)] transition-colors",
                "border-b border-[var(--color-border)]/50 last:border-0"
              )}
            >
              <span className={cn(
                "mt-1.5 h-2 w-2 rounded-full shrink-0",
                n.read ? "bg-transparent" : "bg-[var(--color-accent)]"
              )} />
              <div className="flex-1">
                <p className={cn(
                  "text-sm",
                  n.read ? "text-[var(--color-text-muted)]" : "text-[var(--color-text-primary)]"
                )}>
                  {n.message}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">{timeAgo(n.createdAt)}</p>
              </div>
            </button>
          ))
        )}
      </div>

      {notifications.length < total && (
        <div className="flex justify-center mt-4">
          <button
            onClick={() => load(filter, notifications.length)}
            disabled={loading}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium", "text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10", "disabled:opacity-50")}
          >
            {loading ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/notifications/
git commit -m "feat: add full notifications page with filters and load more"
```

---

## Task 10: Replace Candidate Notification Logic

**Files:**
- Modify: `src/lib/actions/candidates.ts:196-318,495-616`

This is the largest migration. Replace the manual email + in-app notification logic in `updateCandidateStatus` and `updateCandidate` with calls to `sendNotifications()`.

- [ ] **Step 1: Add import**

At the top of `src/lib/actions/candidates.ts`, add:

```typescript
import { sendNotifications } from "@/lib/notifications/send";
```

- [ ] **Step 2: Replace notification logic in `updateCandidateStatus`**

In the `updateCandidateStatus` function, replace the entire try/catch block inside `if (previousStatus !== status)` (approximately lines 196-318) — everything from the `try {` after the status change check through the matching `} catch` — with:

```typescript
    // Send notifications via centralized rules engine
    const stageLabel = STAGE_LABELS[status] || status;
    const candidateName = `${candidate.firstName} ${candidate.lastName}`;
    const rateInfo = candidate.hourlyRate
      ? `<p>Hourly rate: <strong>$${candidate.hourlyRate.toFixed(2)}/hr</strong></p>`
      : "";

    sendNotifications({
      action: "STAGE_CHANGE",
      candidateId: id,
      message: `${candidateName} moved to ${stageLabel}`,
      link: "/cv",
      emailSubject: `Candidate Stage Update: ${candidateName} → ${stageLabel}`,
      emailBody: `<p><strong>${candidateName}</strong> has been moved to <strong>${stageLabel}</strong>.</p>${rateInfo}`,
    }).catch((err) => console.error("[candidates] Notification error:", err));

    // Send stage PDF documents for onboarding/offboarding stages
    await sendStageDocumentsEmail(status, candidate);
```

- [ ] **Step 3: Replace notification logic in `updateCandidate`**

In the `updateCandidate` function, replace the entire try/catch block inside `if (status && previousStatus && previousStatus !== status)` (approximately lines 495-616) with the same pattern:

```typescript
    const stageLabel = STAGE_LABELS[status] || status;
    const candidateName = `${candidate.firstName} ${candidate.lastName}`;
    const rate = candidate.hourlyRate;
    const rateInfo = rate
      ? `<p>Hourly rate: <strong>$${rate.toFixed(2)}/hr</strong></p>`
      : "";

    sendNotifications({
      action: "STAGE_CHANGE",
      candidateId: id,
      message: `${candidateName} moved to ${stageLabel}`,
      link: "/cv",
      emailSubject: `Candidate Stage Update: ${candidateName} → ${stageLabel}`,
      emailBody: `<p><strong>${candidateName}</strong> has been moved to <strong>${stageLabel}</strong>.</p>${rateInfo}`,
    }).catch((err) => console.error("[candidates] Notification error:", err));

    // Send stage PDF documents
    await sendStageDocumentsEmail(status, candidate);
```

- [ ] **Step 4: Add NEW_HIRE notification in `hireCandidateAndStartOnboarding`**

After the candidate is updated to HIRED status (after the `db.candidate.update` calls), add:

```typescript
    sendNotifications({
      action: "NEW_HIRE",
      candidateId: candidateId,
      message: `${candidate.firstName} ${candidate.lastName} has been hired`,
      link: "/onboarding",
      emailSubject: `New Hire: ${candidate.firstName} ${candidate.lastName}`,
      emailBody: `<p><strong>${candidate.firstName} ${candidate.lastName}</strong> has been hired and onboarding has started.</p>`,
    }).catch((err) => console.error("[candidates] New hire notification error:", err));
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/actions/candidates.ts
git commit -m "refactor: replace manual candidate notifications with centralized sendNotifications"
```

---

## Task 11: Add Signing & Interview Notifications

**Files:**
- Modify: `src/lib/actions/signing.ts`
- Modify: `src/lib/actions/interviews.ts`
- Modify: `src/lib/actions/employees.ts`

- [ ] **Step 1: Add offer/signing notifications in signing.ts**

In `src/lib/actions/signing.ts`, in the `submitSignature` function, after the candidate offer signed section (around lines 329-373 where recruiter and admin emails are sent), replace the manual emails with:

```typescript
import { sendNotifications } from "@/lib/notifications/send";

// After document is signed and stored, replace manual recruiter/admin emails with:
if (signingRequest.candidateId) {
  sendNotifications({
    action: "DOCUMENT_SIGNED",
    candidateId: signingRequest.candidateId,
    message: `${typedName || "Candidate"} signed ${signingRequest.documentName}`,
    link: "/cv",
    emailSubject: `Document Signed: ${signingRequest.documentName}`,
    emailBody: `<p><strong>${typedName || "Candidate"}</strong> has signed <strong>${signingRequest.documentName}</strong>.</p>`,
  }).catch((err) => console.error("[signing] Notification error:", err));
}
```

Also in `createStandaloneSigningRequest`, after creating the request, add:

```typescript
sendNotifications({
  action: "DOCUMENT_SIGN_REQUEST",
  candidateId: data.candidateId,
  employeeId: data.employeeId,
  message: `Signing request sent: ${data.documentName}`,
  link: "/documents",
  emailSubject: `Document Requires Signature: ${data.documentName}`,
  emailBody: `<p>A document requires your signature: <strong>${data.documentName}</strong>.</p>`,
}).catch((err) => console.error("[signing] Sign request notification error:", err));
```

- [ ] **Step 2: Add interview notification in interviews.ts**

In `src/lib/actions/interviews.ts`, in the `scheduleInterview` function, add after the interview is created (keep existing candidate email, add rules-based notifications):

```typescript
import { sendNotifications } from "@/lib/notifications/send";

// After existing interview creation logic, add:
sendNotifications({
  action: "INTERVIEW_SCHEDULED",
  candidateId: interview.candidateId,
  message: `Interview scheduled with ${candidate.firstName} ${candidate.lastName}`,
  link: "/cv",
  emailSubject: `Interview Scheduled: ${candidate.firstName} ${candidate.lastName}`,
  emailBody: `<p>An interview has been scheduled with <strong>${candidate.firstName} ${candidate.lastName}</strong>.</p>`,
}).catch((err) => console.error("[interviews] Notification error:", err));
```

- [ ] **Step 3: Add onboarding completed notification in employees.ts**

In `src/lib/actions/employees.ts`, in both `completeOnboarding` and `completePreOnboarding`, add after the status update:

```typescript
import { sendNotifications } from "@/lib/notifications/send";

// In completeOnboarding, after db.employee.update:
sendNotifications({
  action: "ONBOARDING_COMPLETED",
  employeeId: employeeId,
  message: `${employee.firstName} ${employee.lastName} completed onboarding`,
  link: "/onboarding",
  emailSubject: `Onboarding Completed: ${employee.firstName} ${employee.lastName}`,
  emailBody: `<p><strong>${employee.firstName} ${employee.lastName}</strong> has completed onboarding and is now active.</p>`,
}).catch((err) => console.error("[employees] Onboarding complete notification error:", err));
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/signing.ts src/lib/actions/interviews.ts src/lib/actions/employees.ts
git commit -m "feat: add centralized notifications for signing, interviews, and onboarding completion"
```

---

## Task 12: Feed Email Targeting UI

**Files:**
- Modify: `src/components/feed/post-composer.tsx`
- Modify: `src/components/feed/create-event-dialog.tsx`
- Modify: `src/lib/actions/feed.ts`
- Modify: `src/lib/actions/feed-events.ts`

- [ ] **Step 1: Add email targeting to post composer**

In `src/components/feed/post-composer.tsx`, add state for email targeting (in the state section around line 28-41):

```typescript
const [emailTarget, setEmailTarget] = useState<"all" | "departments" | "specific" | "none">("all");
const [emailTargetIds, setEmailTargetIds] = useState<string[]>([]);
```

Add the email targeting UI before the post button (before the submit button). Create a collapsible section:

```typescript
{/* Email Notification Targeting */}
<div className="border-t border-[var(--color-border)] pt-3 mt-3">
  <p className="text-xs font-medium text-[var(--color-text-primary)] mb-2">Email Notification</p>
  <div className="flex flex-wrap gap-2">
    {(["all", "departments", "specific", "none"] as const).map((opt) => (
      <label key={opt} className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] cursor-pointer">
        <input
          type="radio"
          name="emailTarget"
          checked={emailTarget === opt}
          onChange={() => { setEmailTarget(opt); setEmailTargetIds([]); }}
          className="accent-[var(--color-accent)]"
        />
        {opt === "all" ? "All employees" : opt === "departments" ? "Departments" : opt === "specific" ? "Specific people" : "Don't send"}
      </label>
    ))}
  </div>
</div>
```

Pass the targeting to the submit handler. Update the `createFeedPost` / `createShoutoutPost` calls to include `emailTarget` and `emailTargetIds`.

- [ ] **Step 2: Update feed.ts to accept and use targeting**

In `src/lib/actions/feed.ts`, update `createFeedPost` and `createShoutoutPost` to accept targeting params:

```typescript
export async function createFeedPost(
  content: string,
  attachments?: ...,
  emailTarget?: "all" | "departments" | "specific" | "none",
  emailTargetIds?: string[]
) {
  // ... existing post creation ...
  // Update the created post with email targeting:
  if (emailTarget) {
    await db.feedPost.update({
      where: { id: post.id },
      data: {
        notifyViaEmail: emailTarget !== "none",
        emailTargetType: emailTarget,
        emailTargetIds: emailTargetIds?.length ? JSON.stringify(emailTargetIds) : null,
      },
    });
  }

  // Replace sendPostNotificationEmail call with targeted logic
  if (emailTarget !== "none") {
    const { sendTargetedFeedEmail } = await import("@/lib/actions/feed-events");
    sendTargetedFeedEmail(post.id, session.user.employeeId!, emailTarget || "all", emailTargetIds || []);
  }

  // Create in-app notifications for all active employees
  const activeEmployees = await db.employee.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });
  const authorEmployeeId = session.user.employeeId;
  await db.notification.createMany({
    data: activeEmployees
      .filter((e) => e.id !== authorEmployeeId)
      .map((e) => ({
        recipientId: e.id,
        type: "FEED_POST",
        message: `New post in feed`,
        link: "/feed",
      })),
  });
}
```

- [ ] **Step 3: Add sendTargetedFeedEmail to feed-events.ts**

In `src/lib/actions/feed-events.ts`, add a new function that replaces `sendPostNotificationEmail`:

```typescript
export async function sendTargetedFeedEmail(
  postId: string,
  authorEmployeeId: string,
  targetType: "all" | "departments" | "specific",
  targetIds: string[]
) {
  try {
    const post = await db.feedPost.findUnique({
      where: { id: postId },
      include: { author: { select: { firstName: true, lastName: true } } },
    });
    if (!post) return;

    // Determine recipient query
    let where: Record<string, unknown> = {
      user: { emailNotificationsEnabled: true },
      status: "ACTIVE",
      id: { not: authorEmployeeId },
    };

    if (targetType === "departments" && targetIds.length > 0) {
      where.departmentId = { in: targetIds };
    } else if (targetType === "specific" && targetIds.length > 0) {
      where.id = { in: targetIds.filter((id) => id !== authorEmployeeId) };
    }
    // "all" = no additional filter

    const recipients = await db.employee.findMany({
      where,
      select: { email: true },
    });

    if (recipients.length === 0) return;

    const { sendFeedPostNotification } = await import("@/lib/email");
    const authorName = `${post.author.firstName} ${post.author.lastName}`;
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

    // Build email content (reuse existing email template logic)
    const content = post.content.length > 200 ? post.content.slice(0, 200) + "..." : post.content;

    await sendFeedPostNotification({
      to: recipients.map((r) => r.email),
      authorName,
      content,
      postUrl: `${baseUrl}/feed`,
      type: post.type,
    });
  } catch (err) {
    console.error("[feed] Failed to send targeted email:", err);
  }
}
```

- [ ] **Step 4: Apply same changes to create-event-dialog.tsx**

Add the same email targeting radio buttons to the event creation dialog, and pass the targeting to `createFeedEvent`.

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/components/feed/ src/lib/actions/feed.ts src/lib/actions/feed-events.ts
git commit -m "feat: add per-post email targeting for feed posts and events"
```

---

## Task 13: Final Verification & Cleanup

- [ ] **Step 1: Run full type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 2: Test the app locally**

```bash
npm run dev
```

Verify:
1. Settings page → Notification matrix loads with seeded defaults
2. Toggle checkboxes and save
3. Notification bell shows in top bar with count
4. Click bell → dropdown opens with notifications
5. Click "View all" → `/notifications` page loads
6. Create a feed post → email targeting options visible
7. Move a candidate → notifications sent per rules

- [ ] **Step 3: Remove old StageNotificationSettings component**

Delete `src/components/settings/stage-notification-settings.tsx` since it's been replaced.

- [ ] **Step 4: Commit**

```bash
git rm src/components/settings/stage-notification-settings.tsx
git add -A
git commit -m "chore: remove old StageNotificationSettings, final cleanup"
```
