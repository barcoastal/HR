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

**Department selector:** Admin picks a department from a dropdown. The UI shows all onboarding tasks for that department, ordered by `dueDay` then `order`.

**Task configuration:** Each task has:
- **Title** — what needs to happen (e.g. "Sign NDA")
- **Description** — optional details
- **Due day** — relative to start date (Day 1, Week 1, Month 1, etc.)
- **Assigned employee** — dropdown of employees; this person is responsible for running the task with the new hire
- **Document action** — one of:
  - `NONE` — plain task, no documents involved
  - `SEND` — attach a document that gets emailed to the new hire (informational, no signature needed)
  - `SIGN` — attach a PDF that the new hire must sign via in-app signing; signed copy auto-saved to employee file

**Document upload:** For `SEND` and `SIGN` actions, admin uploads the document directly in the settings UI. Reuses existing `/api/onboarding-docs/upload` endpoint. Accepted formats: PDF, DOC, DOCX, PNG, JPG, TXT. Max 10MB.

**Job title overrides:** Within each department view, a secondary section allows overrides per job title:
- "Add override for [job title]" dropdown
- For a given job title, admin can: add extra tasks, remove inherited tasks, or modify task details
- Override tasks are stored separately and merged with department tasks at onboarding time
- Example: Sales department has 8 base tasks. "VP of Sales" override adds 2 compliance tasks and removes the "Shadow sales calls" task.

**Global checklist:** A "Global (All Departments)" option in the department selector configures tasks that apply to every new hire regardless of department.

### 2. Onboarding Page

**Starting onboarding — from CV hire:**
When `hireCandidateAndStartOnboarding()` runs:
1. Resolve department from the candidate's position
2. Resolve job title from the position title (match against `JobTitle` records)
3. Build checklist: global tasks + department tasks + job title overrides (add extras, remove exclusions, apply modifications)
4. Create `EmployeeTask` records for all resolved tasks
5. For `SEND` tasks: send email with document attached
6. For `SIGN` tasks: create `SigningRequest`, send email with signing link
7. For tasks with assigned employees: send notification email to the assigned employee

**Starting onboarding — manual add:**
When creating an employee with status=ONBOARDING:
1. Admin selects department and job title
2. System builds the checklist preview (same resolution logic)
3. Admin can review: add, remove, or reorder tasks before confirming
4. On confirm: creates `EmployeeTask` records and kicks off emails/signing

**Employee onboarding timeline:**
- Existing timeline UI enhanced with document status indicators:
  - `SEND` tasks: show "Document sent" with date
  - `SIGN` tasks: show status badge — Pending / Viewed / Signed
  - Click on signed docs to view the stored copy
- Assigned employee name shown on each task
- "Complete Onboarding" button when all tasks are done (existing behavior)

**"My Onboarding Tasks" section:**
- New section visible to all employees (not just admins)
- Shows tasks assigned to the current user across all active onboarding employees
- Grouped by new hire: "Tasks for [Employee Name]"
- Each task shows: title, description, due day, new hire name, completion status
- Employee can mark tasks as done from this view
- Email notification sent when a task is assigned

### 3. In-App Document Signing

**Signing flow:**
1. System generates a unique signing token (UUID) and creates a `SigningRequest` record
2. New hire receives email: "Please sign [Document Name]" with a link to `/sign/[token]`
3. `/sign/[token]` is a public page (no auth required) that:
   - Validates the token (not expired, not already signed)
   - Displays the PDF in a viewer
   - Provides signature input: draw on canvas or type name (rendered as signature font)
   - "Sign & Submit" button
4. On submit:
   - Generate signed PDF (original + signature overlay + timestamp)
   - Store signed PDF via `/api/onboarding-docs/upload`
   - Create `Document` record linked to the employee (category: ONBOARDING)
   - Update `SigningRequest` status to SIGNED
   - Auto-mark the corresponding `EmployeeTask` as DONE
   - Send confirmation email to the new hire
5. Token expires after 30 days if unused

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
+ jobTitleId      String?   // For job-title overrides
+ isOverride      Boolean   @default(false)
+ excludedItemIds String?   // JSON array of base checklist item IDs to exclude
```
Relation: `jobTitle JobTitle? @relation(fields: [jobTitleId], references: [id])`

Add relation on `JobTitle`:
```
+ checklists  OnboardingChecklist[]
```

**New model: `SigningRequest`**
```prisma
model SigningRequest {
  id              String   @id @default(uuid())
  employeeTaskId  String
  employeeId      String
  token           String   @unique
  documentUrl     String   // Original document URL
  documentName    String
  status          String   @default("PENDING")  // PENDING | VIEWED | SIGNED
  signedDocUrl    String?  // Stored signed document
  signedAt        DateTime?
  viewedAt        DateTime?
  expiresAt       DateTime
  createdAt       DateTime @default(now())

  employeeTask    EmployeeTask @relation(fields: [employeeTaskId], references: [id], onDelete: Cascade)
  employee        Employee     @relation(fields: [employeeId], references: [id], onDelete: Cascade)

  @@index([token])
  @@index([employeeTaskId])
  @@index([employeeId])
}
```

Add relation on `EmployeeTask`:
```
+ signingRequest  SigningRequest?
```

Add relation on `Employee`:
```
+ signingRequests SigningRequest[]
```

### 5. New Routes

| Route | Type | Purpose |
|-------|------|---------|
| `/sign/[token]` | Public page | Document signing UI for new hires |
| `/api/sign/[token]` | GET | Fetch signing request details + document |
| `/api/sign/[token]` | POST | Submit signature, store signed doc |

### 6. Email Templates

**Document send email** (action=SEND):
- Subject: configurable in settings
- Body: configurable in settings + document download link

**Signing request email** (action=SIGN):
- Subject: "Please sign: [Document Name]"
- Body: "Hi [First Name], please review and sign [Document Name] for your onboarding at Coastal Debt. Click the link below to sign." + signing page link

**Task assignment email** (assigned employee):
- Subject: "Onboarding task assigned: [Task Title]"
- Body: "You've been assigned to help [New Hire Name] with: [Task Title]. [Description]"

**Signing confirmation email** (new hire):
- Subject: "Document signed: [Document Name]"
- Body: "Thanks for signing [Document Name]. A copy has been saved to your file."

### 7. Checklist Resolution Logic

When building the final task list for an employee:

```
1. Fetch global checklists (departmentId=null, jobTitleId=null, isOverride=false)
2. Fetch department checklists (departmentId=X, jobTitleId=null, isOverride=false)
3. Fetch job title overrides (departmentId=X, jobTitleId=Y, isOverride=true)
4. Combine: global items + department items
5. Apply overrides: add extra items, remove excluded items
6. Order by dueDay, then order
7. Return final task list
```

### 8. Out of Scope

- Legally binding e-signatures (this is internal HR signing only)
- Multi-signer workflows (one signer per document)
- Document versioning
- Automated reminders for unsigned documents (can be added later)
- Offboarding changes (stays as-is for now)
