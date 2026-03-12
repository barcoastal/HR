# Onboarding Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign onboarding to support department-based checklists with job-title overrides, in-app document signing, and assigned employee task views.

**Architecture:** Extend existing Prisma models (OnboardingChecklist, ChecklistItem, EmployeeTask) with new fields and relations. Add a SigningRequest model and public signing page. Rebuild the settings checklist manager UI around department selection with override support. Enhance the onboarding page with document status tracking and "My Tasks" view.

**Tech Stack:** Next.js 16, React 19, Prisma 7, PostgreSQL, Resend (email), pdf-lib (PDF signing), Tailwind CSS, Framer Motion

**Spec:** `docs/superpowers/specs/2026-03-12-onboarding-redesign-design.md`

---

## File Structure

### New Files
| File | Purpose |
|------|---------|
| `src/lib/actions/signing.ts` | Server actions for signing requests (create, verify, submit) |
| `src/lib/actions/onboarding-resolution.ts` | Checklist resolution logic (global + dept + overrides) |
| `src/app/(public)/sign/[token]/page.tsx` | Public signing page (no auth) |
| `src/app/api/sign/[token]/route.ts` | API for fetching/submitting signatures |
| `src/components/settings/onboarding-setup.tsx` | New settings tab: department-based checklist editor with overrides |
| `src/components/onboarding/my-onboarding-tasks.tsx` | "My Onboarding Tasks" section for assigned employees |
| `src/components/onboarding/onboarding-preview.tsx` | Checklist preview dialog for manual onboarding start |
| `src/components/signing/signing-page.tsx` | Client component for the signing UI (PDF viewer + signature pad) |

### Modified Files
| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add SigningRequest, ChecklistOverrideExclusion models; modify OnboardingChecklist, ChecklistItem, EmployeeTask, Employee, JobTitle |
| `src/lib/actions/checklists.ts` | Add override CRUD, exclusion management |
| `src/lib/actions/employees.ts` | Update createEmployee to use resolution logic, denormalize tasks, handle SIGN/SEND actions; add auth to toggleEmployeeTask |
| `src/lib/actions/candidates.ts` | Update hireCandidateAndStartOnboarding to use resolution logic |
| `src/lib/email.ts` | Add sendSigningRequestEmail, sendTaskAssignmentEmail, sendSigningConfirmationEmail |
| `src/app/(dashboard)/settings/page.tsx` | Replace ChecklistManager with OnboardingSetup in the checklist tab |
| `src/app/(dashboard)/onboarding/page.tsx` | Add document status indicators, "My Tasks" section |
| `src/components/onboarding/onboarding-timeline.tsx` | Show document action badges (Sent/Pending/Signed), assignee name |
| `src/components/people/add-employee-form.tsx` | Add job title dropdown, trigger checklist preview when status=ONBOARDING |
| `package.json` | Add pdf-lib dependency |

---

## Chunk 1: Schema & Data Layer

### Task 1: Install pdf-lib dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install pdf-lib**

Run: `cd /Users/baralezrah/hr-platform && npm install pdf-lib`

- [ ] **Step 2: Verify installation**

Run: `node -e "require('pdf-lib'); console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add pdf-lib for document signing"
```

---

### Task 2: Update Prisma schema

**Files:**
- Modify: `prisma/schema.prisma` (lines 239-289 for onboarding models, 413-417 for JobTitle, 161-226 for Employee)

- [ ] **Step 1: Add `documentAction` to ChecklistItem**

In `prisma/schema.prisma`, add to the `ChecklistItem` model (after line 265 `documentName`):

```prisma
  documentAction   String              @default("NONE") // NONE | SEND | SIGN
```

- [ ] **Step 2: Add override fields to OnboardingChecklist**

In `prisma/schema.prisma`, add to the `OnboardingChecklist` model (after line 243 `departmentId`):

```prisma
  jobTitleId   String?
  isOverride   Boolean             @default(false)

  jobTitle     JobTitle?           @relation(fields: [jobTitleId], references: [id], onDelete: SetNull)
  exclusions   ChecklistOverrideExclusion[]
```

Add index after existing `@@index([departmentId])`:
```prisma
  @@index([jobTitleId])
```

- [ ] **Step 3: Add ChecklistOverrideExclusion model**

Add after the `ChecklistItem` model:

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

Add relation on `ChecklistItem`:
```prisma
  excludedBy       ChecklistOverrideExclusion[]
```

- [ ] **Step 4: Add denormalized fields to EmployeeTask**

In the `EmployeeTask` model (lines 275-289), add after `completedAt`:

```prisma
  title            String?
  description      String?
  documentAction   String?
  documentName     String?
  assigneeId       String?

  assignee         Employee?     @relation("TaskAssignee", fields: [assigneeId], references: [id], onDelete: SetNull)
```

Change `checklistItemId` from required to optional, and change cascade to SetNull:
```prisma
  checklistItemId String?
  checklistItem   ChecklistItem? @relation(fields: [checklistItemId], references: [id], onDelete: SetNull)
```

Add index:
```prisma
  @@index([assigneeId])
```

- [ ] **Step 5: Add SigningRequest model**

Add at the end of the schema (before the Time Off section):

```prisma
model SigningRequest {
  id              String       @id @default(uuid())
  employeeTaskId  String       @unique
  employeeId      String
  token           String       @unique
  documentUrl     String
  documentName    String
  status          String       @default("PENDING") // PENDING | VIEWED | SIGNED
  signedDocUrl    String?
  signedAt        DateTime?
  viewedAt        DateTime?
  expiresAt       DateTime
  createdAt       DateTime     @default(now())

  employeeTask    EmployeeTask @relation(fields: [employeeTaskId], references: [id], onDelete: Cascade)
  employee        Employee     @relation(fields: [employeeId], references: [id], onDelete: Cascade)

  @@index([employeeId])
}
```

- [ ] **Step 6: Add relations to Employee model**

In the `Employee` model (lines 161-226), add:

```prisma
  assignedTasks      EmployeeTask[]    @relation("TaskAssignee")
  signingRequests    SigningRequest[]
```

- [ ] **Step 7: Add relation to JobTitle model**

In the `JobTitle` model (lines 413-417), add:

```prisma
  checklists    OnboardingChecklist[]
```

- [ ] **Step 8: Add relation to EmployeeTask**

In the `EmployeeTask` model, add:

```prisma
  signingRequest  SigningRequest?
```

- [ ] **Step 9: Push schema and generate client**

Run: `cd /Users/baralezrah/hr-platform && npx prisma db push && npx prisma generate`
Expected: Schema pushed successfully, client generated.

- [ ] **Step 10: Commit**

```bash
git add prisma/schema.prisma src/generated/
git commit -m "feat: update schema for onboarding redesign - signing, overrides, denormalized tasks"
```

---

### Task 3: Checklist resolution logic

**Files:**
- Create: `src/lib/actions/onboarding-resolution.ts`

- [ ] **Step 1: Create the resolution module**

Create `src/lib/actions/onboarding-resolution.ts`:

```typescript
"use server";

import { db } from "@/lib/db";

type ResolvedTask = {
  checklistItemId: string;
  title: string;
  description: string | null;
  order: number;
  dueDay: number | null;
  assigneeId: string | null;
  documentAction: string;
  documentUrl: string | null;
  documentName: string | null;
  sendEmail: boolean;
  emailSubject: string | null;
  emailBody: string | null;
};

/**
 * Resolve the full onboarding task list for an employee.
 * Merges: global tasks + department tasks + job title overrides (extras - exclusions).
 */
export async function resolveOnboardingTasks(
  departmentId: string | null,
  jobTitle: string | null
): Promise<ResolvedTask[]> {
  // 1. Fetch global checklists
  const globalChecklists = await db.onboardingChecklist.findMany({
    where: { type: "ONBOARDING", departmentId: null, isOverride: false },
    include: { items: { orderBy: { order: "asc" } } },
  });

  // 2. Fetch department checklists
  const deptChecklists = departmentId
    ? await db.onboardingChecklist.findMany({
        where: { type: "ONBOARDING", departmentId, isOverride: false },
        include: { items: { orderBy: { order: "asc" } } },
      })
    : [];

  // 3. Collect base items
  const baseItems = [
    ...globalChecklists.flatMap((c) => c.items),
    ...deptChecklists.flatMap((c) => c.items),
  ];

  // 4. Resolve job title overrides
  let excludedIds = new Set<string>();
  let overrideItems: typeof baseItems = [];

  if (jobTitle && departmentId) {
    // Find matching JobTitle record (case-insensitive)
    const jobTitleRecord = await db.jobTitle.findFirst({
      where: { name: { equals: jobTitle, mode: "insensitive" } },
    });

    if (jobTitleRecord) {
      const overrideChecklist = await db.onboardingChecklist.findFirst({
        where: {
          type: "ONBOARDING",
          departmentId,
          jobTitleId: jobTitleRecord.id,
          isOverride: true,
        },
        include: {
          items: { orderBy: { order: "asc" } },
          exclusions: true,
        },
      });

      if (overrideChecklist) {
        excludedIds = new Set(overrideChecklist.exclusions.map((e) => e.excludedItemId));
        overrideItems = overrideChecklist.items;
      }
    }
  }

  // 5. Filter and merge
  const filteredBase = baseItems.filter((item) => !excludedIds.has(item.id));
  const allItems = [...filteredBase, ...overrideItems];

  // 6. Sort by dueDay then order
  allItems.sort((a, b) => {
    const dayA = a.dueDay ?? 0;
    const dayB = b.dueDay ?? 0;
    if (dayA !== dayB) return dayA - dayB;
    return a.order - b.order;
  });

  return allItems.map((item) => ({
    checklistItemId: item.id,
    title: item.title,
    description: item.description,
    order: item.order,
    dueDay: item.dueDay,
    assigneeId: item.assigneeId,
    documentAction: item.documentAction ?? "NONE",
    documentUrl: item.documentUrl,
    documentName: item.documentName,
    sendEmail: item.sendEmail,
    emailSubject: item.emailSubject,
    emailBody: item.emailBody,
  }));
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/baralezrah/hr-platform && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors related to this file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/onboarding-resolution.ts
git commit -m "feat: add checklist resolution logic (global + dept + overrides)"
```

---

### Task 4: Signing server actions

**Files:**
- Create: `src/lib/actions/signing.ts`

- [ ] **Step 1: Create signing actions**

Create `src/lib/actions/signing.ts`:

```typescript
"use server";

import { db } from "@/lib/db";
import crypto from "crypto";
import { PDFDocument } from "pdf-lib";
import { revalidatePath } from "next/cache";

export async function createSigningRequest(
  employeeTaskId: string,
  employeeId: string,
  documentUrl: string,
  documentName: string
) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  return db.signingRequest.create({
    data: {
      employeeTaskId,
      employeeId,
      token,
      documentUrl,
      documentName,
      expiresAt,
    },
  });
}

export async function getSigningRequestByToken(token: string) {
  const request = await db.signingRequest.findUnique({
    where: { token },
    include: { employee: true },
  });

  if (!request) return null;
  if (request.expiresAt < new Date()) return null;
  if (request.status === "SIGNED") return null;

  // Mark as viewed
  if (request.status === "PENDING") {
    await db.signingRequest.update({
      where: { id: request.id },
      data: { status: "VIEWED", viewedAt: new Date() },
    });
  }

  return request;
}

export async function submitSignature(
  token: string,
  signatureBase64: string
): Promise<{ success: boolean; error?: string }> {
  const request = await db.signingRequest.findUnique({
    where: { token },
    include: { employee: true, employeeTask: true },
  });

  if (!request || request.status === "SIGNED" || request.expiresAt < new Date()) {
    return { success: false, error: "Invalid or expired signing request" };
  }

  try {
    // Fetch original PDF
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const pdfResponse = await fetch(`${baseUrl}${request.documentUrl}`);
    if (!pdfResponse.ok) {
      return { success: false, error: "Could not fetch document" };
    }
    const pdfBytes = await pdfResponse.arrayBuffer();

    // Load PDF and add signature
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];

    // Decode signature image
    const sigImageBytes = Buffer.from(signatureBase64.replace(/^data:image\/png;base64,/, ""), "base64");
    const sigImage = await pdfDoc.embedPng(sigImageBytes);

    // Draw signature on last page (bottom area)
    const sigWidth = 200;
    const sigHeight = (sigImage.height / sigImage.width) * sigWidth;
    lastPage.drawImage(sigImage, {
      x: 50,
      y: 50,
      width: sigWidth,
      height: sigHeight,
    });

    // Add timestamp text
    const { rgb } = await import("pdf-lib");
    lastPage.drawText(`Signed: ${new Date().toISOString()} by ${request.employee.firstName} ${request.employee.lastName}`, {
      x: 50,
      y: 40,
      size: 8,
      color: rgb(0.4, 0.4, 0.4),
    });

    const signedPdfBytes = await pdfDoc.save();

    // Store signed PDF via upload
    const formData = new FormData();
    const signedBlob = new Blob([signedPdfBytes], { type: "application/pdf" });
    formData.append("file", signedBlob, `signed-${request.documentName}`);

    const uploadResponse = await fetch(`${baseUrl}/api/onboarding-docs/upload`, {
      method: "POST",
      body: formData,
    });

    if (!uploadResponse.ok) {
      return { success: false, error: "Failed to store signed document" };
    }

    const { url: signedDocUrl } = await uploadResponse.json();

    // Update signing request
    await db.signingRequest.update({
      where: { id: request.id },
      data: { status: "SIGNED", signedAt: new Date(), signedDocUrl },
    });

    // Auto-complete the employee task
    await db.employeeTask.update({
      where: { id: request.employeeTaskId },
      data: { status: "DONE", completedAt: new Date() },
    });

    // Store in employee documents
    await db.document.create({
      data: {
        employeeId: request.employeeId,
        name: `Signed: ${request.documentName}`,
        url: signedDocUrl,
        category: "ONBOARDING",
      },
    });

    revalidatePath("/onboarding");
    return { success: true };
  } catch (error) {
    console.error("Signing error:", error);
    return { success: false, error: "Failed to process signature" };
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/baralezrah/hr-platform && npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/signing.ts
git commit -m "feat: add signing server actions (create, verify, submit with pdf-lib)"
```

---

### Task 5: Email helpers

**Files:**
- Modify: `src/lib/email.ts`

- [ ] **Step 1: Add signing and assignment email functions**

Append to `src/lib/email.ts`:

```typescript
export async function sendSigningRequestEmail({
  to,
  firstName,
  documentName,
  signingUrl,
}: {
  to: string;
  firstName: string;
  documentName: string;
  signingUrl: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY not set, skipping signing request email");
    return;
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to,
      subject: `Please sign: ${documentName}`,
      html: `
        <p>Hi ${firstName},</p>
        <p>Please review and sign <strong>${documentName}</strong> for your onboarding.</p>
        <p><a href="${signingUrl}" style="display:inline-block;padding:12px 24px;background:#3052FF;color:white;text-decoration:none;border-radius:8px;">Review & Sign Document</a></p>
        <p>This link expires in 30 days.</p>
      `,
    });
  } catch (error) {
    console.error("Failed to send signing request email:", error);
  }
}

export async function sendTaskAssignmentEmail({
  to,
  assigneeName,
  newHireName,
  taskTitle,
  taskDescription,
}: {
  to: string;
  assigneeName: string;
  newHireName: string;
  taskTitle: string;
  taskDescription?: string | null;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY not set, skipping task assignment email");
    return;
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to,
      subject: `Onboarding task assigned: ${taskTitle}`,
      html: `
        <p>Hi ${assigneeName},</p>
        <p>You've been assigned to help <strong>${newHireName}</strong> with:</p>
        <p><strong>${taskTitle}</strong></p>
        ${taskDescription ? `<p>${taskDescription}</p>` : ""}
      `,
    });
  } catch (error) {
    console.error("Failed to send task assignment email:", error);
  }
}

export async function sendSigningConfirmationEmail({
  to,
  firstName,
  documentName,
}: {
  to: string;
  firstName: string;
  documentName: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: "onboarding@resend.dev",
      to,
      subject: `Document signed: ${documentName}`,
      html: `
        <p>Hi ${firstName},</p>
        <p>Thanks for signing <strong>${documentName}</strong>. A copy has been saved to your file.</p>
      `,
    });
  } catch (error) {
    console.error("Failed to send signing confirmation email:", error);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/email.ts
git commit -m "feat: add email helpers for signing requests, task assignments, confirmations"
```

---

### Task 6: Update employee/candidate actions to use resolution logic

**Files:**
- Modify: `src/lib/actions/employees.ts` (lines 60-129 createEmployee, 193-207 toggleEmployeeTask)
- Modify: `src/lib/actions/candidates.ts` (lines 259-347 hireCandidateAndStartOnboarding)

- [ ] **Step 1: Update createEmployee to use resolution + denormalization**

In `src/lib/actions/employees.ts`, replace the onboarding task creation block inside `createEmployee` (the section that fetches checklists and creates EmployeeTask records, approximately lines 80-128) with:

```typescript
    // If onboarding, resolve and create tasks
    if (data.status === "ONBOARDING") {
      const { resolveOnboardingTasks } = await import("./onboarding-resolution");
      const { createSigningRequest } = await import("./signing");
      const { sendSigningRequestEmail, sendTaskAssignmentEmail } = await import("@/lib/email");

      const resolvedTasks = await resolveOnboardingTasks(employee.departmentId, employee.jobTitle);
      const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

      for (const task of resolvedTasks) {
        const employeeTask = await db.employeeTask.create({
          data: {
            employeeId: employee.id,
            checklistItemId: task.checklistItemId,
            title: task.title,
            description: task.description,
            documentAction: task.documentAction,
            documentUrl: task.documentUrl,
            documentName: task.documentName,
            assigneeId: task.assigneeId,
          },
        });

        // Handle document actions
        if (task.documentAction === "SEND" && task.sendEmail && task.emailSubject && task.emailBody) {
          sendOnboardingEmail({
            to: employee.email,
            subject: task.emailSubject,
            body: task.emailBody,
            documentUrl: task.documentUrl,
            documentName: task.documentName,
          });
        } else if (task.documentAction === "SIGN" && task.documentUrl && task.documentName) {
          const signingReq = await createSigningRequest(
            employeeTask.id,
            employee.id,
            task.documentUrl,
            task.documentName
          );
          sendSigningRequestEmail({
            to: employee.email,
            firstName: employee.firstName,
            documentName: task.documentName,
            signingUrl: `${baseUrl}/sign/${signingReq.token}`,
          });
        } else if (task.sendEmail && task.emailSubject && task.emailBody) {
          sendOnboardingEmail({
            to: employee.email,
            subject: task.emailSubject,
            body: task.emailBody,
          });
        }

        // Notify assigned employee
        if (task.assigneeId) {
          const assignee = await db.employee.findUnique({ where: { id: task.assigneeId } });
          if (assignee) {
            sendTaskAssignmentEmail({
              to: assignee.email,
              assigneeName: assignee.firstName,
              newHireName: `${employee.firstName} ${employee.lastName}`,
              taskTitle: task.title,
              taskDescription: task.description,
            });
          }
        }
      }
    }
```

- [ ] **Step 2: Add authorization to toggleEmployeeTask**

In `src/lib/actions/employees.ts`, update `toggleEmployeeTask` (line 193) to check authorization. Add at the top of the function:

```typescript
  const session = await requireAuth();
  const task = await db.employeeTask.findUnique({
    where: { id: taskId },
    include: { employee: true },
  });
  if (!task) throw new Error("Task not found");

  // Allow: assigned employee, manager of the new hire, or admin
  const userEmployeeId = session.user?.employeeId;
  const isAssignee = task.assigneeId && task.assigneeId === userEmployeeId;
  const isManager = task.employee.managerId === userEmployeeId;
  const isAdmin = session.user?.role === "ADMIN";
  if (!isAssignee && !isManager && !isAdmin) {
    throw new Error("Not authorized to update this task");
  }
```

Import `requireAuth` from `@/lib/auth-helpers` if not already imported.

- [ ] **Step 3: Update hireCandidateAndStartOnboarding similarly**

In `src/lib/actions/candidates.ts`, replace the checklist fetching and task creation block (lines 268-333) with the same resolution logic pattern used in `createEmployee`. Use `resolveOnboardingTasks(candidate.position?.departmentId, candidate.position?.title)` and the same denormalization + email/signing flow.

- [ ] **Step 4: Verify compilation**

Run: `cd /Users/baralezrah/hr-platform && npx tsc --noEmit 2>&1 | head -30`

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/employees.ts src/lib/actions/candidates.ts
git commit -m "feat: wire up resolution logic, denormalized tasks, signing & notifications"
```

---

### Task 7: Update checklist CRUD for overrides

**Files:**
- Modify: `src/lib/actions/checklists.ts`

- [ ] **Step 1: Add override checklist and exclusion actions**

Append to `src/lib/actions/checklists.ts`:

```typescript
export async function createOverrideChecklist(
  departmentId: string,
  jobTitleId: string
) {
  const jobTitle = await db.jobTitle.findUnique({ where: { id: jobTitleId } });
  if (!jobTitle) throw new Error("Job title not found");

  const existing = await db.onboardingChecklist.findFirst({
    where: { departmentId, jobTitleId, isOverride: true, type: "ONBOARDING" },
  });
  if (existing) return existing;

  const checklist = await db.onboardingChecklist.create({
    data: {
      name: `${jobTitle.name} Override`,
      type: "ONBOARDING",
      departmentId,
      jobTitleId,
      isOverride: true,
    },
  });
  revalidatePath("/settings");
  return checklist;
}

export async function deleteOverrideChecklist(id: string) {
  await db.onboardingChecklist.delete({ where: { id } });
  revalidatePath("/settings");
}

export async function addExclusion(overrideChecklistId: string, excludedItemId: string) {
  await db.checklistOverrideExclusion.create({
    data: { overrideChecklistId, excludedItemId },
  });
  revalidatePath("/settings");
}

export async function removeExclusion(overrideChecklistId: string, excludedItemId: string) {
  await db.checklistOverrideExclusion.deleteMany({
    where: { overrideChecklistId, excludedItemId },
  });
  revalidatePath("/settings");
}

export async function getChecklistsForDepartment(departmentId: string | null) {
  return db.onboardingChecklist.findMany({
    where: {
      type: "ONBOARDING",
      departmentId,
      isOverride: false,
    },
    include: {
      items: {
        orderBy: { order: "asc" },
        include: { assignee: true },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function getOverridesForDepartment(departmentId: string) {
  return db.onboardingChecklist.findMany({
    where: {
      type: "ONBOARDING",
      departmentId,
      isOverride: true,
    },
    include: {
      jobTitle: true,
      items: {
        orderBy: { order: "asc" },
        include: { assignee: true },
      },
      exclusions: { include: { excludedItem: true } },
    },
    orderBy: { name: "asc" },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/actions/checklists.ts
git commit -m "feat: add checklist override CRUD and department query actions"
```

---

## Chunk 2: Signing Page & API

### Task 8: Signing API route

**Files:**
- Create: `src/app/api/sign/[token]/route.ts`

- [ ] **Step 1: Create the API route**

Create `src/app/api/sign/[token]/route.ts`:

```typescript
import { getSigningRequestByToken, submitSignature } from "@/lib/actions/signing";
import { sendSigningConfirmationEmail } from "@/lib/email";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const signingRequest = await getSigningRequestByToken(token);

  if (!signingRequest) {
    return NextResponse.json({ error: "Invalid or expired signing request" }, { status: 404 });
  }

  return NextResponse.json({
    documentUrl: signingRequest.documentUrl,
    documentName: signingRequest.documentName,
    employeeName: `${signingRequest.employee.firstName} ${signingRequest.employee.lastName}`,
    status: signingRequest.status,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await request.json();
  const { signatureBase64 } = body;

  if (!signatureBase64) {
    return NextResponse.json({ error: "Signature required" }, { status: 400 });
  }

  const result = await submitSignature(token, signatureBase64);

  if (result.success) {
    // Send confirmation email (fire and forget)
    const signingRequest = await getSigningRequestByToken(token);
    if (signingRequest) {
      sendSigningConfirmationEmail({
        to: signingRequest.employee.email,
        firstName: signingRequest.employee.firstName,
        documentName: signingRequest.documentName,
      });
    }
  }

  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/sign/
git commit -m "feat: add signing API route (GET details, POST signature)"
```

---

### Task 9: Public signing page

**Files:**
- Create: `src/app/(public)/sign/[token]/page.tsx`
- Create: `src/components/signing/signing-page.tsx`

- [ ] **Step 1: Create the signing client component**

Create `src/components/signing/signing-page.tsx`:

```typescript
"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { FileText, Check, Loader2, PenLine } from "lucide-react";

type SigningData = {
  documentUrl: string;
  documentName: string;
  employeeName: string;
  status: string;
};

export function SigningPage({ token, data }: { token: string; data: SigningData }) {
  const [mode, setMode] = useState<"view" | "sign" | "done">("view");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  const startDraw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    isDrawing.current = true;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1a1a1a";
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  }, []);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  }, []);

  const endDraw = useCallback(() => {
    isDrawing.current = false;
  }, []);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSubmit = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !agreed) return;
    setSubmitting(true);
    setError(null);

    try {
      const signatureBase64 = canvas.toDataURL("image/png");
      const res = await fetch(`/api/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureBase64 }),
      });
      const result = await res.json();
      if (result.success) {
        setMode("done");
      } else {
        setError(result.error || "Failed to submit signature");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (mode === "done") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Document Signed</h1>
          <p className="text-gray-600">Thanks for signing <strong>{data.documentName}</strong>. A copy has been saved to your file.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-lg font-semibold text-gray-900">Document Signing</h1>
        <p className="text-sm text-gray-500">Hi {data.employeeName}, please review and sign the document below.</p>
      </header>

      <div className="max-w-3xl mx-auto p-6">
        {/* PDF Viewer */}
        <div className="bg-white rounded-xl shadow-sm border mb-6">
          <div className="flex items-center gap-2 px-4 py-3 border-b bg-gray-50 rounded-t-xl">
            <FileText className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">{data.documentName}</span>
          </div>
          <div className="p-4">
            <iframe
              src={data.documentUrl}
              className="w-full rounded border"
              style={{ height: "60vh" }}
              title="Document Preview"
            />
          </div>
        </div>

        {/* Signature Area */}
        {mode === "view" && (
          <button
            onClick={() => setMode("sign")}
            className="w-full py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <PenLine className="h-4 w-4" />
            Proceed to Sign
          </button>
        )}

        {mode === "sign" && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Draw your signature</h2>
            <div className="border rounded-lg overflow-hidden mb-3 bg-white">
              <canvas
                ref={canvasRef}
                width={600}
                height={150}
                className="w-full cursor-crosshair touch-none"
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={endDraw}
              />
            </div>
            <button onClick={clearCanvas} className="text-xs text-gray-500 hover:text-gray-700 mb-4">
              Clear signature
            </button>

            <label className="flex items-start gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 rounded"
              />
              <span className="text-sm text-gray-700">I agree to sign this document</span>
            </label>

            {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={!agreed || submitting}
              className={cn(
                "w-full py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2",
                agreed && !submitting
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              )}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {submitting ? "Signing..." : "Sign & Submit"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the server page**

Create `src/app/(public)/sign/[token]/page.tsx`:

```typescript
import { getSigningRequestByToken } from "@/lib/actions/signing";
import { SigningPage } from "@/components/signing/signing-page";
import { FileText } from "lucide-react";

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const signingRequest = await getSigningRequestByToken(token);

  if (!signingRequest) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link Expired</h1>
          <p className="text-gray-600">This signing link is no longer valid. Please contact HR for a new link.</p>
        </div>
      </div>
    );
  }

  return (
    <SigningPage
      token={token}
      data={{
        documentUrl: signingRequest.documentUrl,
        documentName: signingRequest.documentName,
        employeeName: `${signingRequest.employee.firstName} ${signingRequest.employee.lastName}`,
        status: signingRequest.status,
      }}
    />
  );
}
```

- [ ] **Step 3: Create a layout for public pages (no sidebar/auth)**

Create `src/app/(public)/layout.tsx`:

```typescript
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 4: Verify build**

Run: `cd /Users/baralezrah/hr-platform && npx next build 2>&1 | tail -30`
Expected: Build succeeds with `/sign/[token]` in routes.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(public\)/ src/components/signing/
git commit -m "feat: add public document signing page with canvas signature"
```

---

## Chunk 3: Settings UI

### Task 10: Onboarding Setup component for Settings

**Files:**
- Create: `src/components/settings/onboarding-setup.tsx`
- Modify: `src/app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Create the OnboardingSetup component**

Create `src/components/settings/onboarding-setup.tsx`. This is a large component (~600 lines) that provides:
- Department dropdown selector (plus "Global" option)
- Task list for selected department with inline editing
- Each task shows: title, description, due day, assignee, document action (NONE/SEND/SIGN), document upload
- Add task form
- Job title overrides section (collapsible): add override for a job title, add extra tasks, exclude base tasks
- Reuse the same DUE_DAY_OPTIONS from the existing checklist manager

The component should:
- Accept props: `departments`, `employees`, `jobTitles`
- Use `getChecklistsForDepartment()` and `getOverridesForDepartment()` via server actions
- Call `createChecklist`, `addChecklistItem`, `updateChecklistItem`, `deleteChecklistItem` for base tasks
- Call `createOverrideChecklist`, `addExclusion`, `removeExclusion` for overrides
- For document upload, call `/api/onboarding-docs/upload` (same as existing checklist manager pattern at line 152-165 of `checklist-manager.tsx`)
- When `documentAction` is `SIGN`, restrict file picker to `.pdf` only

Follow the existing UI patterns from `checklist-manager.tsx` (glassmorphism cards, `var(--color-*)` CSS variables, Lucide icons). This is a full rewrite of the checklist management UI, not a modification of the existing file.

- [ ] **Step 2: Update settings page to use OnboardingSetup**

In `src/app/(dashboard)/settings/page.tsx`, replace the ChecklistManager import and usage with OnboardingSetup:
- Fetch `jobTitles` alongside existing data
- Pass `departments`, `employees`, `jobTitles` to `<OnboardingSetup />`
- Replace the checklist tab content

- [ ] **Step 3: Verify build**

Run: `cd /Users/baralezrah/hr-platform && npx next build 2>&1 | tail -20`

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/onboarding-setup.tsx src/app/\(dashboard\)/settings/page.tsx
git commit -m "feat: add onboarding setup tab in settings with department checklists and overrides"
```

---

## Chunk 4: Onboarding Page Enhancements

### Task 11: Update onboarding timeline with document status

**Files:**
- Modify: `src/components/onboarding/onboarding-timeline.tsx`
- Modify: `src/app/(dashboard)/onboarding/page.tsx`

- [ ] **Step 1: Update the timeline component**

In `src/components/onboarding/onboarding-timeline.tsx`, update the `TaskItem` type to include:
```typescript
  documentAction?: string | null;
  documentName?: string | null;
  assigneeName?: string | null;
  signingStatus?: string | null; // PENDING | VIEWED | SIGNED
```

Add visual indicators in the task row:
- For `SEND` tasks: show a `<FileText />` icon with "Sent" label
- For `SIGN` tasks: show a badge — amber "Pending", blue "Viewed", green "Signed"
- Show assignee name as a small chip: "Assigned to: [Name]"

- [ ] **Step 2: Update onboarding page data fetching**

In `src/app/(dashboard)/onboarding/page.tsx`, update the employee task query to include:
```typescript
employeeTasks: {
  include: {
    checklistItem: { include: { checklist: true } },
    signingRequest: true,
    assignee: true,
  },
},
```

Map the denormalized fields + signing status into the timeline props.

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/onboarding-timeline.tsx src/app/\(dashboard\)/onboarding/page.tsx
git commit -m "feat: show document status and assignee on onboarding timeline"
```

---

### Task 12: My Onboarding Tasks section

**Files:**
- Create: `src/components/onboarding/my-onboarding-tasks.tsx`
- Modify: `src/app/(dashboard)/onboarding/page.tsx`

- [ ] **Step 1: Create MyOnboardingTasks component**

Create `src/components/onboarding/my-onboarding-tasks.tsx`:

```typescript
"use client";

import { cn } from "@/lib/utils";
import { toggleEmployeeTask } from "@/lib/actions/employees";
import { useState } from "react";
import { CheckCircle2, Circle, User } from "lucide-react";

type AssignedTask = {
  id: string;
  title: string;
  description: string | null;
  status: "PENDING" | "DONE";
  completedAt: string | null;
  dueDay: number | null;
  employeeName: string;
  employeeId: string;
};

export function MyOnboardingTasks({ tasks }: { tasks: AssignedTask[] }) {
  const [localTasks, setLocalTasks] = useState(tasks);

  if (localTasks.length === 0) return null;

  // Group by employee
  const grouped = localTasks.reduce<Record<string, { name: string; tasks: AssignedTask[] }>>((acc, task) => {
    if (!acc[task.employeeId]) {
      acc[task.employeeId] = { name: task.employeeName, tasks: [] };
    }
    acc[task.employeeId].tasks.push(task);
    return acc;
  }, {});

  const handleToggle = async (taskId: string) => {
    setLocalTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status: t.status === "DONE" ? "PENDING" : "DONE", completedAt: t.status === "DONE" ? null : new Date().toISOString() }
          : t
      )
    );
    await toggleEmployeeTask(taskId);
  };

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3">My Onboarding Tasks</h2>
      <div className="space-y-4">
        {Object.entries(grouped).map(([empId, group]) => (
          <div key={empId} className={cn("rounded-2xl p-4", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4 text-[var(--color-text-muted)]" />
              <span className="text-sm font-medium text-[var(--color-text-primary)]">Tasks for {group.name}</span>
            </div>
            <div className="space-y-2">
              {group.tasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => handleToggle(task.id)}
                  className="flex items-start gap-3 w-full text-left p-2 rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors"
                >
                  {task.status === "DONE" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-5 w-5 text-[var(--color-text-muted)] shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className={cn("text-sm", task.status === "DONE" ? "line-through text-[var(--color-text-muted)]" : "text-[var(--color-text-primary)]")}>
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{task.description}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire into onboarding page**

In `src/app/(dashboard)/onboarding/page.tsx`:
- Get the current user's employeeId from the session
- Query `EmployeeTask` where `assigneeId` equals the user's employeeId and the employee's status is ONBOARDING
- Pass the results to `<MyOnboardingTasks />`
- Render below the existing onboarding sections

- [ ] **Step 3: Commit**

```bash
git add src/components/onboarding/my-onboarding-tasks.tsx src/app/\(dashboard\)/onboarding/page.tsx
git commit -m "feat: add My Onboarding Tasks section for assigned employees"
```

---

### Task 13: Onboarding preview for manual employee creation

**Files:**
- Create: `src/components/onboarding/onboarding-preview.tsx`
- Modify: `src/components/people/add-employee-form.tsx`

- [ ] **Step 1: Create the preview component**

Create `src/components/onboarding/onboarding-preview.tsx` — a dialog that:
- Accepts `departmentId` and `jobTitle` (string)
- Calls `resolveOnboardingTasks()` to build the preview list
- Shows all tasks with their document action, assignee, due day
- Allows admin to remove individual tasks from the list
- "Confirm & Start Onboarding" button that creates the employee with the customized task list
- "Cancel" to go back

- [ ] **Step 2: Update add-employee-form**

In `src/components/people/add-employee-form.tsx`:
- Add a job title dropdown (fetch from `getJobTitles()`) alongside the existing free-text `jobTitle` field. Use the dropdown to select from existing titles, with option to type custom.
- When `status` is set to `ONBOARDING` and both department and job title are selected, show a "Preview Onboarding" button that opens the preview dialog
- The preview dialog handles the actual employee creation (with customized tasks)

- [ ] **Step 3: Verify build**

Run: `cd /Users/baralezrah/hr-platform && npx next build 2>&1 | tail -20`

- [ ] **Step 4: Commit**

```bash
git add src/components/onboarding/onboarding-preview.tsx src/components/people/add-employee-form.tsx
git commit -m "feat: add onboarding checklist preview when creating employee with ONBOARDING status"
```

---

## Chunk 5: Final Integration & Cleanup

### Task 14: End-to-end verification

- [ ] **Step 1: Build the full app**

Run: `cd /Users/baralezrah/hr-platform && npx next build 2>&1 | tail -30`
Expected: Clean build, no errors.

- [ ] **Step 2: Push schema to DB**

Run: `cd /Users/baralezrah/hr-platform && npx prisma db push`

- [ ] **Step 3: Manual smoke test checklist**

Test in browser:
1. Settings → Onboarding tab → Select a department → Add tasks with NONE/SEND/SIGN actions
2. Add a job title override → Add extra task → Exclude a base task
3. Onboarding page → Verify existing onboarding employees still show correctly
4. People → Add Employee with status=ONBOARDING → Verify preview dialog shows resolved tasks
5. Open signing link (from email or DB) → View PDF → Draw signature → Submit
6. Verify signed document appears in employee's documents
7. Check "My Onboarding Tasks" section shows tasks assigned to current user

- [ ] **Step 4: Final commit and push**

```bash
git add -A
git commit -m "feat: complete onboarding redesign - signing, overrides, task assignment"
git push
```
