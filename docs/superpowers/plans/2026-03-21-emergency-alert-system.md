# Emergency Alert System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow ADMIN/SUPER_ADMIN to broadcast emergency alerts via feed post + email + SMS to the entire company.

**Architecture:** New `EMERGENCY` feed post type backed by an `EmergencyAlert` model for delivery tracking. Server action creates the post, then sends emails via Resend and SMS via Twilio in batches. Dedicated `/alerts` page for composing and viewing history.

**Tech Stack:** Next.js 16 App Router, Prisma, Resend (email), Twilio (SMS), Tailwind v4

**Spec:** `docs/superpowers/specs/2026-03-21-emergency-alert-system-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `prisma/schema.prisma` | Add EMERGENCY to enum, add EmergencyAlert model |
| Create | `src/lib/sms.ts` | Twilio SMS helper |
| Create | `src/lib/actions/emergency-alerts.ts` | Server actions: send alert, get history |
| Create | `src/app/(dashboard)/alerts/page.tsx` | Alerts page (server component) |
| Create | `src/components/alerts/alert-composer.tsx` | Client form with confirmation dialog |
| Create | `src/components/alerts/alert-history.tsx` | Client list of past alerts |
| Modify | `src/components/feed/post-card.tsx` | EMERGENCY post styling |
| Modify | `src/components/layout/sidebar.tsx` | Add Alerts nav link |

---

## Chunk 1: Schema + SMS + Server Actions

### Task 1: Prisma Schema — Add EMERGENCY type and EmergencyAlert model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add EMERGENCY to FeedPostType enum**

In `prisma/schema.prisma`, find the `FeedPostType` enum (line ~58) and add `EMERGENCY` at the end:

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
}
```

- [ ] **Step 2: Add EmergencyAlert model**

Add this model after the `PostAttachment` model (around line 435):

```prisma
model EmergencyAlert {
  id           String   @id @default(uuid())
  feedPostId   String   @unique
  feedPost     FeedPost @relation(fields: [feedPostId], references: [id], onDelete: Cascade)
  title        String
  sentById     String
  sentBy       Employee @relation("EmergencyAlertSender", fields: [sentById], references: [id])
  emailsSent   Int      @default(0)
  smsSent      Int      @default(0)
  emailsFailed Int      @default(0)
  smsFailed    Int      @default(0)
  status       String   @default("SENDING")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@map("emergency_alert")
}
```

- [ ] **Step 3: Add relations to existing models**

Add to the `FeedPost` model (after `attachments` relation, line ~393):

```prisma
  emergencyAlert  EmergencyAlert?
```

Add to the `Employee` model (after `authoredHRNotes` relation, line ~247):

```prisma
  emergencyAlerts EmergencyAlert[] @relation("EmergencyAlertSender")
```

- [ ] **Step 4: Run migration**

```bash
npx prisma migrate dev --name add-emergency-alerts
```

Expected: Migration succeeds, generates new Prisma client with `EmergencyAlert` model.

- [ ] **Step 5: Verify Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 6: Commit**

```bash
git add prisma/
git commit -m "feat: add EMERGENCY feed type and EmergencyAlert model"
```

---

### Task 2: Twilio SMS Helper

**Files:**
- Create: `src/lib/sms.ts`

- [ ] **Step 1: Install Twilio SDK**

```bash
npm install twilio
```

- [ ] **Step 2: Create `src/lib/sms.ts`**

```typescript
import twilio from "twilio";

const client =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

const FROM_NUMBER = process.env.TWILIO_PHONE_NUMBER || "";

/**
 * Send a single SMS. Returns true on success, false on failure.
 * Never throws — failures are logged and returned as false.
 */
export async function sendSMS(to: string, body: string): Promise<boolean> {
  if (!client || !FROM_NUMBER) {
    console.warn(`[sms] Twilio not configured — skipping SMS to ${to}`);
    return false;
  }

  try {
    await client.messages.create({
      body,
      from: FROM_NUMBER,
      to,
    });
    console.log(`[sms] Sent to ${to}`);
    return true;
  } catch (error) {
    console.error(`[sms] Failed to send to ${to}:`, error);
    return false;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/sms.ts package.json package-lock.json
git commit -m "feat: add Twilio SMS helper"
```

---

### Task 3: Server Actions — sendEmergencyAlert + getEmergencyAlerts

**Files:**
- Create: `src/lib/actions/emergency-alerts.ts`

- [ ] **Step 1: Create `src/lib/actions/emergency-alerts.ts`**

```typescript
"use server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { sendSMS } from "@/lib/sms";
import { Resend } from "resend";
import { revalidatePath } from "next/cache";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const DEFAULT_SENDER_EMAIL =
  process.env.SENDER_EMAIL || "noreply@hr.coastaldebt-tools.com";

async function getCompanyBranding() {
  try {
    const settings = await db.companySettings.findUnique({
      where: { id: "singleton" },
    });
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    return {
      companyName: settings?.companyName || "Coastal HR",
      logoUrl: settings?.logoUrl ? `${baseUrl}${settings.logoUrl}` : null,
      senderEmail: settings?.senderEmail || DEFAULT_SENDER_EMAIL,
      senderName: settings?.senderName || settings?.companyName || "Coastal HR",
    };
  } catch {
    return {
      companyName: "Coastal HR",
      logoUrl: null,
      senderEmail: DEFAULT_SENDER_EMAIL,
      senderName: "Coastal HR",
    };
  }
}

function buildEmergencyEmailHtml(
  title: string,
  message: string,
  companyName: string,
  logoUrl: string | null
) {
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${companyName}" style="max-height:40px;max-width:180px;display:block" />`
    : `<span style="font-size:20px;font-weight:700;color:#EF4444">${companyName}</span>`;

  return `
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#ffffff">
  <div style="background:#EF4444;padding:16px 24px;text-align:center">
    <span style="color:white;font-size:14px;font-weight:700;letter-spacing:2px;text-transform:uppercase">⚠ EMERGENCY ALERT</span>
  </div>
  <div style="padding:24px 24px 16px;border-bottom:1px solid #e5e7eb">
    ${logoHtml}
  </div>
  <div style="padding:24px">
    <h1 style="color:#1a1a27;font-size:22px;margin:0 0 16px">${title}</h1>
    <p style="color:#333;font-size:16px;line-height:1.6;white-space:pre-wrap;margin:0">${message}</p>
  </div>
  <div style="padding:16px 24px;border-top:1px solid #e5e7eb;text-align:center">
    <p style="margin:0;font-size:12px;color:#9ca3af">This is an emergency alert from ${companyName}</p>
  </div>
</div>`;
}

/** Send in batches of 10 with Promise.allSettled */
async function sendInBatches<T>(
  items: T[],
  fn: (item: T) => Promise<boolean>,
  batchSize = 10
): Promise<{ succeeded: number; failed: number }> {
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map(fn));
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) succeeded++;
      else failed++;
    }
  }

  return { succeeded, failed };
}

export async function sendEmergencyAlert(title: string, message: string) {
  const session = await requireAdmin();
  const role = session.user?.role;

  // Only ADMIN and SUPER_ADMIN — reject HR
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    throw new Error("Unauthorized: Only admins can send emergency alerts");
  }

  const employeeId = session.user?.employeeId;
  if (!employeeId) {
    throw new Error("No employee profile linked to your account");
  }

  // 1. Get all active employees
  const employees = await db.employee.findMany({
    where: { status: "ACTIVE" },
    select: { email: true, phone: true },
  });

  // 2. Create feed post
  const post = await db.feedPost.create({
    data: {
      authorId: employeeId,
      content: message,
      type: "EMERGENCY",
      pinned: true,
    },
  });

  // 3. Create emergency alert record
  const alert = await db.emergencyAlert.create({
    data: {
      feedPostId: post.id,
      title,
      sentById: employeeId,
      status: "SENDING",
    },
  });

  // 4. Send emails
  const branding = await getCompanyBranding();
  const emailHtml = buildEmergencyEmailHtml(
    title,
    message,
    branding.companyName,
    branding.logoUrl
  );
  const senderName = branding.senderName.replace(/[<>"]/g, "").trim();
  const from = senderName
    ? `${senderName} <${branding.senderEmail}>`
    : branding.senderEmail;

  const emailResults = await sendInBatches(employees, async (emp) => {
    if (!resend) return false;
    try {
      const { error } = await resend.emails.send({
        from,
        to: emp.email,
        subject: `[EMERGENCY] ${title}`,
        html: emailHtml,
      });
      return !error;
    } catch {
      return false;
    }
  });

  // 5. Send SMS to employees with phone numbers
  const withPhone = employees.filter((e) => e.phone);
  const smsBody = `[EMERGENCY] ${title}: ${message}`;

  const smsResults = await sendInBatches(withPhone, async (emp) => {
    return sendSMS(emp.phone!, smsBody);
  });

  // 6. Update alert with delivery stats
  const allSucceeded =
    emailResults.failed === 0 && smsResults.failed === 0;

  await db.emergencyAlert.update({
    where: { id: alert.id },
    data: {
      emailsSent: emailResults.succeeded,
      emailsFailed: emailResults.failed,
      smsSent: smsResults.succeeded,
      smsFailed: smsResults.failed,
      status: allSucceeded ? "SENT" : "PARTIALLY_FAILED",
    },
  });

  revalidatePath("/alerts");
  revalidatePath("/");

  return {
    emailsSent: emailResults.succeeded,
    emailsFailed: emailResults.failed,
    smsSent: smsResults.succeeded,
    smsFailed: smsResults.failed,
  };
}

export async function getEmergencyAlerts() {
  const session = await requireAdmin();
  const role = session.user?.role;
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    throw new Error("Unauthorized");
  }

  return db.emergencyAlert.findMany({
    include: {
      sentBy: { select: { firstName: true, lastName: true } },
      feedPost: { select: { content: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/emergency-alerts.ts
git commit -m "feat: add emergency alert server actions"
```

---

## Chunk 2: UI Components + Page

### Task 4: Alert Composer Component

**Files:**
- Create: `src/components/alerts/alert-composer.tsx`

- [ ] **Step 1: Create `src/components/alerts/alert-composer.tsx`**

```tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { Dialog } from "@/components/ui/dialog";
import { sendEmergencyAlert } from "@/lib/actions/emergency-alerts";

export function AlertComposer() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    emailsSent: number;
    emailsFailed: number;
    smsSent: number;
    smsFailed: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSend = title.trim().length > 0 && message.trim().length > 0;

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      const res = await sendEmergencyAlert(title.trim(), message.trim());
      setResult(res);
      setTitle("");
      setMessage("");
    } catch (e: any) {
      setError(e.message || "Failed to send alert");
    } finally {
      setSending(false);
      setShowConfirm(false);
    }
  }

  return (
    <div className="glass rounded-[var(--radius-xl)] p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
          <Icon name="warning" size={24} />
        </div>
        <div>
          <h3 className="font-bold text-lg text-[var(--color-on-surface)]">
            Send Emergency Alert
          </h3>
          <p className="text-sm text-[var(--color-on-surface-variant)]">
            This will notify all employees via feed, email, and SMS.
          </p>
        </div>
      </div>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Alert title"
        maxLength={100}
        className={cn(
          "w-full px-4 py-3 rounded-xl border border-[var(--color-border)]/60",
          "bg-[var(--color-surface-container-lowest)] text-[var(--color-on-surface)]",
          "placeholder:text-[var(--color-text-muted)] text-sm font-medium",
          "focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30"
        )}
      />

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Alert message..."
        rows={4}
        className={cn(
          "w-full px-4 py-3 rounded-xl border border-[var(--color-border)]/60",
          "bg-[var(--color-surface-container-lowest)] text-[var(--color-on-surface)]",
          "placeholder:text-[var(--color-text-muted)] text-sm",
          "focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/30",
          "resize-none"
        )}
      />

      <button
        onClick={() => setShowConfirm(true)}
        disabled={!canSend || sending}
        className={cn(
          "flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all",
          canSend && !sending
            ? "bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20"
            : "bg-[var(--color-surface-container)] text-[var(--color-text-muted)] cursor-not-allowed"
        )}
      >
        <Icon name="campaign" size={18} />
        Send Emergency Alert
      </button>

      {result && (
        <div className="rounded-xl bg-green-500/10 border border-green-500/20 p-4 text-sm">
          <p className="font-bold text-green-700">Alert sent successfully!</p>
          <p className="text-green-600 mt-1">
            {result.emailsSent} emails sent
            {result.emailsFailed > 0 && `, ${result.emailsFailed} failed`}
            {" · "}
            {result.smsSent} SMS sent
            {result.smsFailed > 0 && `, ${result.smsFailed} failed`}
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm">
          <p className="font-bold text-red-700">Failed to send</p>
          <p className="text-red-600 mt-1">{error}</p>
        </div>
      )}

      <Dialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Confirm Emergency Alert"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10">
            <Icon name="warning" size={24} className="text-red-500" />
            <p className="text-sm text-[var(--color-on-surface)]">
              This will send an email to <strong>all employees</strong> and SMS
              to those with phone numbers on file.
            </p>
          </div>
          <div className="rounded-xl bg-[var(--color-surface-container-lowest)] p-4">
            <p className="font-bold text-[var(--color-on-surface)]">{title}</p>
            <p className="text-sm text-[var(--color-on-surface-variant)] mt-1 whitespace-pre-wrap">
              {message}
            </p>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowConfirm(false)}
              className="px-4 py-2 rounded-xl text-sm font-medium text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-hover)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              className={cn(
                "px-6 py-2 rounded-xl text-sm font-bold text-white transition-all",
                sending
                  ? "bg-red-400 cursor-not-allowed"
                  : "bg-red-500 hover:bg-red-600"
              )}
            >
              {sending ? "Sending..." : "Confirm & Send"}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/alerts/alert-composer.tsx
git commit -m "feat: add alert composer component"
```

---

### Task 5: Alert History Component

**Files:**
- Create: `src/components/alerts/alert-history.tsx`

- [ ] **Step 1: Create `src/components/alerts/alert-history.tsx`**

```tsx
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

type Alert = {
  id: string;
  title: string;
  status: string;
  emailsSent: number;
  smsSent: number;
  emailsFailed: number;
  smsFailed: number;
  createdAt: Date;
  sentBy: { firstName: string; lastName: string };
  feedPost: { content: string };
};

export function AlertHistory({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="text-center py-12">
        <Icon
          name="notifications_off"
          size={48}
          className="text-[var(--color-text-muted)] mx-auto mb-3"
        />
        <p className="text-[var(--color-text-muted)]">
          No emergency alerts have been sent yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="glass rounded-[var(--radius-xl)] p-5 border-l-4 border-l-red-500"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-bold text-[var(--color-on-surface)] truncate">
                  {alert.title}
                </h4>
                <span
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0",
                    alert.status === "SENT"
                      ? "bg-green-500/10 text-green-600"
                      : alert.status === "PARTIALLY_FAILED"
                        ? "bg-amber-500/10 text-amber-600"
                        : "bg-blue-500/10 text-blue-600"
                  )}
                >
                  {alert.status.replace("_", " ")}
                </span>
              </div>
              <p className="text-sm text-[var(--color-on-surface-variant)] line-clamp-2">
                {alert.feedPost.content}
              </p>
              <div className="flex items-center gap-4 mt-3 text-xs text-[var(--color-text-muted)]">
                <span>
                  By {alert.sentBy.firstName} {alert.sentBy.lastName}
                </span>
                <span>
                  {new Date(alert.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
            <div className="flex gap-4 shrink-0">
              <div className="text-center">
                <p className="text-lg font-black text-[var(--color-on-surface)]">
                  {alert.emailsSent}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                  Emails
                </p>
              </div>
              <div className="text-center">
                <p className="text-lg font-black text-[var(--color-on-surface)]">
                  {alert.smsSent}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                  SMS
                </p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/alerts/alert-history.tsx
git commit -m "feat: add alert history component"
```

---

### Task 6: Alerts Page

**Files:**
- Create: `src/app/(dashboard)/alerts/page.tsx`

- [ ] **Step 1: Create `src/app/(dashboard)/alerts/page.tsx`**

```tsx
import { requireAdmin } from "@/lib/auth-helpers";
import { getEmergencyAlerts } from "@/lib/actions/emergency-alerts";
import { AlertComposer } from "@/components/alerts/alert-composer";
import { AlertHistory } from "@/components/alerts/alert-history";
import { PageHeader } from "@/components/ui/page-header";
import { redirect } from "next/navigation";

export default async function AlertsPage() {
  const session = await requireAdmin();
  const role = session.user?.role;

  // Only ADMIN and SUPER_ADMIN
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    redirect("/");
  }

  const alerts = await getEmergencyAlerts();

  return (
    <div className="max-w-4xl mx-auto p-8">
      <PageHeader
        title="Emergency Alerts"
        description="Broadcast urgent messages to the entire company via feed, email, and SMS."
      />

      <div className="space-y-8">
        <AlertComposer />

        <div>
          <h3 className="text-lg font-bold text-[var(--color-on-surface)] mb-4">
            Alert History
          </h3>
          <AlertHistory alerts={alerts as any} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/alerts/page.tsx
git commit -m "feat: add alerts page"
```

---

## Chunk 3: Feed Styling + Sidebar

### Task 7: Emergency Post Styling in Feed

**Files:**
- Modify: `src/components/feed/post-card.tsx`

- [ ] **Step 1: Add EMERGENCY post rendering**

In `src/components/feed/post-card.tsx`, add a new block **before** the final `return` statement (before line 249). Insert it after the `NEW_HIRE` block (after line 247):

```tsx
  if (post.type === "EMERGENCY") {
    return (
      <article className={cn("rounded-2xl overflow-hidden", "bg-gradient-to-br from-red-500/10 via-red-400/5 to-orange-500/5", "border-2 border-red-500/30")}>
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="warning" size={20} fill className="text-red-500" />
            <span className="text-sm font-bold text-red-500 uppercase tracking-wider">Emergency Alert</span>
            <span className="text-sm text-[var(--color-text-muted)]">· {timeAgo(post.createdAt)}</span>
          </div>
          <p className="text-[var(--color-text-primary)] leading-relaxed whitespace-pre-line font-medium">{post.content}</p>
          <AttachmentGallery attachments={post.attachments} />
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-red-500/20">
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
              {post.author.profilePhoto ? (
                <img src={post.author.profilePhoto} alt="" className="h-5 w-5 rounded-full object-cover" />
              ) : (
                <div className={cn("h-5 w-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold", avatarColor)}>{initials}</div>
              )}
              <span>{post.author.firstName} {post.author.lastName}</span>
            </div>
          </div>
          <div className="pt-3 mt-1 border-t border-red-500/20">
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
git add src/components/feed/post-card.tsx
git commit -m "feat: add emergency post styling in feed"
```

---

### Task 8: Add Alerts to Sidebar

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Add nav link**

In `src/components/layout/sidebar.tsx`, find the `allNavLinks` array. Add the Alerts link after the Feed entry (after `{ href: "/", label: "Feed", ... }`):

```typescript
  { href: "/alerts", label: "Alerts", icon: "warning", access: (r: UserRole) => r === "SUPER_ADMIN" || r === "ADMIN" },
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat: add alerts link to sidebar for admins"
```

---

### Task 9: Build Verification and Deploy

- [ ] **Step 1: Run build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Test locally**

```bash
npm run dev
```

Verify:
- `/alerts` page loads for ADMIN/SUPER_ADMIN users
- Non-admin users get redirected from `/alerts`
- Sidebar shows "Alerts" link only for admins
- Alert composer shows form with confirmation dialog
- EMERGENCY posts in feed have red urgent styling

- [ ] **Step 3: Commit any fixes and push**

```bash
git push origin main
```
