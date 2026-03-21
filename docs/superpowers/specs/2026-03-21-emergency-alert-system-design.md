# Emergency Alert System — Design Spec

## Goal

Allow ADMIN and SUPER_ADMIN users to broadcast urgent alerts to the entire company. A single action creates a pinned feed post, sends email to all employees, and sends SMS (via Twilio) to employees with phone numbers on file.

## Constraints

- Only ADMIN and SUPER_ADMIN can create alerts
- One severity level — everything is urgent
- Dedicated `/alerts` page for composing and viewing alert history
- Email via existing Resend infrastructure
- SMS via new Twilio integration
- Employees without phone numbers receive email only

---

## Data Model

### Prisma Schema Changes

**Add to `FeedPostType` enum:**
```
EMERGENCY
```

**New model:**
```prisma
model EmergencyAlert {
  id          String   @id @default(uuid())
  feedPostId  String   @unique
  feedPost    FeedPost @relation(fields: [feedPostId], references: [id])
  title       String
  sentById    String
  sentBy      Employee @relation(fields: [sentById], references: [id])
  emailsSent  Int      @default(0)
  smsSent     Int      @default(0)
  emailsFailed Int     @default(0)
  smsFailed   Int      @default(0)
  sentAt      DateTime @default(now())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("emergency_alert")
}
```

**Relations to add:**
- `FeedPost` gets optional `emergencyAlert EmergencyAlert?`
- `Employee` gets `emergencyAlerts EmergencyAlert[]`

---

## SMS Integration (Twilio)

### New file: `src/lib/sms.ts`

- Install `twilio` npm package
- Environment variables: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- Export `sendSMS(to: string, body: string): Promise<boolean>` — sends a single SMS, returns success/failure
- Handles errors gracefully (invalid numbers, Twilio failures) without crashing the alert flow

---

## Server Action

### New file: `src/lib/actions/emergency-alerts.ts`

**`sendEmergencyAlert(title: string, message: string)`**

1. Auth check: require ADMIN or SUPER_ADMIN via `requireAdmin()`
2. Get current user's employee record
3. Fetch all active employees (`status === "ACTIVE"`) with `email` and `phone`
4. Create `FeedPost` with:
   - `type: EMERGENCY`
   - `pinned: true`
   - `content: message`
   - `authorId: employeeId`
5. Create linked `EmergencyAlert` record with `title` and `sentById`
6. Send emails in parallel to all employees via Resend
   - Subject: `[EMERGENCY] {title}`
   - Body: HTML template with title + message + company branding
7. Send SMS in parallel to employees who have `phone` set via Twilio
   - Body: `[EMERGENCY] {title}: {message}` (truncated to 160 chars if needed)
8. Update `EmergencyAlert` with delivery counts (`emailsSent`, `smsSent`, `emailsFailed`, `smsFailed`)
9. Revalidate `/alerts` and `/` (feed) paths

**`getEmergencyAlerts()`**

- Fetch all `EmergencyAlert` records with `sentBy` and `feedPost` relations
- Order by `sentAt` descending
- Protected by `requireAdmin()`

---

## Pages & UI

### `/alerts` page — `src/app/(dashboard)/alerts/page.tsx`

**Access:** ADMIN and SUPER_ADMIN only (via `requireAdmin()`)

**Layout:**
- PageHeader: "Emergency Alerts" with description
- Compose section: form with title input + message textarea + "Send Emergency Alert" red button
- Confirmation dialog before sending (using existing `Dialog` component): "This will send an email to all employees and SMS to those with phone numbers. Are you sure?"
- Alert history section: list of past alerts showing title, date, sent by, email/SMS delivery stats

### Feed rendering — `src/components/feed/post-card.tsx`

- `EMERGENCY` type posts render with:
  - Red left border or red background tint
  - `warning` Material Symbol icon
  - Bold title treatment
  - Visually distinct from all other post types

### Sidebar — `src/components/layout/sidebar.tsx`

- Add nav link: `{ href: "/alerts", label: "Alerts", icon: "warning", access: (r) => r === "SUPER_ADMIN" || r === "ADMIN" }`
- Position after "Feed" in the nav order

---

## Email Template

New email for emergency alerts (not stored in `EmailTemplate` table — hardcoded in the action since it's a system-level message):

- From: company sender email (from CompanySettings)
- Subject: `[EMERGENCY] {title}`
- Body: branded HTML with red header bar, title, message body, company logo
- Footer: "This is an emergency alert from {companyName}"

---

## Permissions

- Use existing `requireAdmin()` helper which allows SUPER_ADMIN, ADMIN, and HR
- Override in the action to restrict to ADMIN and SUPER_ADMIN only (exclude HR)
- No new permission key needed — role check is sufficient

---

## Environment Variables (new)

```
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
```

---

## File Summary

| Action | File |
|--------|------|
| Create | `src/lib/sms.ts` |
| Create | `src/lib/actions/emergency-alerts.ts` |
| Create | `src/app/(dashboard)/alerts/page.tsx` |
| Create | `src/components/alerts/alert-composer.tsx` |
| Create | `src/components/alerts/alert-history.tsx` |
| Modify | `prisma/schema.prisma` (enum + model) |
| Modify | `src/components/feed/post-card.tsx` (EMERGENCY style) |
| Modify | `src/components/layout/sidebar.tsx` (nav link) |
