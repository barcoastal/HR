# Onboarding Redesign: Department-Based Checklists with Signing

**Date:** 2026-03-12
**Status:** Draft

## Problem

The current onboarding system has department-scoped checklists but lacks:
- Per-job-title customization for senior/special positions
- Document signing flow (send docs, get them signed, store in employee file)
- Assigned employee notifications and dedicated task views
- Ability to preview/customize checklists before starting onboarding

## Design

### 1. Settings — Onboarding Tab

The settings page gets a dedicated **Onboarding Setup** tab (replacing the current inline checklist manager).

**Department selector:** Admin picks a department from a dropdown (plus a "Global (All Departments)" option). The UI shows all onboarding tasks for that department, ordered by `dueDay` then `order`.

**Task configuration:** Each task has:
- **Title** — what needs to happen (e.g. "Sign NDA")
- **Description** — optional details
- **Due day** — relative to start date. Stored as integer days: 0 (no schedule), 1, 2, 3, 5, 7, 14, 30, 60, 90. Displayed as "Day 1", "Week 1", "Month 1", etc.
- **Assigned employee** — dropdown of employees; this person is responsible for running the task with the new hire
- **Document action** — one of:
  - `NONE` — plain task, no documents involved
  - `SEND` — attach a document that gets emailed to the new hire (informational, no signature needed). Accepts PDF, DOC, DOCX, PNG, JPG, TXT.
  - `SIGN` — attach a **PDF only** that the new hire must sign via in-app signing; signed copy auto-saved to employee file

**Document upload:** Reuses existing `/api/onboarding-docs/upload` endpoint. For `SIGN` action, the UI restricts file picker to PDF only. Max 10MB.

**Job title overrides:** Within each department view, a collapsible section:
- "Add override for [job title]" dropdown (populated from `JobTitle` records)
- For a given job title, admin can:
  - **Add extra tasks** — stored as items on the override checklist
  - **Remove inherited tasks** — tracked via a `ChecklistOverrideExclusion` join table (not a JSON column)
- "Modify" an inherited task = exclude the original + add a replacement in the override
- Example: Sales department has 8 base tasks. "VP of Sales" override adds 2 compliance tasks and excludes "Shadow sales calls".

**Global checklist:** The "Global (All Departments)" option in the department selector configures tasks that apply to every new hire regardless of department. Existing checklists with `departmentId=null` are treated as global. Job title overrides only apply within departments, not on global checklists.

**Migration note:** Existing checklists with `departmentId=null` will be backfilled with `isOverride=false` and `jobTitleId=null` to fit the new schema. No behavior change for existing data.

### 2. Onboarding Page

**Starting onboarding — from CV hire:**
When `hireCandidateAndStartOnboarding()` runs:
1. Resolve department from the candidate's position
2. Resolve job title: match `Position.title` against `JobTitle.name` (case-insensitive exact match). If no match, skip override resolution — use base department + global tasks only.
3. Build checklist via resolution logic (Section 7)
4. Create `EmployeeTask` records with **denormalized snapshot** of task details (title, description, documentAction, documentUrl, documentName, assigneeId) so the record is stable even if the template changes later
5. For `SEND` tasks: send email with document attached
6. For `SIGN` tasks: create `SigningRequest` with secure token, send email with signing link
7. For tasks with assigned employees: send notification email to the assigned employee

**Starting onboarding — manual add:**
When creating an employee with status=ONBOARDING:
1. Admin selects department and job title (dropdown from `JobTitle` records)
2. System builds the checklist preview (same resolution logic)
3. Admin can review: add, remove, or reorder tasks before confirming
4. On confirm: creates `EmployeeTask` records and kicks off emails/signing
5. If the selected department has no checklists configured, show a warning: "No onboarding tasks configured for [Department]. You can add custom tasks or configure templates in Settings."

**Employee onboarding timeline:**
- Existing timeline UI enhanced with document status indicators:
  - `SEND` tasks: show "Document sent" with date
  - `SIGN` tasks: show status badge — Pending / Viewed / Signed
  - Click on signed docs to view the stored copy
- Assigned employee name shown on each task
- "Complete Onboarding" button when all tasks are done (existing behavior)

**"My Onboarding Tasks" section:**
- New section visible to all employees (not just admins)
- Resolution: authenticated `User` → `User.employeeId` → `Employee.id` → match against `EmployeeTask` records where the denormalized `assigneeId` equals the employee's ID
- Shows tasks assigned to the current user across all active onboarding employees
- Grouped by new hire: "Tasks for [Employee Name]"
- Each task shows: title, description, due day, new hire name, completion status
- Employee can mark their own assigned tasks as done from this view
- **Authorization:** `toggleEmployeeTask` checks that the caller is either (a) the assigned employee, (b) a MANAGER of the new hire, or (c) an ADMIN
- Email notification sent when a task is assigned

### 3. In-App Document Signing

**Signing flow:**
1. System generates a secure signing token using `crypto.randomBytes(32).toString('hex')` and creates a `SigningRequest` record
2. New hire receives email: "Please sign [Document Name]" with a link to `/sign/[token]`
3. `/sign/[token]` is a public page (no auth required) that:
   - Validates the token (not expired, not already signed)
   - Displays the PDF using an inline viewer
   - Provides signature input: draw on canvas or type name (rendered as signature font)
   - "Sign & Submit" button
4. On submit:
   - Client sends signature as base64 PNG image
   - Server uses `pdf-lib` to overlay signature + timestamp on the last page of the PDF
   - Store signed PDF via `/api/onboarding-docs/upload`
   - Create `Document` record linked to the employee (category: ONBOARDING)
   - Update `SigningRequest` status to SIGNED, set `signedAt` and `signedDocUrl`
   - Auto-mark the corresponding `EmployeeTask` as DONE
   - Send confirmation email to the new hire
5. Token expires after 30 days if unused
6. Rate limiting on `/sign/[token]` and `/api/sign/[token]` routes (10 requests/minute per IP)

**Signing page UI:**
- Clean, minimal page with company branding
- PDF viewer (inline, scrollable)
- Signature area at the bottom
- "I agree to sign this document" checkbox
- "Sign & Submit" button
- Success screen after signing

### 4. Data Model Changes

**Modified: `ChecklistItem`**
```
+ documentAction  String   @default("NONE")  // "NONE" | "SEND" | "SIGN"
```
Existing fields reused: `documentUrl`, `documentName`, `sendEmail`, `emailSubject`, `emailBody`.

**Modified: `OnboardingChecklist`**
```
+ jobTitleId      String?   // For job-title overrides (only when type=ONBOARDING)
+ isOverride      Boolean   @default(false)
```
Relation: `jobTitle JobTitle? @relation(fields: [jobTitleId], references: [id])`

Validation: `jobTitleId` and `isOverride=true` are only valid when `type=ONBOARDING`. Server actions enforce this.

Add relation on `JobTitle`:
```
+ checklists  OnboardingChecklist[]
```

**New model: `ChecklistOverrideExclusion`**
```prisma
model ChecklistOverrideExclusion {
  id                   String              @id @default(uuid())
  overrideChecklistId  String
  excludedItemId       String

  overrideChecklist    OnboardingChecklist @relation(fields: [overrideChecklistId], references: [id], onDelete: Cascade)
  excludedItem         ChecklistItem       @relation(fields: [excludedItemId], references: [id], onDelete: Cascade)

  @@unique([overrideChecklistId, excludedItemId])
  @@index([overrideChecklistId])
  @@index([excludedItemId])
}
```

Add relations:
- On `OnboardingChecklist`: `+ exclusions ChecklistOverrideExclusion[]`
- On `ChecklistItem`: `+ excludedBy ChecklistOverrideExclusion[]`

**Modified: `EmployeeTask` (denormalized snapshot)**
```
+ title          String?    // Snapshot from ChecklistItem at creation
+ description    String?
+ documentAction String?    // "NONE" | "SEND" | "SIGN"
+ documentUrl    String?    // (already exists) — snapshot of template doc URL
+ documentName   String?
+ assigneeId     String?    // Employee responsible for this task
```
Change cascade on `checklistItemId` from `Cascade` to `SetNull` so completed onboarding records survive template changes.

Add relation: `+ assignee Employee? @relation("TaskAssignee", fields: [assigneeId], references: [id], onDelete: SetNull)`
Add on Employee: `+ assignedTasks EmployeeTask[] @relation("TaskAssignee")`

**New model: `SigningRequest`**
```prisma
model SigningRequest {
  id              String   @id @default(uuid())
  employeeTaskId  String   @unique
  employeeId      String
  token           String   @unique
  documentUrl     String
  documentName    String
  status          String   @default("PENDING")  // PENDING | VIEWED | SIGNED
  signedDocUrl    String?
  signedAt        DateTime?
  viewedAt        DateTime?
  expiresAt       DateTime
  createdAt       DateTime @default(now())

  employeeTask    EmployeeTask @relation(fields: [employeeTaskId], references: [id], onDelete: Cascade)
  employee        Employee     @relation(fields: [employeeId], references: [id], onDelete: Cascade)

  @@index([employeeId])
}
```

Add on `EmployeeTask`: `+ signingRequest SigningRequest?`
Add on `Employee`: `+ signingRequests SigningRequest[]`

### 5. New Routes

| Route | Type | Purpose |
|-------|------|---------|
| `/sign/[token]` | Public page | Document signing UI for new hires |
| `/api/sign/[token]` | GET | Fetch signing request details + document |
| `/api/sign/[token]` | POST | Submit signature (base64 PNG), return signed PDF |

### 6. Email Templates

All emails use Resend. Company name should come from app config, not hardcoded.

**Document send email** (action=SEND):
- Subject: configurable per task in settings
- Body: configurable per task in settings + document download link

**Signing request email** (action=SIGN):
- Subject: "Please sign: [Document Name]"
- Body: "Hi [First Name], please review and sign [Document Name] for your onboarding. Click the link below to sign." + signing page link

**Task assignment email** (assigned employee):
- Subject: "Onboarding task assigned: [Task Title]"
- Body: "You've been assigned to help [New Hire Name] with: [Task Title]. [Description]"

**Signing confirmation email** (new hire):
- Subject: "Document signed: [Document Name]"
- Body: "Thanks for signing [Document Name]. A copy has been saved to your file."

### 7. Checklist Resolution Logic

When building the final task list for an employee (department X, job title Y):

```
1. Fetch global checklists (departmentId=null, isOverride=false, type=ONBOARDING)
2. Fetch department checklists (departmentId=X, isOverride=false, type=ONBOARDING)
3. Collect all items from steps 1+2
4. If job title Y is provided and matches a JobTitle record:
   a. Fetch override checklist (departmentId=X, jobTitleId=Y, isOverride=true)
   b. Fetch exclusions from ChecklistOverrideExclusion for that override
   c. Remove excluded items from the base list
   d. Add override's own items to the list
5. Order by dueDay, then order
6. Return final task list
```

If no match for job title Y, skip step 4 — use base tasks only.
If department X has no checklists, return only global tasks. If none exist, return empty (UI shows warning).

### 8. New Dependency

- `pdf-lib` — for overlaying signatures on PDFs server-side. Lightweight, no native dependencies, works in Node.js.

### 9. Out of Scope

- Legally binding e-signatures (this is internal HR signing only)
- Multi-signer workflows (one signer per document)
- Document versioning
- Automated reminders for unsigned documents (can be added later)
- Offboarding changes (stays as-is for now)
- Expired signing token cleanup (follow-up task)
