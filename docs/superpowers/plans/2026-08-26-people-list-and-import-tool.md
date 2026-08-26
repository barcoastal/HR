# People List + Import Tool (Sections 1–3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the People card grid with a grouped list, and add a staged employee-import tool (upload → map → review duplicates side by side → merge/keep separate/skip) with persistent import history, at `/data`.

**Architecture:** Pure, unit-tested modules under `src/lib/import-export/` (field registry, CSV parser, normalization/validation, duplicate detection, merge planning) are composed by a server-only batch service and a `"use server"` actions file. Three new Prisma models persist batches, rows, and duplicate groups. Client components under `src/components/data/` render the wizard; the People page gets a rewritten `people-list.tsx`.

**Tech Stack:** Next.js 16 (App Router, server actions, route handlers), React 19, Prisma 7 (generated client at `@/generated/prisma/client`, `db` from `@/lib/db`), Tailwind with `var(--color-*)` tokens, `exceljs` (new), `vitest` (new, dev).

**Spec:** `docs/superpowers/specs/2026-08-26-people-list-and-import-export-design.md`

## Global Constraints

- Work on branch `feature/people-list-import-export`. **Commit locally; never push** — `main` auto-deploys to production and the user reviews on localhost first.
- Local DB: `.env.local` → `postgresql://…@localhost:5432/hr_platform`. Apply schema with `npm run db:push` (no migration files).
- Roles allowed into the tool: `SUPER_ADMIN`, `ADMIN`, `HR`. Pages use `requireAdmin()` (redirects), API route uses `requireApiAdmin()` (returns null → 403), server actions call `requireImportAccess()` which throws `Error("Forbidden")`.
- `db.employee.findMany/findFirst` hide archived rows unless `where.archivedAt` is set explicitly (see `src/lib/db.ts`). To include archived people run a second query with `archivedAt: { not: null }`.
- Prisma `Json` columns: cast on read (`row.data as RowData`), cast on write (`data as Prisma.InputJsonValue`), `import { Prisma } from "@/generated/prisma/client"`.
- UI conventions: `cn` from `@/lib/utils`, `Icon` (Material Symbols names) from `@/components/ui/icon`, `Dialog({ open, onClose, title })`, `PageHeader({ title, description, action })`, colors via `var(--color-surface|border|text-primary|text-muted|accent|accent-hover|surface-hover|background|primary|primary-fixed)`.
- Run `npx tsc --noEmit -p tsconfig.json` and `npm test` before every commit.
- Tests live in `src/lib/import-export/__tests__/*.test.ts` and import via `@/…`.
- Field keys are the single source of truth in `EMPLOYEE_FIELDS`; never hard-code a second list of importable fields.

## File structure

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` | + `ImportBatch`, `ImportRow`, `ImportDuplicateGroup`, 3 enums, `User.importBatches` |
| `vitest.config.ts`, `package.json` | test runner + `@` alias, `test` script, deps |
| `src/lib/import-export/types.ts` | shared types (FieldKey, RowData, MemberRef, …) |
| `src/lib/import-export/employee-fields.ts` | `EMPLOYEE_FIELDS`, `FIELD_BY_KEY`, `normalizeHeader`, `autoDetectMapping` |
| `src/lib/import-export/parse-csv.ts` | `parseCsv(text)` (pure) |
| `src/lib/import-export/normalize.ts` | email/phone/name normalization, `parseDate`, `applyMapping`, `validateRow` |
| `src/lib/import-export/duplicates.ts` | `detectDuplicates(rows, employees)` (pure) |
| `src/lib/import-export/merge.ts` | `defaultFieldChoices`, `buildMergePlan` (pure) |
| `src/lib/import-export/employee-row.ts` | `employeeToRowData(employee)` (pure) |
| `src/lib/import-export/parse-file.ts` | server: sniff csv/xlsx, `parseUpload(buffer, fileName)` |
| `src/lib/import-export/batch-service.ts` | server: `rebuildBatchRows`, `runBatchDetection`, `loadEmployeesLite` |
| `src/lib/actions/imports.ts` | `"use server"` actions used by the UI |
| `src/app/api/data/imports/route.ts` | `POST` multipart upload |
| `src/app/(dashboard)/data/page.tsx` | Import / Export tabs page |
| `src/app/(dashboard)/data/imports/[id]/page.tsx` | batch page |
| `src/components/data/*.tsx` | `imports-list`, `new-import-dialog`, `import-steps`, `import-batch-view`, `mapping-step`, `review-step`, `compare-panel`, `row-editor`, `import-step`, `export-placeholder` |
| `src/components/people/people-list.tsx` | rewritten grouped list |
| `src/app/(dashboard)/people/page.tsx`, `src/lib/actions/employees.ts` | manager include, header buttons, delete bulk import |
| `src/components/layout/sidebar.tsx`, `mobile-nav.tsx` | nav entry |

Parallel lanes: Task 1 first. Then Task 2 (People list) runs in parallel with Tasks 3→(4,5,6,7 in parallel)→8→9→10→11→12.

---

### Task 1: Branch, dependencies, test runner, Prisma models

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Modify: `prisma/schema.prisma` (append after `model GustoConnection`, and add relation line inside `model User`)
- Create: `src/lib/import-export/__tests__/smoke.test.ts`

**Interfaces:**
- Produces: Prisma models `ImportBatch`, `ImportRow`, `ImportDuplicateGroup`; enums `ImportBatchStatus`, `ImportRowAction`, `ImportGroupStatus`; `npm test`.

- [ ] **Step 1: Create the branch**

```bash
git checkout -b feature/people-list-import-export
```

- [ ] **Step 2: Install dependencies**

```bash
npm install exceljs
npm install -D vitest
```

- [ ] **Step 3: Add the test script and vitest config**

In `package.json` `scripts`, add `"test": "vitest run"`.

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["src/**/__tests__/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
```

- [ ] **Step 4: Write a smoke test and run it**

`src/lib/import-export/__tests__/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("vitest", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm test` — Expected: 1 passed.

- [ ] **Step 5: Add Prisma enums and models**

Append to the end of `prisma/schema.prisma`:

```prisma
// ---------------------
// Import & Export
// ---------------------

enum ImportBatchStatus {
  REVIEWING
  IMPORTED
  DISCARDED
}

enum ImportRowAction {
  CREATE
  UPDATE
  SKIP
  MERGED_AWAY
}

enum ImportGroupStatus {
  PENDING
  MERGED
  SEPARATE
}

model ImportBatch {
  id           String            @id @default(uuid())
  fileName     String
  fileType     String
  headers      Json
  mapping      Json?
  status       ImportBatchStatus @default(REVIEWING)
  rowCount     Int
  summary      Json?
  uploadedById String
  uploadedBy   User              @relation("ImportBatchUploader", fields: [uploadedById], references: [id])
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt
  importedAt   DateTime?

  rows   ImportRow[]
  groups ImportDuplicateGroup[]

  @@index([status])
  @@index([createdAt])
}

model ImportRow {
  id               String          @id @default(uuid())
  batchId          String
  batch            ImportBatch     @relation(fields: [batchId], references: [id], onDelete: Cascade)
  rowNumber        Int
  raw              Json
  data             Json
  errors           Json
  action           ImportRowAction @default(CREATE)
  targetEmployeeId String?
  mergedIntoRowId  String?
  skipReason       String?
  resultEmployeeId String?

  @@index([batchId])
}

model ImportDuplicateGroup {
  id        String            @id @default(uuid())
  batchId   String
  batch     ImportBatch       @relation(fields: [batchId], references: [id], onDelete: Cascade)
  status    ImportGroupStatus @default(PENDING)
  reasons   Json
  members   Json
  primary   Json?
  snapshot  Json?
  createdAt DateTime          @default(now())

  @@index([batchId])
}
```

Inside `model User`, after the line `organizedInterviews Interview[]       @relation("InterviewCalendarOrganizer")`, add:

```prisma
  importBatches       ImportBatch[]     @relation("ImportBatchUploader")
```

- [ ] **Step 6: Push the schema and regenerate**

```bash
npm run db:push
npx tsc --noEmit -p tsconfig.json
```

Expected: `db push` reports the three tables created; tsc has no errors.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts prisma/schema.prisma src/lib/import-export/__tests__/smoke.test.ts
git commit -m "chore: add vitest, exceljs and import batch models"
```

---

### Task 2: People page as a grouped list

**Files:**
- Modify: `src/lib/actions/employees.ts` — `getEmployees` include (line ~41); delete `bulkImportEmployees` (lines 1002–1152)
- Delete: `src/components/people/bulk-employee-import.tsx`
- Rewrite: `src/components/people/people-list.tsx`
- Modify: `src/app/(dashboard)/people/page.tsx`
- Modify: `src/components/layout/sidebar.tsx` (nav array line ~42), `src/components/layout/mobile-nav.tsx` (nav array line ~46)

**Interfaces:**
- Produces: `PeopleList` props `{ employees: PersonRow[]; departments: { name: string; memberCount: number }[]; outOfOffice: Record<string, OutOfOfficeInfo> }` where `PersonRow = { id, firstName, lastName, preferredName, email, jobTitle, status, pronouns, profilePhoto, department: { name } | null, manager: { id: string; name: string } | null, startDate: string }`.

- [ ] **Step 1: Include manager in `getEmployees` and delete the old bulk import**

In `src/lib/actions/employees.ts`, change the `include` in `getEmployees` from `include: { department: true, team: true },` to:

```ts
    include: {
      department: true,
      team: true,
      manager: { select: { id: true, firstName: true, lastName: true, preferredName: true } },
    },
```

Delete the whole `bulkImportEmployees` function (from `export async function bulkImportEmployees(` through its closing `}` just before `export async function approveAndInviteEmployee`). Delete `src/components/people/bulk-employee-import.tsx`.

- [ ] **Step 2: Add the nav entry**

`src/components/layout/sidebar.tsx`, in `allNavLinks` right after the `/people` entry:

```ts
  { href: "/data", label: "Import & Export", icon: "swap_vert", access: (r: UserRole) => r === "SUPER_ADMIN" || r === "ADMIN" || r === "HR" },
```

`src/components/layout/mobile-nav.tsx`, after the `/email-log` entry:

```ts
  { href: "/data", label: "Import & Export", icon: "swap_vert", access: (r: UserRole) => r === "SUPER_ADMIN" || r === "ADMIN" || r === "HR", section: "Admin" },
```

- [ ] **Step 3: Update the People page**

Replace the body of `src/app/(dashboard)/people/page.tsx` so that: the `BulkEmployeeImport` import and usage are removed; the header buttons are `Archive` (super admin), `Import & Export` link (isAdmin), `AddEmployeeForm` (isAdmin); and each employee passed to `PeopleList` also carries `manager` and `startDate`:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getEmployees } from "@/lib/actions/employees";
import { getDepartments } from "@/lib/actions/departments";
import { requireAuth } from "@/lib/auth-helpers";
import { getCurrentOutOfOfficeFor } from "@/lib/actions/out-of-office";
import { displayName } from "@/lib/utils";
import { PeopleList } from "@/components/people/people-list";
import { AddEmployeeForm } from "@/components/people/add-employee-form";
import { Icon } from "@/components/ui/icon";

export default async function PeoplePage() {
  const session = await requireAuth();
  const role = session.user?.role;
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN" || role === "HR";
  const isSuperAdmin = role === "SUPER_ADMIN";

  if (!isAdmin && role !== "MANAGER") {
    redirect("/my-profile");
  }

  const [allEmployees, departments] = await Promise.all([
    getEmployees({ status: undefined }),
    getDepartments(),
  ]);

  const employees = isAdmin ? allEmployees : allEmployees.filter((e) => e.status !== "PENDING");

  const departmentsWithCounts = departments.map((d) => ({
    name: d.name,
    memberCount: employees.filter((e) => e.department?.name === d.name).length,
  }));

  const outOfOffice = await getCurrentOutOfOfficeFor(employees.map((e) => e.id));

  const secondaryButton =
    "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-[var(--color-border)] text-[var(--color-on-surface-variant)] hover:bg-[var(--color-background)] transition-colors";

  return (
    <div className="max-w-7xl mx-auto p-8 lg:p-12">
      <div className="mb-8">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-5xl font-black tracking-tight text-[var(--color-on-surface)] mb-2">People</h2>
            <p className="text-[var(--color-on-surface-variant)] font-medium text-lg">
              {employees.length} people across {departments.length} departments.
            </p>
          </div>
          <div className="flex gap-3">
            {isSuperAdmin && (
              <Link href="/people/archive" className={secondaryButton}>Archive</Link>
            )}
            {isAdmin && (
              <>
                <Link href="/data" className={secondaryButton}>
                  <Icon name="swap_vert" size={16} /> Import & Export
                </Link>
                <AddEmployeeForm departments={departments.map((d) => ({ id: d.id, name: d.name }))} />
              </>
            )}
          </div>
        </div>
      </div>

      {employees.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[var(--color-text-muted)] text-sm">No employees yet. Add your first team member to get started.</p>
        </div>
      ) : (
        <PeopleList
          employees={employees.map((e) => ({
            id: e.id,
            firstName: e.firstName,
            lastName: e.lastName,
            preferredName: e.preferredName,
            email: e.email,
            jobTitle: e.jobTitle,
            status: e.status,
            pronouns: e.pronouns,
            profilePhoto: e.profilePhoto,
            department: e.department ? { name: e.department.name } : null,
            manager: e.manager ? { id: e.manager.id, name: displayName(e.manager) } : null,
            startDate: e.startDate.toISOString(),
          }))}
          departments={departmentsWithCounts}
          outOfOffice={outOfOffice}
        />
      )}
    </div>
  );
}
```

(`displayName` in `@/lib/utils` accepts `{ firstName, lastName, preferredName? }` — check its signature at `src/lib/utils.ts:18` and adapt if it needs more.)

- [ ] **Step 4: Rewrite `people-list.tsx`**

Keep these pieces from the current file verbatim: the `"use client"` header and imports, `OutOfOfficeBadge`, `StatusLabel` (but make it compact: replace `py-2 rounded-lg w-full` with `px-2 py-1 rounded-md`), `avatarColors`, the pending-approval handlers (`togglePending`, `toggleSelectAllPending`, `handleApprove`, `handleApproveAll`, `handleDeleteSelected`) and the delete-confirm `Dialog`. Remove pagination, the department dropdown, the bento grid, team rows and `FAB`.

New structure:

```tsx
type GroupBy = "jobTitle" | "department" | "manager" | "status" | "none";
type SortBy = "name" | "startDate" | "jobTitle";

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: "jobTitle", label: "Job title" },
  { value: "department", label: "Department" },
  { value: "manager", label: "Manager" },
  { value: "status", label: "Status" },
  { value: "none", label: "None" },
];
const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending", ACTIVE: "Active", PRE_ONBOARDING: "Written Offer", TRAINING: "Training", ONBOARDING: "Onboarding", OFFBOARDED: "Offboarded",
};
const STATUS_ORDER = ["PENDING", "PRE_ONBOARDING", "TRAINING", "ONBOARDING", "ACTIVE", "OFFBOARDED"];

function groupKeyFor(emp: Employee, groupBy: GroupBy): string {
  switch (groupBy) {
    case "jobTitle": return emp.jobTitle || "No job title";
    case "department": return emp.department?.name || "No department";
    case "manager": return emp.manager?.name || "No manager";
    case "status": return STATUS_LABELS[emp.status] || emp.status;
    default: return "";
  }
}
```

URL state: read `useSearchParams()` for `group` (default `jobTitle`), `dept`, `status`, `q`, `sort` (default `name`); write with

```tsx
function setParam(key: string, value: string | null) {
  const params = new URLSearchParams(searchParams.toString());
  if (value && value !== "") params.set(key, value); else params.delete(key);
  router.replace(`${pathname}?${params.toString()}`, { scroll: false });
}
```

Filtering: `q` matches (case-insensitive) against `displayName(emp)`, `emp.email`, `emp.jobTitle`; `dept` equals `department.name`; `status` equals `emp.status`. Sorting: `name` → `displayName` localeCompare; `startDate` → ascending date; `jobTitle` → localeCompare then name.

Grouping: build `Map<string, Employee[]>`; group order — for `status` use `STATUS_ORDER` index; otherwise alphabetical with "No …" groups last. Collapsed groups in `useState<Set<string>>`.

Toolbar (above the list): search input (`Icon name="search"`), `Group by` select, `Department` select (All + `departments`), `Status` select (All + `STATUS_ORDER`), `Sort` select, and a count `"{filtered.length} people"`. Keep the pending section (checkbox, Approve selected / Approve All & Send Invites, Delete selected) exactly as it is today above the toolbar — it is still the fastest way to process pending people.

Each group renders:

```tsx
<section key={name} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
  <button type="button" onClick={() => toggleCollapsed(name)} className="sticky top-0 z-10 flex w-full items-center gap-3 px-4 py-3 bg-[var(--color-surface-container-low)] border-b border-[var(--color-border)] text-left">
    <Icon name={collapsed ? "chevron_right" : "expand_more"} size={18} className="text-[var(--color-text-muted)]" />
    <span className="font-semibold text-[var(--color-text-primary)]">{name}</span>
    <span className="text-xs text-[var(--color-text-muted)]">{members.length}</span>
  </button>
  {!collapsed && (
    <table className="w-full text-sm">
      <thead className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
        <tr>
          <th className="px-4 py-2 text-left font-medium">Person</th>
          <th className="px-4 py-2 text-left font-medium">Job title</th>
          <th className="px-4 py-2 text-left font-medium">Department</th>
          <th className="px-4 py-2 text-left font-medium">Manager</th>
          <th className="px-4 py-2 text-left font-medium">Email</th>
          <th className="px-4 py-2 text-left font-medium">Start date</th>
          <th className="px-4 py-2 text-left font-medium">Status</th>
        </tr>
      </thead>
      <tbody>{members.map(renderRow)}</tbody>
    </table>
  )}
</section>
```

When `groupBy === "none"` render one section without the header button. `renderRow` returns a `<tr>` with `onClick={() => router.push(`/people/${emp.id}`)}` and `className="cursor-pointer border-t border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"`; the Person cell shows the avatar (`profilePhoto` `<img>` 32px rounded-lg, else initials in a colored square), `displayName(emp)`, and a muted line with `preferredName`/`pronouns` when present; Status cell = `<StatusLabel status={emp.status} />` plus `<OutOfOfficeBadge>` when `outOfOffice[emp.id]` exists, plus for `PENDING` an inline `Approve` button (`onClick={(e) => { e.stopPropagation(); handleApprove(emp.id); }}`). Start date uses `formatDate` from `@/lib/utils`. Wrap each table in `<div className="overflow-x-auto">`.

Empty result: `"No people match these filters."` with a "Clear filters" button that clears `q`, `dept`, `status`.

- [ ] **Step 5: Typecheck and look at it**

```bash
npx tsc --noEmit -p tsconfig.json
```

Open `http://localhost:3000/people`, confirm grouping/filters/search update the URL and the list, a row click opens the profile, and pending approval still works.

- [ ] **Step 6: Commit**

```bash
git add -A src/components/people src/app/\(dashboard\)/people/page.tsx src/lib/actions/employees.ts src/components/layout
git commit -m "feat(people): grouped list view, remove bulk import dialog, add Import & Export link"
```

---

### Task 3: Shared types + employee field registry + header auto-detection

**Files:**
- Create: `src/lib/import-export/types.ts`
- Create: `src/lib/import-export/employee-fields.ts`
- Test: `src/lib/import-export/__tests__/employee-fields.test.ts`

**Interfaces:**
- Produces: everything in `types.ts` below; `EMPLOYEE_FIELDS: FieldDef[]`, `FIELD_BY_KEY: Record<FieldKey, FieldDef>`, `FIELD_KEYS: FieldKey[]`, `EMPLOYEE_STATUS_VALUES`, `normalizeHeader(h: string): string`, `autoDetectMapping(headers: string[]): ColumnMapping`.

- [ ] **Step 1: Write `types.ts`**

```ts
export type FieldKey =
  | "firstName" | "middleName" | "lastName" | "preferredName" | "pronouns"
  | "email" | "phone"
  | "jobTitle" | "department" | "team" | "manager" | "status" | "location"
  | "startDate" | "birthday" | "anniversaryDate" | "benefitsEligibleDate"
  | "address" | "city" | "state" | "zipCode" | "country"
  | "emergencyContactName" | "emergencyContactPhone" | "emergencyContactRelation"
  | "bio" | "hobbies" | "dietaryRestrictions" | "tShirtSize";

export type FieldType = "text" | "email" | "phone" | "date" | "enum" | "relation";
export type FieldGroup = "Identity" | "Contact" | "Job" | "Dates" | "Address" | "Emergency" | "Personal";

export interface FieldDef {
  key: FieldKey;
  label: string;
  group: FieldGroup;
  type: FieldType;
  synonyms: string[];
  required?: boolean;
  enumValues?: readonly string[];
}

/** Cleaned values keyed by field. Dates are "YYYY-MM-DD". Empty strings are never stored. */
export type RowData = Partial<Record<FieldKey, string>>;

export type RowError = { field: FieldKey | "row"; message: string };

/** One entry per file column: the field it feeds, or "skip". */
export type ColumnMapping = (FieldKey | "skip")[];

export type MemberRef = { kind: "row"; id: string } | { kind: "employee"; id: string };

export type GroupReason = "email" | "phone" | "name";

export interface DetectedGroup {
  /** sorted member refs joined with "|" — stable across runs */
  key: string;
  reasons: GroupReason[];
  members: MemberRef[];
}

export interface RowLite {
  id: string;
  rowNumber: number;
  data: RowData;
}

export interface ExistingEmployeeLite {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  email: string;
  phone?: string | null;
}

export type RowAction = "CREATE" | "UPDATE" | "SKIP" | "MERGED_AWAY";

export interface MergeMember {
  ref: MemberRef;
  rowNumber?: number;
  data: RowData;
}

export interface MergePlan {
  carrierRowId: string;
  action: "CREATE" | "UPDATE";
  targetEmployeeId: string | null;
  data: RowData;
  mergedAwayRowIds: string[];
}

export function refKey(ref: MemberRef): string {
  return `${ref.kind}:${ref.id}`;
}

export function parseRefKey(key: string): MemberRef {
  const idx = key.indexOf(":");
  const kind = key.slice(0, idx) as MemberRef["kind"];
  return { kind, id: key.slice(idx + 1) };
}

export function sameRef(a: MemberRef, b: MemberRef): boolean {
  return a.kind === b.kind && a.id === b.id;
}
```

- [ ] **Step 2: Write the failing tests**

`src/lib/import-export/__tests__/employee-fields.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { EMPLOYEE_FIELDS, FIELD_BY_KEY, normalizeHeader, autoDetectMapping } from "@/lib/import-export/employee-fields";

describe("EMPLOYEE_FIELDS", () => {
  it("has unique keys and unique synonyms", () => {
    const keys = EMPLOYEE_FIELDS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    const syns = EMPLOYEE_FIELDS.flatMap((f) => f.synonyms);
    expect(new Set(syns).size).toBe(syns.length);
  });
  it("marks first and last name required", () => {
    expect(FIELD_BY_KEY.firstName.required).toBe(true);
    expect(FIELD_BY_KEY.lastName.required).toBe(true);
    expect(FIELD_BY_KEY.email.required).toBeUndefined();
  });
});

describe("normalizeHeader", () => {
  it("lowercases, strips punctuation and collapses whitespace", () => {
    expect(normalizeHeader("  First_Name* ")).toBe("first name");
    expect(normalizeHeader("E-Mail Address")).toBe("e mail address");
    expect(normalizeHeader("Start.Date")).toBe("start date");
  });
});

describe("autoDetectMapping", () => {
  it("maps known headers and skips unknown ones", () => {
    expect(autoDetectMapping(["First Name", "Surname", "Work Email", "Reports To", "Favourite colour"]))
      .toEqual(["firstName", "lastName", "email", "manager", "skip"]);
  });
  it("matches the field key or label directly", () => {
    expect(autoDetectMapping(["jobTitle", "ZIP code"])).toEqual(["jobTitle", "zipCode"]);
  });
  it("uses each field only once (first column wins)", () => {
    expect(autoDetectMapping(["Email", "E-mail"])).toEqual(["email", "skip"]);
  });
});
```

Run: `npm test` — Expected: FAIL (module not found).

- [ ] **Step 3: Write `employee-fields.ts`**

```ts
import type { ColumnMapping, FieldDef, FieldKey } from "./types";

export const EMPLOYEE_STATUS_VALUES = ["PENDING", "ACTIVE", "PRE_ONBOARDING", "TRAINING", "ONBOARDING", "OFFBOARDED"] as const;

export const EMPLOYEE_FIELDS: FieldDef[] = [
  { key: "firstName", label: "First name", group: "Identity", type: "text", required: true, synonyms: ["first name", "firstname", "first", "given name", "given"] },
  { key: "middleName", label: "Middle name", group: "Identity", type: "text", synonyms: ["middle name", "middlename", "middle"] },
  { key: "lastName", label: "Last name", group: "Identity", type: "text", required: true, synonyms: ["last name", "lastname", "last", "surname", "family name"] },
  { key: "preferredName", label: "Preferred name", group: "Identity", type: "text", synonyms: ["preferred name", "preferredname", "nickname", "goes by", "display name"] },
  { key: "pronouns", label: "Pronouns", group: "Identity", type: "text", synonyms: ["pronouns", "pronoun"] },
  { key: "email", label: "Email", group: "Contact", type: "email", synonyms: ["email", "e mail", "email address", "e mail address", "work email", "company email", "personal email"] },
  { key: "phone", label: "Phone", group: "Contact", type: "phone", synonyms: ["phone", "phone number", "telephone", "mobile", "cell", "cell phone", "mobile phone"] },
  { key: "jobTitle", label: "Job title", group: "Job", type: "text", synonyms: ["job title", "jobtitle", "title", "position", "role", "primary job title", "job"] },
  { key: "department", label: "Department", group: "Job", type: "relation", synonyms: ["department", "dept", "current department"] },
  { key: "team", label: "Team", group: "Job", type: "relation", synonyms: ["team", "team name", "sub team", "subteam"] },
  { key: "manager", label: "Manager", group: "Job", type: "relation", synonyms: ["manager", "reports to", "reportsto", "manager name", "manager email", "direct manager", "supervisor", "reporting to"] },
  { key: "status", label: "Status", group: "Job", type: "enum", enumValues: EMPLOYEE_STATUS_VALUES, synonyms: ["status", "employee status", "employment status"] },
  { key: "location", label: "Location", group: "Job", type: "text", synonyms: ["location", "office", "work location", "site"] },
  { key: "startDate", label: "Start date", group: "Dates", type: "date", synonyms: ["start date", "startdate", "hire date", "hiredate", "date hired", "employee start date", "date of hire", "joined"] },
  { key: "birthday", label: "Birthday", group: "Dates", type: "date", synonyms: ["birthday", "birth date", "birthdate", "date of birth", "dob"] },
  { key: "anniversaryDate", label: "Anniversary date", group: "Dates", type: "date", synonyms: ["anniversary", "anniversary date", "work anniversary"] },
  { key: "benefitsEligibleDate", label: "Benefits eligible date", group: "Dates", type: "date", synonyms: ["benefits eligible date", "benefits eligible", "benefits date", "benefits eligibility"] },
  { key: "address", label: "Address", group: "Address", type: "text", synonyms: ["address", "street", "street address", "address line 1", "address 1"] },
  { key: "city", label: "City", group: "Address", type: "text", synonyms: ["city", "town"] },
  { key: "state", label: "State", group: "Address", type: "text", synonyms: ["state", "province", "region"] },
  { key: "zipCode", label: "ZIP code", group: "Address", type: "text", synonyms: ["zip", "zip code", "zipcode", "postal code", "postcode"] },
  { key: "country", label: "Country", group: "Address", type: "text", synonyms: ["country"] },
  { key: "emergencyContactName", label: "Emergency contact name", group: "Emergency", type: "text", synonyms: ["emergency contact", "emergency contact name", "emergency name", "ice name"] },
  { key: "emergencyContactPhone", label: "Emergency contact phone", group: "Emergency", type: "phone", synonyms: ["emergency contact phone", "emergency phone", "ice phone"] },
  { key: "emergencyContactRelation", label: "Emergency contact relation", group: "Emergency", type: "text", synonyms: ["emergency contact relation", "emergency contact relationship", "emergency relation", "relationship"] },
  { key: "bio", label: "Bio", group: "Personal", type: "text", synonyms: ["bio", "about", "biography"] },
  { key: "hobbies", label: "Hobbies", group: "Personal", type: "text", synonyms: ["hobbies", "interests"] },
  { key: "dietaryRestrictions", label: "Dietary restrictions", group: "Personal", type: "text", synonyms: ["dietary restrictions", "dietary", "diet", "allergies"] },
  { key: "tShirtSize", label: "T-shirt size", group: "Personal", type: "text", synonyms: ["t shirt size", "tshirt size", "shirt size", "t shirt"] },
];

export const FIELD_KEYS: FieldKey[] = EMPLOYEE_FIELDS.map((f) => f.key);

export const FIELD_BY_KEY: Record<FieldKey, FieldDef> = Object.fromEntries(
  EMPLOYEE_FIELDS.map((f) => [f.key, f]),
) as Record<FieldKey, FieldDef>;

export const FIELD_GROUPS: FieldDef["group"][] = ["Identity", "Contact", "Job", "Dates", "Address", "Emergency", "Personal"];

export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[_\-./*()]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const SYNONYM_INDEX: Map<string, FieldKey> = new Map();
for (const f of EMPLOYEE_FIELDS) {
  SYNONYM_INDEX.set(normalizeHeader(f.key), f.key);
  SYNONYM_INDEX.set(normalizeHeader(f.label), f.key);
  for (const s of f.synonyms) SYNONYM_INDEX.set(normalizeHeader(s), f.key);
}

export function autoDetectMapping(headers: string[]): ColumnMapping {
  const used = new Set<FieldKey>();
  return headers.map((h) => {
    const key = SYNONYM_INDEX.get(normalizeHeader(h));
    if (!key || used.has(key)) return "skip";
    used.add(key);
    return key;
  });
}
```

Note: the synonym uniqueness test compares raw synonym strings, so keep them distinct across fields (e.g. `"team"` belongs to team, not department; `"city"` to city, not location).

- [ ] **Step 4: Run tests, typecheck, commit**

```bash
npm test && npx tsc --noEmit -p tsconfig.json
git add src/lib/import-export
git commit -m "feat(import): employee field registry and header auto-detection"
```

---

### Task 4: CSV parser

**Files:**
- Create: `src/lib/import-export/parse-csv.ts`
- Test: `src/lib/import-export/__tests__/parse-csv.test.ts`

**Interfaces:**
- Produces: `parseCsv(text: string): { headers: string[]; rows: string[][] }` — headers trimmed, rows padded/truncated to header length, blank rows dropped, cells trimmed.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { parseCsv } from "@/lib/import-export/parse-csv";

describe("parseCsv", () => {
  it("parses a simple comma file", () => {
    const r = parseCsv("First,Last\nAda,Lovelace\nAlan,Turing\n");
    expect(r.headers).toEqual(["First", "Last"]);
    expect(r.rows).toEqual([["Ada", "Lovelace"], ["Alan", "Turing"]]);
  });
  it("handles quoted fields with commas, escaped quotes and embedded newlines", () => {
    const r = parseCsv('Name,Bio\n"Lovelace, Ada","Said ""hi""\nthen left"\n');
    expect(r.rows).toEqual([["Lovelace, Ada", 'Said "hi"\nthen left']]);
  });
  it("strips a BOM and accepts CRLF", () => {
    const r = parseCsv("﻿A,B\r\n1,2\r\n");
    expect(r.headers).toEqual(["A", "B"]);
    expect(r.rows).toEqual([["1", "2"]]);
  });
  it("auto-detects semicolon and tab delimiters", () => {
    expect(parseCsv("A;B\n1;2\n").rows).toEqual([["1", "2"]]);
    expect(parseCsv("A\tB\n1\t2\n").rows).toEqual([["1", "2"]]);
  });
  it("drops blank rows and pads short rows", () => {
    const r = parseCsv("A,B,C\n1,2\n\n,,\n4,5,6,7\n");
    expect(r.rows).toEqual([["1", "2", ""], ["4", "5", "6"]]);
  });
  it("returns empty for empty input", () => {
    expect(parseCsv("")).toEqual({ headers: [], rows: [] });
  });
});
```

Run: `npm test` — Expected: FAIL.

- [ ] **Step 2: Implement**

```ts
function detectDelimiter(firstLine: string): string {
  const candidates = [",", ";", "\t"];
  let best = ",";
  let bestCount = -1;
  for (const d of candidates) {
    const count = firstLine.split(d).length - 1;
    if (count > bestCount) { best = d; bestCount = count; }
  }
  return best;
}

function splitRecords(text: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === delimiter) { record.push(field); field = ""; continue; }
    if (ch === "\r") { continue; }
    if (ch === "\n") { record.push(field); records.push(record); record = []; field = ""; continue; }
    field += ch;
  }
  if (field.length > 0 || record.length > 0) { record.push(field); records.push(record); }
  return records;
}

export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const cleaned = text.replace(/^﻿/, "");
  if (!cleaned.trim()) return { headers: [], rows: [] };
  const firstLine = cleaned.split(/\r?\n/, 1)[0];
  const delimiter = detectDelimiter(firstLine);
  const records = splitRecords(cleaned, delimiter);
  const headers = (records.shift() ?? []).map((h) => h.trim());
  const width = headers.length;
  const rows = records
    .map((r) => r.map((c) => c.trim()))
    .filter((r) => r.some((c) => c !== ""))
    .map((r) => {
      const out = r.slice(0, width);
      while (out.length < width) out.push("");
      return out;
    });
  return { headers, rows };
}
```

- [ ] **Step 3: Run tests, typecheck, commit**

```bash
npm test && npx tsc --noEmit -p tsconfig.json
git add src/lib/import-export
git commit -m "feat(import): RFC4180 CSV parser with delimiter detection"
```

---

### Task 5: Normalization, mapping application, row validation

**Files:**
- Create: `src/lib/import-export/normalize.ts`
- Test: `src/lib/import-export/__tests__/normalize.test.ts`

**Interfaces:**
- Consumes: `FIELD_BY_KEY`, `FIELD_KEYS`, `EMPLOYEE_STATUS_VALUES` (Task 3).
- Produces: `normalizeEmail(s) → string` ("" when not an address; Gmail dots/+tag stripped), `normalizePhone(s) → string` (last 10 digits or ""), `normalizeName(s) → string`, `nameKeys(first, last, preferred?) → string[]` (unordered canonical keys), `isValidEmail(s)`, `parseDate(s) → string | null` (YYYY-MM-DD), `cleanPhone(s) → string`, `applyMapping(raw: string[], mapping: ColumnMapping) → RowData`, `validateRow(data: RowData) → { data: RowData; errors: RowError[] }`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import {
  normalizeEmail, normalizePhone, normalizeName, nameKeys, isValidEmail,
  parseDate, cleanPhone, applyMapping, validateRow,
} from "@/lib/import-export/normalize";

describe("normalizeEmail", () => {
  it("lowercases and strips gmail dots and tags", () => {
    expect(normalizeEmail(" John.Doe+hr@Gmail.com ")).toBe("johndoe@gmail.com");
    expect(normalizeEmail("a.b@coastaldebt.com")).toBe("ab@coastaldebt.com");
  });
  it("returns empty for junk or pending placeholders", () => {
    expect(normalizeEmail("not an email")).toBe("");
    expect(normalizeEmail("")).toBe("");
    expect(normalizeEmail("jane.doe@pending.local")).toBe("");
  });
});

describe("normalizePhone / cleanPhone", () => {
  it("keeps the last ten digits", () => {
    expect(normalizePhone("+1 (305) 555-0142")).toBe("3055550142");
    expect(normalizePhone("555-0142")).toBe("");
  });
  it("cleanPhone keeps digits and a leading plus", () => {
    expect(cleanPhone("+1 (305) 555-0142")).toBe("+13055550142");
    expect(cleanPhone("305.555.0142")).toBe("3055550142");
  });
});

describe("normalizeName / nameKeys", () => {
  it("strips accents, case and punctuation", () => {
    expect(normalizeName("  José  O'Brien-Smith ")).toBe("jose obriensmith");
  });
  it("produces unordered keys including preferred name", () => {
    expect(nameKeys("Maria", "Garcia")).toEqual(["garcia|maria"]);
    expect(nameKeys("Garcia", "Maria")).toEqual(["garcia|maria"]);
    expect(nameKeys("William", "Smith", "Bill")).toEqual(["smith|william", "bill|smith"]);
    expect(nameKeys("", "Smith")).toEqual([]);
  });
});

describe("parseDate", () => {
  it("accepts ISO, US, two-digit years, month names and excel serials", () => {
    expect(parseDate("2024-03-01")).toBe("2024-03-01");
    expect(parseDate("2024-03-01T10:00:00Z")).toBe("2024-03-01");
    expect(parseDate("3/1/2024")).toBe("2024-03-01");
    expect(parseDate("03-01-24")).toBe("2024-03-01");
    expect(parseDate("March 1, 2024")).toBe("2024-03-01");
    expect(parseDate("1 Mar 2024")).toBe("2024-03-01");
    expect(parseDate("45352")).toBe("2024-03-01");
  });
  it("rejects garbage and impossible dates", () => {
    expect(parseDate("soon")).toBeNull();
    expect(parseDate("13/45/2024")).toBeNull();
    expect(parseDate("2024-02-30")).toBeNull();
  });
});

describe("applyMapping", () => {
  it("collects mapped, non-empty cells and ignores skipped columns", () => {
    expect(applyMapping(["Ada", "", "Lovelace", "x"], ["firstName", "email", "lastName", "skip"]))
      .toEqual({ firstName: "Ada", lastName: "Lovelace" });
  });
  it("keeps the first non-empty value when two columns feed one field", () => {
    expect(applyMapping(["", "a@b.co"], ["email", "email"])).toEqual({ email: "a@b.co" });
  });
});

describe("validateRow", () => {
  it("cleans dates, emails, phones and status", () => {
    const r = validateRow({ firstName: "Ada", lastName: "Lovelace", email: " ADA@X.com ", phone: "(305) 555-0142", startDate: "3/1/2024", status: "active" });
    expect(r.errors).toEqual([]);
    expect(r.data).toEqual({ firstName: "Ada", lastName: "Lovelace", email: "ada@x.com", phone: "3055550142", startDate: "2024-03-01", status: "ACTIVE" });
  });
  it("reports missing names, bad emails, bad dates and unknown statuses", () => {
    const r = validateRow({ firstName: "Ada", email: "nope", birthday: "yesterday", status: "retired" });
    expect(r.errors).toEqual([
      { field: "lastName", message: "Last name is required" },
      { field: "email", message: "Not a valid email address" },
      { field: "birthday", message: "Unrecognized date" },
      { field: "status", message: "Status must be one of PENDING, ACTIVE, PRE_ONBOARDING, TRAINING, ONBOARDING, OFFBOARDED" },
    ]);
  });
});
```

Run: `npm test` — Expected: FAIL.

- [ ] **Step 2: Implement `normalize.ts`**

```ts
import { EMPLOYEE_FIELDS, EMPLOYEE_STATUS_VALUES, FIELD_BY_KEY } from "./employee-fields";
import type { ColumnMapping, FieldKey, RowData, RowError } from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(s: string): boolean {
  return EMAIL_RE.test(s.trim());
}

export function normalizeEmail(raw: string | null | undefined): string {
  if (!raw) return "";
  const email = raw.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return "";
  const [local, domain] = email.split("@");
  if (domain === "pending.local") return "";
  const cleaned = local.replace(/\./g, "").split("+")[0];
  return `${cleaned}@${domain}`;
}

export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

export function cleanPhone(raw: string): string {
  const trimmed = raw.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  return plus + trimmed.replace(/\D/g, "");
}

export function normalizeName(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function nameKeys(first: string | null | undefined, last: string | null | undefined, preferred?: string | null): string[] {
  const l = normalizeName(last);
  if (!l) return [];
  const keys: string[] = [];
  const f = normalizeName(first);
  if (f) keys.push([f, l].sort().join("|"));
  const p = normalizeName(preferred);
  if (p && p !== f) keys.push([p, l].sort().join("|"));
  return keys;
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function ymd(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y.toString().padStart(4, "0")}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
}

function fullYear(y: number): number {
  if (y >= 100) return y;
  return y < 70 ? 2000 + y : 1900 + y;
}

export function parseDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (m) return ymd(+m[1], +m[2], +m[3]);

  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) return ymd(fullYear(+m[3]), +m[1], +m[2]);

  m = s.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m && MONTHS[m[1].toLowerCase()]) return ymd(+m[3], MONTHS[m[1].toLowerCase()], +m[2]);

  m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\.?,?\s+(\d{4})$/);
  if (m && MONTHS[m[2].toLowerCase()]) return ymd(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);

  if (/^\d{4,6}$/.test(s)) {
    const serial = +s;
    if (serial > 0 && serial < 200000) {
      const epoch = Date.UTC(1899, 11, 30);
      const d = new Date(epoch + serial * 86400000);
      return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }
  }
  return null;
}

export function applyMapping(raw: string[], mapping: ColumnMapping): RowData {
  const data: RowData = {};
  mapping.forEach((field, i) => {
    if (field === "skip") return;
    const value = (raw[i] ?? "").trim();
    if (!value) return;
    if (data[field] === undefined) data[field] = value;
  });
  return data;
}

export function validateRow(input: RowData): { data: RowData; errors: RowError[] } {
  const data: RowData = {};
  const errors: RowError[] = [];

  for (const field of EMPLOYEE_FIELDS) {
    const key = field.key as FieldKey;
    const value = (input[key] ?? "").trim();
    if (!value) {
      if (field.required) errors.push({ field: key, message: `${field.label} is required` });
      continue;
    }
    switch (field.type) {
      case "email": {
        const email = value.toLowerCase();
        if (!isValidEmail(email)) errors.push({ field: key, message: "Not a valid email address" });
        else data[key] = email;
        break;
      }
      case "phone": {
        const phone = cleanPhone(value);
        if (phone.replace(/\D/g, "").length < 7) errors.push({ field: key, message: "Not a valid phone number" });
        else data[key] = phone;
        break;
      }
      case "date": {
        const date = parseDate(value);
        if (!date) errors.push({ field: key, message: "Unrecognized date" });
        else data[key] = date;
        break;
      }
      case "enum": {
        const upper = value.toUpperCase().replace(/[\s-]+/g, "_");
        const allowed = field.enumValues ?? [];
        if (!allowed.includes(upper)) errors.push({ field: key, message: `${field.label} must be one of ${allowed.join(", ")}` });
        else data[key] = upper;
        break;
      }
      default:
        data[key] = value;
    }
  }
  return { data, errors };
}

export { EMPLOYEE_STATUS_VALUES, FIELD_BY_KEY };
```

- [ ] **Step 3: Run tests, typecheck, commit**

```bash
npm test && npx tsc --noEmit -p tsconfig.json
git add src/lib/import-export
git commit -m "feat(import): normalization, date parsing, mapping and row validation"
```

---

### Task 6: Duplicate detection

**Files:**
- Create: `src/lib/import-export/duplicates.ts`
- Test: `src/lib/import-export/__tests__/duplicates.test.ts`

**Interfaces:**
- Consumes: `normalizeEmail`, `normalizePhone`, `nameKeys` (Task 5); types `RowLite`, `ExistingEmployeeLite`, `DetectedGroup`, `MemberRef`, `refKey` (Task 3).
- Produces: `detectDuplicates(rows: RowLite[], employees: ExistingEmployeeLite[]): DetectedGroup[]`, `groupKey(members: MemberRef[]): string`, `isStrongGroup(reasons: GroupReason[]): boolean`.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { detectDuplicates, groupKey } from "@/lib/import-export/duplicates";
import type { RowLite, ExistingEmployeeLite } from "@/lib/import-export/types";

const row = (id: string, n: number, data: RowLite["data"]): RowLite => ({ id, rowNumber: n, data });
const emp = (id: string, e: Partial<ExistingEmployeeLite> = {}): ExistingEmployeeLite => ({
  id, firstName: "X", lastName: "Y", email: `${id}@corp.com`, phone: null, ...e,
});

describe("detectDuplicates", () => {
  it("groups two rows with the same normalized email", () => {
    const groups = detectDuplicates([
      row("r1", 1, { firstName: "Ada", lastName: "Lovelace", email: "ada.l@gmail.com" }),
      row("r2", 2, { firstName: "A.", lastName: "Lovelace", email: "adal+x@gmail.com" }),
    ], []);
    expect(groups).toHaveLength(1);
    expect(groups[0].reasons).toEqual(["email"]);
    expect(groups[0].members).toEqual([{ kind: "row", id: "r1" }, { kind: "row", id: "r2" }]);
  });

  it("matches a row against an existing employee by phone and name, listing rows first", () => {
    const groups = detectDuplicates(
      [row("r1", 3, { firstName: "Maria", lastName: "Garcia", phone: "3055550142" })],
      [emp("e1", { firstName: "María", lastName: "García", phone: "+1 (305) 555-0142" })],
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].reasons).toEqual(["phone", "name"]);
    expect(groups[0].members).toEqual([{ kind: "row", id: "r1" }, { kind: "employee", id: "e1" }]);
  });

  it("matches on preferred name and ignores pending placeholder emails", () => {
    const groups = detectDuplicates(
      [row("r1", 1, { firstName: "Bill", lastName: "Smith", email: "bill.smith@pending.local" })],
      [emp("e1", { firstName: "William", lastName: "Smith", preferredName: "Bill", email: "william.smith@pending.local" })],
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].reasons).toEqual(["name"]);
  });

  it("never groups two existing employees without a row between them", () => {
    const groups = detectDuplicates([], [
      emp("e1", { firstName: "Sam", lastName: "Lee" }),
      emp("e2", { firstName: "Sam", lastName: "Lee" }),
    ]);
    expect(groups).toEqual([]);
  });

  it("clusters transitively and orders strong groups before name-only groups", () => {
    const groups = detectDuplicates([
      row("r1", 1, { firstName: "Jo", lastName: "Kim" }),
      row("r2", 2, { firstName: "Jo", lastName: "Kim" }),
      row("r3", 5, { firstName: "Pat", lastName: "Ng", email: "pat@corp.com" }),
      row("r4", 6, { firstName: "Patricia", lastName: "Ng", phone: "3055550199" }),
    ], [emp("e1", { firstName: "P", lastName: "Ng", email: "PAT@corp.com", phone: "305-555-0199" })]);
    expect(groups).toHaveLength(2);
    expect(groups[0].members.map((m) => m.id)).toEqual(["r3", "r4", "e1"]);
    expect(groups[0].reasons).toEqual(["email", "phone"]);
    expect(groups[1].members.map((m) => m.id)).toEqual(["r1", "r2"]);
  });

  it("produces a stable key", () => {
    expect(groupKey([{ kind: "row", id: "b" }, { kind: "employee", id: "a" }])).toBe("employee:a|row:b");
  });
});
```

Run: `npm test` — Expected: FAIL.

- [ ] **Step 2: Implement `duplicates.ts`**

```ts
import { nameKeys, normalizeEmail, normalizePhone } from "./normalize";
import { refKey, type DetectedGroup, type ExistingEmployeeLite, type GroupReason, type MemberRef, type RowLite } from "./types";

type Node = { ref: MemberRef; rowNumber: number; email: string; phone: string; names: string[] };

const REASON_ORDER: GroupReason[] = ["email", "phone", "name"];

export function groupKey(members: MemberRef[]): string {
  return members.map(refKey).sort().join("|");
}

export function isStrongGroup(reasons: GroupReason[]): boolean {
  return reasons.includes("email") || reasons.includes("phone");
}

class UnionFind {
  private parent = new Map<string, string>();
  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x);
    let root = x;
    while (this.parent.get(root) !== root) root = this.parent.get(root)!;
    let cur = x;
    while (this.parent.get(cur) !== root) { const next = this.parent.get(cur)!; this.parent.set(cur, root); cur = next; }
    return root;
  }
  union(a: string, b: string) { this.parent.set(this.find(a), this.find(b)); }
}

export function detectDuplicates(rows: RowLite[], employees: ExistingEmployeeLite[]): DetectedGroup[] {
  const nodes: Node[] = [];
  for (const r of rows) {
    nodes.push({
      ref: { kind: "row", id: r.id },
      rowNumber: r.rowNumber,
      email: normalizeEmail(r.data.email),
      phone: normalizePhone(r.data.phone),
      names: nameKeys(r.data.firstName, r.data.lastName, r.data.preferredName),
    });
  }
  for (const e of employees) {
    nodes.push({
      ref: { kind: "employee", id: e.id },
      rowNumber: Number.MAX_SAFE_INTEGER,
      email: normalizeEmail(e.email),
      phone: normalizePhone(e.phone),
      names: nameKeys(e.firstName, e.lastName, e.preferredName),
    });
  }

  const byKey = new Map<string, Node[]>();
  const add = (reason: GroupReason, key: string, node: Node) => {
    if (!key) return;
    const k = `${reason}:${key}`;
    const arr = byKey.get(k) ?? [];
    arr.push(node);
    byKey.set(k, arr);
  };
  for (const n of nodes) {
    add("email", n.email, n);
    add("phone", n.phone, n);
    for (const nk of n.names) add("name", nk, n);
  }

  const uf = new UnionFind();
  const pairReasons: { a: Node; b: Node; reason: GroupReason }[] = [];
  for (const [k, bucket] of byKey) {
    if (bucket.length < 2) continue;
    const reason = k.split(":")[0] as GroupReason;
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const a = bucket[i], b = bucket[j];
        if (a.ref.kind === "employee" && b.ref.kind === "employee") continue;
        uf.union(refKey(a.ref), refKey(b.ref));
        pairReasons.push({ a, b, reason });
      }
    }
  }

  const membersByRoot = new Map<string, Node[]>();
  for (const n of nodes) {
    const key = refKey(n.ref);
    const root = uf.find(key);
    if (root === key && !pairReasons.some((p) => refKey(p.a.ref) === key || refKey(p.b.ref) === key)) continue;
    const arr = membersByRoot.get(root) ?? [];
    arr.push(n);
    membersByRoot.set(root, arr);
  }
  const reasonsByRoot = new Map<string, Set<GroupReason>>();
  for (const p of pairReasons) {
    const root = uf.find(refKey(p.a.ref));
    const set = reasonsByRoot.get(root) ?? new Set<GroupReason>();
    set.add(p.reason);
    reasonsByRoot.set(root, set);
  }

  const groups: DetectedGroup[] = [];
  for (const [root, members] of membersByRoot) {
    if (members.length < 2) continue;
    const sorted = [...members].sort((a, b) => {
      if (a.ref.kind !== b.ref.kind) return a.ref.kind === "row" ? -1 : 1;
      if (a.rowNumber !== b.rowNumber) return a.rowNumber - b.rowNumber;
      return a.ref.id.localeCompare(b.ref.id);
    });
    const reasons = REASON_ORDER.filter((r) => reasonsByRoot.get(root)?.has(r));
    groups.push({ key: groupKey(sorted.map((m) => m.ref)), reasons, members: sorted.map((m) => m.ref) });
  }

  const minRow = (g: DetectedGroup) => {
    const first = g.members.find((m) => m.kind === "row");
    return first ? rows.find((r) => r.id === first.id)?.rowNumber ?? 0 : Number.MAX_SAFE_INTEGER;
  };
  groups.sort((a, b) => {
    const sa = isStrongGroup(a.reasons) ? 0 : 1;
    const sb = isStrongGroup(b.reasons) ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return minRow(a) - minRow(b);
  });
  return groups;
}
```

- [ ] **Step 3: Run tests, typecheck, commit**

```bash
npm test && npx tsc --noEmit -p tsconfig.json
git add src/lib/import-export
git commit -m "feat(import): duplicate detection across rows and existing employees"
```

---

### Task 7: Merge planning + employee → row data

**Files:**
- Create: `src/lib/import-export/merge.ts`
- Create: `src/lib/import-export/employee-row.ts`
- Test: `src/lib/import-export/__tests__/merge.test.ts`

**Interfaces:**
- Consumes: `FIELD_KEYS` (Task 3); types `MergeMember`, `MergePlan`, `MemberRef`, `RowData`, `FieldKey`, `sameRef` (Task 3).
- Produces: `defaultFieldChoices(members: MergeMember[], primary: MemberRef): Partial<Record<FieldKey, MemberRef>>`, `buildMergePlan(members: MergeMember[], primary: MemberRef, choices: Partial<Record<FieldKey, MemberRef>>): MergePlan`, `employeeToRowData(e: EmployeeForRow): RowData` with `EmployeeForRow` exported.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { defaultFieldChoices, buildMergePlan } from "@/lib/import-export/merge";
import { employeeToRowData } from "@/lib/import-export/employee-row";
import type { MergeMember } from "@/lib/import-export/types";

const r1: MergeMember = { ref: { kind: "row", id: "r1" }, rowNumber: 4, data: { firstName: "Ada", lastName: "Lovelace", email: "ada@gmail.com", phone: "3055550142" } };
const r2: MergeMember = { ref: { kind: "row", id: "r2" }, rowNumber: 9, data: { firstName: "Ada", lastName: "Lovelace", city: "Miami" } };
const e1: MergeMember = { ref: { kind: "employee", id: "e1" }, data: { firstName: "Ada", lastName: "Lovelace", email: "ada@corp.com", jobTitle: "Engineer" } };

describe("defaultFieldChoices", () => {
  it("prefers the primary and fills blanks from the others in order", () => {
    const c = defaultFieldChoices([r1, r2, e1], e1.ref);
    expect(c.email).toEqual(e1.ref);
    expect(c.jobTitle).toEqual(e1.ref);
    expect(c.phone).toEqual(r1.ref);
    expect(c.city).toEqual(r2.ref);
    expect(c.bio).toBeUndefined();
  });
});

describe("buildMergePlan", () => {
  it("row primary → CREATE on the primary row, others merged away", () => {
    const plan = buildMergePlan([r1, r2], r1.ref, { city: r2.ref });
    expect(plan).toEqual({
      carrierRowId: "r1", action: "CREATE", targetEmployeeId: null,
      data: { firstName: "Ada", lastName: "Lovelace", email: "ada@gmail.com", phone: "3055550142", city: "Miami" },
      mergedAwayRowIds: ["r2"],
    });
  });
  it("employee primary → UPDATE carried by the lowest row, honoring explicit choices", () => {
    const plan = buildMergePlan([r2, r1, e1], e1.ref, { email: r1.ref });
    expect(plan.carrierRowId).toBe("r1");
    expect(plan.action).toBe("UPDATE");
    expect(plan.targetEmployeeId).toBe("e1");
    expect(plan.data.email).toBe("ada@gmail.com");
    expect(plan.data.jobTitle).toBe("Engineer");
    expect(plan.mergedAwayRowIds).toEqual(["r2"]);
  });
  it("throws when there is no row to carry the merge", () => {
    expect(() => buildMergePlan([e1], e1.ref, {})).toThrow();
  });
});

describe("employeeToRowData", () => {
  it("flattens relations and formats dates", () => {
    const data = employeeToRowData({
      firstName: "Ada", middleName: null, lastName: "Lovelace", preferredName: null, pronouns: "she/her",
      email: "ada@corp.com", phone: null, jobTitle: "Engineer", location: null, status: "ACTIVE",
      startDate: new Date("2024-03-01T00:00:00Z"), birthday: null, anniversaryDate: null, benefitsEligibleDate: null,
      address: null, city: null, state: null, zipCode: null, country: null,
      emergencyContactName: null, emergencyContactPhone: null, emergencyContactRelation: null,
      bio: null, hobbies: null, dietaryRestrictions: null, tShirtSize: null,
      department: { name: "Engineering" }, team: null, manager: { firstName: "Grace", lastName: "Hopper", preferredName: null },
    });
    expect(data).toEqual({ firstName: "Ada", lastName: "Lovelace", pronouns: "she/her", email: "ada@corp.com", jobTitle: "Engineer", status: "ACTIVE", startDate: "2024-03-01", department: "Engineering", manager: "Grace Hopper" });
  });
});
```

Run: `npm test` — Expected: FAIL.

- [ ] **Step 2: Implement `merge.ts`**

```ts
import { FIELD_KEYS } from "./employee-fields";
import { sameRef, type FieldKey, type MemberRef, type MergeMember, type MergePlan, type RowData } from "./types";

function valueOf(members: MergeMember[], ref: MemberRef, key: FieldKey): string | undefined {
  const m = members.find((x) => sameRef(x.ref, ref));
  const v = m?.data[key];
  return v && v.trim() ? v : undefined;
}

export function defaultFieldChoices(members: MergeMember[], primary: MemberRef): Partial<Record<FieldKey, MemberRef>> {
  const choices: Partial<Record<FieldKey, MemberRef>> = {};
  for (const key of FIELD_KEYS) {
    if (valueOf(members, primary, key) !== undefined) { choices[key] = primary; continue; }
    const donor = members.find((m) => valueOf(members, m.ref, key) !== undefined);
    if (donor) choices[key] = donor.ref;
  }
  return choices;
}

export function buildMergePlan(
  members: MergeMember[],
  primary: MemberRef,
  choices: Partial<Record<FieldKey, MemberRef>>,
): MergePlan {
  const rowMembers = members.filter((m) => m.ref.kind === "row");
  if (rowMembers.length === 0) throw new Error("A merge needs at least one row from the file");

  let carrier: MergeMember;
  if (primary.kind === "row") {
    const found = rowMembers.find((m) => sameRef(m.ref, primary));
    if (!found) throw new Error("Primary row is not part of this group");
    carrier = found;
  } else {
    carrier = [...rowMembers].sort((a, b) => (a.rowNumber ?? 0) - (b.rowNumber ?? 0))[0];
  }

  const defaults = defaultFieldChoices(members, primary);
  const data: RowData = {};
  for (const key of FIELD_KEYS) {
    const ref = choices[key] ?? defaults[key];
    if (!ref) continue;
    const v = valueOf(members, ref, key);
    if (v !== undefined) data[key] = v;
  }

  return {
    carrierRowId: carrier.ref.id,
    action: primary.kind === "employee" ? "UPDATE" : "CREATE",
    targetEmployeeId: primary.kind === "employee" ? primary.id : null,
    data,
    mergedAwayRowIds: rowMembers.filter((m) => m.ref.id !== carrier.ref.id).map((m) => m.ref.id),
  };
}
```

- [ ] **Step 3: Implement `employee-row.ts`**

```ts
import type { RowData } from "./types";

export interface EmployeeForRow {
  firstName: string; middleName: string | null; lastName: string; preferredName: string | null; pronouns: string | null;
  email: string; phone: string | null; jobTitle: string; location: string | null; status: string;
  startDate: Date | null; birthday: Date | null; anniversaryDate: Date | null; benefitsEligibleDate: Date | null;
  address: string | null; city: string | null; state: string | null; zipCode: string | null; country: string | null;
  emergencyContactName: string | null; emergencyContactPhone: string | null; emergencyContactRelation: string | null;
  bio: string | null; hobbies: string | null; dietaryRestrictions: string | null; tShirtSize: string | null;
  department: { name: string } | null;
  team: { name: string } | null;
  manager: { firstName: string; lastName: string; preferredName: string | null } | null;
}

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : undefined);

export function employeeToRowData(e: EmployeeForRow): RowData {
  const out: RowData = {
    firstName: e.firstName, middleName: e.middleName ?? undefined, lastName: e.lastName,
    preferredName: e.preferredName ?? undefined, pronouns: e.pronouns ?? undefined,
    email: e.email, phone: e.phone ?? undefined, jobTitle: e.jobTitle, location: e.location ?? undefined, status: e.status,
    department: e.department?.name, team: e.team?.name,
    manager: e.manager ? `${e.manager.firstName} ${e.manager.lastName}`.trim() : undefined,
    startDate: iso(e.startDate), birthday: iso(e.birthday), anniversaryDate: iso(e.anniversaryDate), benefitsEligibleDate: iso(e.benefitsEligibleDate),
    address: e.address ?? undefined, city: e.city ?? undefined, state: e.state ?? undefined, zipCode: e.zipCode ?? undefined, country: e.country ?? undefined,
    emergencyContactName: e.emergencyContactName ?? undefined, emergencyContactPhone: e.emergencyContactPhone ?? undefined, emergencyContactRelation: e.emergencyContactRelation ?? undefined,
    bio: e.bio ?? undefined, hobbies: e.hobbies ?? undefined, dietaryRestrictions: e.dietaryRestrictions ?? undefined, tShirtSize: e.tShirtSize ?? undefined,
  };
  for (const k of Object.keys(out) as (keyof RowData)[]) {
    if (out[k] === undefined || out[k] === "") delete out[k];
  }
  return out;
}
```

- [ ] **Step 4: Run tests, typecheck, commit**

```bash
npm test && npx tsc --noEmit -p tsconfig.json
git add src/lib/import-export
git commit -m "feat(import): merge planning and employee row projection"
```

---

### Task 8: File parsing (CSV/XLSX) and the upload route

**Files:**
- Create: `src/lib/import-export/parse-file.ts`
- Create: `src/lib/import-export/batch-service.ts` (only `createBatchFromUpload` here; Task 9 adds the rest)
- Create: `src/app/api/data/imports/route.ts`
- Test: `src/lib/import-export/__tests__/parse-file.test.ts`

**Interfaces:**
- Consumes: `parseCsv` (Task 4), `autoDetectMapping` (Task 3).
- Produces: `parseUpload(buffer: Buffer, fileName: string): Promise<{ fileType: "csv" | "xlsx"; headers: string[]; rows: string[][] }>`; `createBatchFromUpload(args: { fileName; fileType; headers; rows; uploadedById }): Promise<string>` (batch id); `POST /api/data/imports` → `{ id }`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { parseUpload } from "@/lib/import-export/parse-file";

describe("parseUpload", () => {
  it("parses csv buffers", async () => {
    const r = await parseUpload(Buffer.from("First,Last\nAda,Lovelace\n", "utf8"), "people.csv");
    expect(r.fileType).toBe("csv");
    expect(r.headers).toEqual(["First", "Last"]);
    expect(r.rows).toEqual([["Ada", "Lovelace"]]);
  });

  it("parses the first sheet of an xlsx, formatting dates and skipping blank rows", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("People");
    ws.addRow(["First", "Last", "Start"]);
    ws.addRow(["Ada", "Lovelace", new Date(Date.UTC(2024, 2, 1))]);
    ws.addRow([]);
    ws.addRow(["Alan", "Turing", 45352]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const r = await parseUpload(buffer, "people.xlsx");
    expect(r.fileType).toBe("xlsx");
    expect(r.headers).toEqual(["First", "Last", "Start"]);
    expect(r.rows).toEqual([["Ada", "Lovelace", "2024-03-01"], ["Alan", "Turing", "45352"]]);
  });
});
```

Run: `npm test` — Expected: FAIL.

- [ ] **Step 2: Implement `parse-file.ts`**

```ts
import ExcelJS from "exceljs";
import { parseCsv } from "./parse-csv";

export type ParsedUpload = { fileType: "csv" | "xlsx"; headers: string[]; rows: string[][] };

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (Array.isArray(v.richText)) return (v.richText as { text: string }[]).map((t) => t.text).join("");
    if ("text" in v) return String(v.text ?? "");
    if ("result" in v) return cellToString(v.result as ExcelJS.CellValue);
    if ("error" in v) return "";
    return String(value);
  }
  return String(value);
}

async function parseXlsx(buffer: Buffer): Promise<{ headers: string[]; rows: string[][] }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return { headers: [], rows: [] };
  const all: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as ExcelJS.CellValue[];
    all.push(values.slice(1).map(cellToString).map((s) => s.trim()));
  });
  const headers = (all.shift() ?? []);
  while (headers.length && headers[headers.length - 1] === "") headers.pop();
  const width = headers.length;
  const rows = all
    .filter((r) => r.some((c) => c !== ""))
    .map((r) => { const out = r.slice(0, width); while (out.length < width) out.push(""); return out; });
  return { headers, rows };
}

export async function parseUpload(buffer: Buffer, fileName: string): Promise<ParsedUpload> {
  const isZip = buffer.length > 1 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (isZip || fileName.toLowerCase().endsWith(".xlsx")) {
    const { headers, rows } = await parseXlsx(buffer);
    return { fileType: "xlsx", headers, rows };
  }
  const { headers, rows } = parseCsv(buffer.toString("utf8"));
  return { fileType: "csv", headers, rows };
}
```

- [ ] **Step 3: Start `batch-service.ts` with `createBatchFromUpload`**

```ts
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { autoDetectMapping } from "./employee-fields";

export async function createBatchFromUpload(args: {
  fileName: string;
  fileType: "csv" | "xlsx";
  headers: string[];
  rows: string[][];
  uploadedById: string;
}): Promise<string> {
  const mapping = autoDetectMapping(args.headers);
  const batch = await db.importBatch.create({
    data: {
      fileName: args.fileName,
      fileType: args.fileType,
      headers: args.headers as Prisma.InputJsonValue,
      mapping: mapping as Prisma.InputJsonValue,
      rowCount: args.rows.length,
      uploadedById: args.uploadedById,
    },
  });
  await db.importRow.createMany({
    data: args.rows.map((raw, i) => ({
      batchId: batch.id,
      rowNumber: i + 1,
      raw: raw as Prisma.InputJsonValue,
      data: {} as Prisma.InputJsonValue,
      errors: [] as Prisma.InputJsonValue,
    })),
  });
  return batch.id;
}
```

- [ ] **Step 4: Write the upload route**

`src/app/api/data/imports/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth-helpers";
import { parseUpload } from "@/lib/import-export/parse-file";
import { createBatchFromUpload, rebuildBatchRows } from "@/lib/import-export/batch-service";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await requireApiAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  const name = file.name.toLowerCase();
  if (!name.endsWith(".csv") && !name.endsWith(".xlsx")) {
    return NextResponse.json({ error: "Only .csv and .xlsx files are supported" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let parsed;
  try {
    parsed = await parseUpload(buffer, file.name);
  } catch (err) {
    console.error("[imports] parse failed", err);
    return NextResponse.json({ error: "Could not read that file" }, { status: 400 });
  }
  if (parsed.headers.length === 0) return NextResponse.json({ error: "The file has no header row" }, { status: 400 });
  if (parsed.rows.length === 0) return NextResponse.json({ error: "The file has no data rows" }, { status: 400 });

  const id = await createBatchFromUpload({ ...parsed, fileName: file.name, uploadedById: session.user.id });
  await rebuildBatchRows(id);
  return NextResponse.json({ id });
}
```

`rebuildBatchRows` is defined in Task 9; until then export a stub `export async function rebuildBatchRows(_batchId: string): Promise<void> {}` in `batch-service.ts` so the route compiles.

- [ ] **Step 5: Run tests, typecheck, commit**

```bash
npm test && npx tsc --noEmit -p tsconfig.json
git add src/lib/import-export src/app/api/data
git commit -m "feat(import): csv/xlsx upload parsing and batch creation route"
```

---

### Task 9: Batch service (rebuild + detection) and server actions

**Files:**
- Modify: `src/lib/import-export/batch-service.ts`
- Create: `src/lib/actions/imports.ts`

**Interfaces:**
- Consumes: `applyMapping`, `validateRow` (Task 5); `detectDuplicates`, `groupKey` (Task 6); `defaultFieldChoices`, `buildMergePlan` (Task 7); `employeeToRowData` (Task 7); types.
- Produces (batch-service): `rebuildBatchRows(batchId)`, `runBatchDetection(batchId, { keepMerged: boolean })`, `loadEmployeesLite()`, `loadEmployeeSnapshots(ids: string[]): Promise<Record<string, EmployeeSnapshot>>`, type `EmployeeSnapshot = { id: string; name: string; status: string; archived: boolean; data: RowData }`.
- Produces (actions): the functions and types below, all exported from `@/lib/actions/imports`:

```ts
export type ImportBatchSummary = {
  id: string; fileName: string; status: "REVIEWING" | "IMPORTED" | "DISCARDED"; rowCount: number;
  createdAt: string; importedAt: string | null; uploadedBy: string;
  counts: { create: number; update: number; mergedAway: number; skipped: number; invalid: number };
};
export type ImportRowView = {
  id: string; rowNumber: number; raw: string[]; data: RowData; errors: RowError[];
  action: RowAction; targetEmployeeId: string | null; mergedIntoRowId: string | null; skipReason: string | null;
};
export type ImportGroupView = {
  id: string; status: "PENDING" | "MERGED" | "SEPARATE"; reasons: GroupReason[]; members: MemberRef[]; primary: MemberRef | null;
};
export type ImportBatchDetail = {
  batch: { id: string; fileName: string; fileType: string; headers: string[]; mapping: ColumnMapping | null;
           status: "REVIEWING" | "IMPORTED" | "DISCARDED"; rowCount: number; createdAt: string; importedAt: string | null; uploadedBy: string };
  rows: ImportRowView[];
  groups: ImportGroupView[];
  employees: Record<string, EmployeeSnapshot>;
  stats: { needsDecision: number; newPeople: number; updates: number; mergedAway: number; skipped: number; needsAttention: number };
};
export async function listImportBatches(): Promise<ImportBatchSummary[]>
export async function getImportBatch(id: string): Promise<ImportBatchDetail | null>
export async function saveImportMapping(batchId: string, mapping: ColumnMapping): Promise<void>
export async function updateImportRow(batchId: string, rowId: string, data: RowData): Promise<void>
export async function skipImportRow(batchId: string, rowId: string): Promise<void>
export async function unskipImportRow(batchId: string, rowId: string): Promise<void>
export async function resolveGroupMerge(batchId: string, groupId: string, primary: MemberRef, choices: Partial<Record<FieldKey, MemberRef>>): Promise<void>
export async function resolveGroupSeparate(batchId: string, groupId: string): Promise<void>
export async function undoGroupDecision(batchId: string, groupId: string): Promise<void>
export async function discardImportBatch(batchId: string): Promise<void>
```

Every mutating action throws `Error("This import is no longer editable")` unless `batch.status === "REVIEWING"`, and calls `revalidatePath("/data")` and `revalidatePath(`/data/imports/${batchId}`)`.

- [ ] **Step 1: Complete `batch-service.ts`**

Replace the stub with:

```ts
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { autoDetectMapping } from "./employee-fields";
import { applyMapping, validateRow } from "./normalize";
import { detectDuplicates, groupKey } from "./duplicates";
import { employeeToRowData } from "./employee-row";
import { refKey, type ColumnMapping, type ExistingEmployeeLite, type MemberRef, type RowData, type RowLite } from "./types";

export type EmployeeSnapshot = { id: string; name: string; status: string; archived: boolean; data: RowData };

const LITE_SELECT = { id: true, firstName: true, lastName: true, preferredName: true, email: true, phone: true } as const;

/** Every employee, archived included (db.ts hides archived rows unless archivedAt is set explicitly). */
export async function loadEmployeesLite(): Promise<ExistingEmployeeLite[]> {
  const [active, archived] = await Promise.all([
    db.employee.findMany({ select: LITE_SELECT }),
    db.employee.findMany({ where: { archivedAt: { not: null } }, select: LITE_SELECT }),
  ]);
  return [...active, ...archived];
}

const SNAPSHOT_INCLUDE = {
  department: { select: { name: true } },
  team: { select: { name: true } },
  manager: { select: { firstName: true, lastName: true, preferredName: true } },
} as const;

export async function loadEmployeeSnapshots(ids: string[]): Promise<Record<string, EmployeeSnapshot>> {
  if (ids.length === 0) return {};
  const [active, archived] = await Promise.all([
    db.employee.findMany({ where: { id: { in: ids } }, include: SNAPSHOT_INCLUDE }),
    db.employee.findMany({ where: { id: { in: ids }, archivedAt: { not: null } }, include: SNAPSHOT_INCLUDE }),
  ]);
  const out: Record<string, EmployeeSnapshot> = {};
  for (const e of [...active, ...archived]) {
    out[e.id] = {
      id: e.id,
      name: `${e.preferredName || e.firstName} ${e.lastName}`.trim(),
      status: e.status,
      archived: e.archivedAt !== null,
      data: employeeToRowData(e),
    };
  }
  return out;
}

export async function createBatchFromUpload(args: { fileName: string; fileType: "csv" | "xlsx"; headers: string[]; rows: string[][]; uploadedById: string }): Promise<string> {
  // (unchanged from Task 8)
}

/** Re-derive every row's data/errors/action from the batch mapping, then run detection from scratch. */
export async function rebuildBatchRows(batchId: string): Promise<void> {
  const batch = await db.importBatch.findUnique({ where: { id: batchId }, include: { rows: true } });
  if (!batch) throw new Error("Import not found");
  const mapping = (batch.mapping as ColumnMapping | null) ?? autoDetectMapping(batch.headers as string[]);

  await db.$transaction(async (tx) => {
    for (const row of batch.rows) {
      const { data, errors } = validateRow(applyMapping(row.raw as string[], mapping));
      await tx.importRow.update({
        where: { id: row.id },
        data: {
          data: data as Prisma.InputJsonValue,
          errors: errors as Prisma.InputJsonValue,
          action: errors.length > 0 ? "SKIP" : "CREATE",
          skipReason: errors.length > 0 ? "invalid" : null,
          targetEmployeeId: null,
          mergedIntoRowId: null,
        },
      });
    }
    await tx.importDuplicateGroup.deleteMany({ where: { batchId } });
  });
  await runBatchDetection(batchId, { keepMerged: false });
}

/**
 * Recompute duplicate groups. With keepMerged, rows and employees that belong to a MERGED group are
 * excluded from detection and those groups are left untouched; SEPARATE decisions survive when a
 * detected group has exactly the same members as before.
 */
export async function runBatchDetection(batchId: string, opts: { keepMerged: boolean }): Promise<void> {
  const [rows, groups, employees] = await Promise.all([
    db.importRow.findMany({ where: { batchId } }),
    db.importDuplicateGroup.findMany({ where: { batchId } }),
    loadEmployeesLite(),
  ]);

  const merged = opts.keepMerged ? groups.filter((g) => g.status === "MERGED") : [];
  const excluded = new Set<string>();
  for (const g of merged) for (const m of g.members as MemberRef[]) excluded.add(refKey(m));

  const liveRows: RowLite[] = rows
    .filter((r) => (r.action === "CREATE" || r.action === "UPDATE") && !excluded.has(refKey({ kind: "row", id: r.id })))
    .map((r) => ({ id: r.id, rowNumber: r.rowNumber, data: r.data as RowData }));
  const candidates = employees.filter((e) => !excluded.has(refKey({ kind: "employee", id: e.id })));

  const detected = detectDuplicates(liveRows, candidates);
  const previousSeparate = new Set(
    groups.filter((g) => g.status === "SEPARATE").map((g) => groupKey(g.members as MemberRef[])),
  );
  const keepIds = new Set(merged.map((g) => g.id));

  await db.$transaction(async (tx) => {
    await tx.importDuplicateGroup.deleteMany({ where: { batchId, id: { notIn: Array.from(keepIds) } } });
    if (detected.length > 0) {
      await tx.importDuplicateGroup.createMany({
        data: detected.map((g) => ({
          batchId,
          status: previousSeparate.has(g.key) ? "SEPARATE" : "PENDING",
          reasons: g.reasons as unknown as Prisma.InputJsonValue,
          members: g.members as unknown as Prisma.InputJsonValue,
        })),
      });
    }
  });
}
```

- [ ] **Step 2: Write `src/lib/actions/imports.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { validateRow } from "@/lib/import-export/normalize";
import { buildMergePlan } from "@/lib/import-export/merge";
import { loadEmployeeSnapshots, rebuildBatchRows, runBatchDetection, type EmployeeSnapshot } from "@/lib/import-export/batch-service";
import { refKey, sameRef, type ColumnMapping, type FieldKey, type GroupReason, type MemberRef, type MergeMember, type RowAction, type RowData, type RowError } from "@/lib/import-export/types";

export type { EmployeeSnapshot };

export type ImportBatchSummary = { /* as in Interfaces */ };
export type ImportRowView = { /* as in Interfaces */ };
export type ImportGroupView = { /* as in Interfaces */ };
export type ImportBatchDetail = { /* as in Interfaces */ };

async function requireImportAccess() {
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR") throw new Error("Forbidden");
  return session;
}

async function requireEditableBatch(batchId: string) {
  const batch = await db.importBatch.findUnique({ where: { id: batchId } });
  if (!batch) throw new Error("Import not found");
  if (batch.status !== "REVIEWING") throw new Error("This import is no longer editable");
  return batch;
}

function revalidate(batchId: string) {
  revalidatePath("/data");
  revalidatePath(`/data/imports/${batchId}`);
}

function uploaderName(u: { email: string; employee: { firstName: string; lastName: string; preferredName: string | null } | null }) {
  return u.employee ? `${u.employee.preferredName || u.employee.firstName} ${u.employee.lastName}` : u.email;
}

export async function listImportBatches(): Promise<ImportBatchSummary[]> {
  await requireImportAccess();
  const [batches, counts] = await Promise.all([
    db.importBatch.findMany({
      orderBy: { createdAt: "desc" },
      include: { uploadedBy: { select: { email: true, employee: { select: { firstName: true, lastName: true, preferredName: true } } } } },
    }),
    db.importRow.groupBy({ by: ["batchId", "action", "skipReason"], _count: { _all: true } }),
  ]);
  const byBatch = new Map<string, ImportBatchSummary["counts"]>();
  for (const c of counts) {
    const cur = byBatch.get(c.batchId) ?? { create: 0, update: 0, mergedAway: 0, skipped: 0, invalid: 0 };
    const n = c._count._all;
    if (c.action === "CREATE") cur.create += n;
    else if (c.action === "UPDATE") cur.update += n;
    else if (c.action === "MERGED_AWAY") cur.mergedAway += n;
    else if (c.skipReason === "invalid") cur.invalid += n;
    else cur.skipped += n;
    byBatch.set(c.batchId, cur);
  }
  return batches.map((b) => ({
    id: b.id, fileName: b.fileName, status: b.status, rowCount: b.rowCount,
    createdAt: b.createdAt.toISOString(), importedAt: b.importedAt?.toISOString() ?? null,
    uploadedBy: uploaderName(b.uploadedBy),
    counts: byBatch.get(b.id) ?? { create: 0, update: 0, mergedAway: 0, skipped: 0, invalid: 0 },
  }));
}

export async function getImportBatch(id: string): Promise<ImportBatchDetail | null> {
  await requireImportAccess();
  const batch = await db.importBatch.findUnique({
    where: { id },
    include: {
      rows: { orderBy: { rowNumber: "asc" } },
      groups: { orderBy: { createdAt: "asc" } },
      uploadedBy: { select: { email: true, employee: { select: { firstName: true, lastName: true, preferredName: true } } } },
    },
  });
  if (!batch) return null;

  const rows: ImportRowView[] = batch.rows.map((r) => ({
    id: r.id, rowNumber: r.rowNumber, raw: r.raw as string[], data: r.data as RowData, errors: r.errors as RowError[],
    action: r.action as RowAction, targetEmployeeId: r.targetEmployeeId, mergedIntoRowId: r.mergedIntoRowId, skipReason: r.skipReason,
  }));
  const groups: ImportGroupView[] = batch.groups.map((g) => ({
    id: g.id, status: g.status, reasons: g.reasons as GroupReason[], members: g.members as MemberRef[], primary: (g.primary as MemberRef | null) ?? null,
  }));

  const employeeIds = new Set<string>();
  for (const g of groups) for (const m of g.members) if (m.kind === "employee") employeeIds.add(m.id);
  for (const r of rows) if (r.targetEmployeeId) employeeIds.add(r.targetEmployeeId);
  const employees = await loadEmployeeSnapshots(Array.from(employeeIds));

  const rowById = new Map(rows.map((r) => [r.id, r]));
  const isLive = (m: MemberRef) => m.kind === "employee" ? !!employees[m.id] : ["CREATE", "UPDATE"].includes(rowById.get(m.id)?.action ?? "");
  const needsDecision = groups.filter((g) => g.status === "PENDING" && g.members.filter(isLive).length >= 2).length;

  // Keep detection ordering (strong first) — groups were created in detected order.
  return {
    batch: {
      id: batch.id, fileName: batch.fileName, fileType: batch.fileType, headers: batch.headers as string[],
      mapping: (batch.mapping as ColumnMapping | null) ?? null, status: batch.status, rowCount: batch.rowCount,
      createdAt: batch.createdAt.toISOString(), importedAt: batch.importedAt?.toISOString() ?? null, uploadedBy: uploaderName(batch.uploadedBy),
    },
    rows, groups, employees,
    stats: {
      needsDecision,
      newPeople: rows.filter((r) => r.action === "CREATE").length,
      updates: rows.filter((r) => r.action === "UPDATE").length,
      mergedAway: rows.filter((r) => r.action === "MERGED_AWAY").length,
      skipped: rows.filter((r) => r.action === "SKIP" && r.skipReason === "user").length,
      needsAttention: rows.filter((r) => r.action === "SKIP" && r.skipReason === "invalid").length,
    },
  };
}

export async function saveImportMapping(batchId: string, mapping: ColumnMapping): Promise<void> {
  await requireImportAccess();
  const batch = await requireEditableBatch(batchId);
  const headers = batch.headers as string[];
  if (mapping.length !== headers.length) throw new Error("Mapping does not match the file columns");
  if (!mapping.includes("firstName") || !mapping.includes("lastName")) throw new Error("Map both First name and Last name");
  await db.importBatch.update({ where: { id: batchId }, data: { mapping: mapping as Prisma.InputJsonValue } });
  await rebuildBatchRows(batchId);
  revalidate(batchId);
}

async function assertNotInMergedGroup(batchId: string, rowId: string) {
  const groups = await db.importDuplicateGroup.findMany({ where: { batchId, status: "MERGED" } });
  const key = refKey({ kind: "row", id: rowId });
  if (groups.some((g) => (g.members as MemberRef[]).some((m) => refKey(m) === key))) {
    throw new Error("Undo the merge for this row first");
  }
}

export async function updateImportRow(batchId: string, rowId: string, input: RowData): Promise<void> {
  await requireImportAccess();
  await requireEditableBatch(batchId);
  await assertNotInMergedGroup(batchId, rowId);
  const row = await db.importRow.findFirst({ where: { id: rowId, batchId } });
  if (!row) throw new Error("Row not found");
  const { data, errors } = validateRow(input);
  const wasInvalid = row.action === "SKIP" && row.skipReason === "invalid";
  const nextAction = errors.length > 0 ? "SKIP" : wasInvalid ? "CREATE" : row.action;
  await db.importRow.update({
    where: { id: rowId },
    data: {
      data: data as Prisma.InputJsonValue,
      errors: errors as Prisma.InputJsonValue,
      action: nextAction,
      skipReason: errors.length > 0 ? "invalid" : nextAction === "SKIP" ? row.skipReason : null,
    },
  });
  await runBatchDetection(batchId, { keepMerged: true });
  revalidate(batchId);
}

export async function skipImportRow(batchId: string, rowId: string): Promise<void> {
  await requireImportAccess();
  await requireEditableBatch(batchId);
  await assertNotInMergedGroup(batchId, rowId);
  const row = await db.importRow.findFirst({ where: { id: rowId, batchId } });
  if (!row) throw new Error("Row not found");
  if (row.action !== "CREATE" && row.action !== "UPDATE") throw new Error("Only new or update rows can be skipped");
  await db.importRow.update({ where: { id: rowId }, data: { action: "SKIP", skipReason: "user", targetEmployeeId: null } });
  revalidate(batchId);
}

export async function unskipImportRow(batchId: string, rowId: string): Promise<void> {
  await requireImportAccess();
  await requireEditableBatch(batchId);
  const row = await db.importRow.findFirst({ where: { id: rowId, batchId } });
  if (!row) throw new Error("Row not found");
  if (row.action !== "SKIP" || row.skipReason !== "user") throw new Error("Row is not skipped");
  const { errors } = validateRow(row.data as RowData);
  await db.importRow.update({
    where: { id: rowId },
    data: errors.length > 0 ? { skipReason: "invalid", errors: errors as Prisma.InputJsonValue } : { action: "CREATE", skipReason: null },
  });
  await runBatchDetection(batchId, { keepMerged: true });
  revalidate(batchId);
}

async function loadGroupMembers(batchId: string, groupId: string) {
  const group = await db.importDuplicateGroup.findFirst({ where: { id: groupId, batchId } });
  if (!group) throw new Error("Group not found");
  const members = group.members as MemberRef[];
  const rowIds = members.filter((m) => m.kind === "row").map((m) => m.id);
  const employeeIds = members.filter((m) => m.kind === "employee").map((m) => m.id);
  const [rows, employees] = await Promise.all([
    db.importRow.findMany({ where: { id: { in: rowIds }, batchId } }),
    loadEmployeeSnapshots(employeeIds),
  ]);
  const liveRows = rows.filter((r) => r.action === "CREATE" || r.action === "UPDATE");
  const mergeMembers: MergeMember[] = [
    ...liveRows.map((r) => ({ ref: { kind: "row" as const, id: r.id }, rowNumber: r.rowNumber, data: r.data as RowData })),
    ...employeeIds.filter((id) => employees[id]).map((id) => ({ ref: { kind: "employee" as const, id }, data: employees[id].data })),
  ];
  return { group, rows, liveRows, employees, mergeMembers };
}

export async function resolveGroupMerge(batchId: string, groupId: string, primary: MemberRef, choices: Partial<Record<FieldKey, MemberRef>>): Promise<void> {
  await requireImportAccess();
  await requireEditableBatch(batchId);
  const { group, liveRows, mergeMembers } = await loadGroupMembers(batchId, groupId);
  if (group.status !== "PENDING") throw new Error("This group already has a decision");
  if (!mergeMembers.some((m) => sameRef(m.ref, primary))) throw new Error("Primary must be a member of the group");
  const plan = buildMergePlan(mergeMembers, primary, choices);

  const snapshot = liveRows.map((r) => ({ id: r.id, data: r.data, action: r.action, targetEmployeeId: r.targetEmployeeId, mergedIntoRowId: r.mergedIntoRowId, skipReason: r.skipReason }));

  await db.$transaction(async (tx) => {
    await tx.importRow.update({
      where: { id: plan.carrierRowId },
      data: { data: plan.data as Prisma.InputJsonValue, action: plan.action, targetEmployeeId: plan.targetEmployeeId, mergedIntoRowId: null, skipReason: null, errors: [] as Prisma.InputJsonValue },
    });
    if (plan.mergedAwayRowIds.length > 0) {
      await tx.importRow.updateMany({ where: { id: { in: plan.mergedAwayRowIds } }, data: { action: "MERGED_AWAY", mergedIntoRowId: plan.carrierRowId, targetEmployeeId: null, skipReason: null } });
    }
    await tx.importDuplicateGroup.update({
      where: { id: groupId },
      data: { status: "MERGED", primary: primary as unknown as Prisma.InputJsonValue, snapshot: snapshot as unknown as Prisma.InputJsonValue },
    });
  });
  revalidate(batchId);
}

export async function resolveGroupSeparate(batchId: string, groupId: string): Promise<void> {
  await requireImportAccess();
  await requireEditableBatch(batchId);
  const { group, mergeMembers } = await loadGroupMembers(batchId, groupId);
  if (group.status !== "PENDING") throw new Error("This group already has a decision");
  const emails = mergeMembers.map((m) => (m.data.email ?? "").toLowerCase()).filter(Boolean);
  if (new Set(emails).size !== emails.length) throw new Error("Two of these records share the exact same email, so they cannot both be imported. Fix the email or merge them.");
  await db.importDuplicateGroup.update({ where: { id: groupId }, data: { status: "SEPARATE" } });
  revalidate(batchId);
}

export async function undoGroupDecision(batchId: string, groupId: string): Promise<void> {
  await requireImportAccess();
  await requireEditableBatch(batchId);
  const group = await db.importDuplicateGroup.findFirst({ where: { id: groupId, batchId } });
  if (!group) throw new Error("Group not found");
  if (group.status === "PENDING") return;
  await db.$transaction(async (tx) => {
    if (group.status === "MERGED" && group.snapshot) {
      const snap = group.snapshot as { id: string; data: RowData; action: RowAction; targetEmployeeId: string | null; mergedIntoRowId: string | null; skipReason: string | null }[];
      for (const s of snap) {
        await tx.importRow.update({ where: { id: s.id }, data: { data: s.data as Prisma.InputJsonValue, action: s.action, targetEmployeeId: s.targetEmployeeId, mergedIntoRowId: s.mergedIntoRowId, skipReason: s.skipReason } });
      }
    }
    await tx.importDuplicateGroup.update({ where: { id: groupId }, data: { status: "PENDING", primary: Prisma.JsonNull, snapshot: Prisma.JsonNull } });
  });
  revalidate(batchId);
}

export async function discardImportBatch(batchId: string): Promise<void> {
  await requireImportAccess();
  await requireEditableBatch(batchId);
  await db.importBatch.update({ where: { id: batchId }, data: { status: "DISCARDED" } });
  revalidate(batchId);
}
```

Fill in the four `type` bodies exactly as listed in this task's Interfaces block. Note `Prisma.JsonNull` (not `null`) clears a nullable Json column.

- [ ] **Step 3: Typecheck, smoke the upload end-to-end, commit**

```bash
npx tsc --noEmit -p tsconfig.json && npm test
```

Then, with the dev server running and a logged-in admin browser session, upload `scratch/people.csv` via the browser console:

```js
const f = new File(["First Name,Last Name,Email,Phone\nAda,Lovelace,ada@x.com,3055550142\nAda,Lovelace,ada.lovelace@x.com,\n"], "people.csv", { type: "text/csv" });
const fd = new FormData(); fd.append("file", f);
fetch("/api/data/imports", { method: "POST", body: fd }).then((r) => r.json()).then(console.log);
```

Expected: `{ id: "…" }`; in `npx prisma studio` (or psql) the batch has 2 rows and 1 group with reasons `["name"]`.

```bash
git add src/lib/import-export src/lib/actions/imports.ts
git commit -m "feat(import): batch service, detection persistence and review actions"
```

---

### Task 10: `/data` page — imports list, new import dialog, export placeholder

**Files:**
- Create: `src/app/(dashboard)/data/page.tsx`
- Create: `src/components/data/imports-list.tsx`
- Create: `src/components/data/new-import-dialog.tsx`
- Create: `src/components/data/export-placeholder.tsx`

**Interfaces:**
- Consumes: `listImportBatches`, `ImportBatchSummary` (Task 9); `POST /api/data/imports` (Task 8).

- [ ] **Step 1: Page**

```tsx
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-helpers";
import { listImportBatches } from "@/lib/actions/imports";
import { PageHeader } from "@/components/ui/page-header";
import { ImportsList } from "@/components/data/imports-list";
import { NewImportDialog } from "@/components/data/new-import-dialog";
import { ExportPlaceholder } from "@/components/data/export-placeholder";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DataPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireAdmin();
  const { tab } = await searchParams;
  const active = tab === "export" ? "export" : "import";
  const batches = active === "import" ? await listImportBatches() : [];

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <PageHeader
        title="Import & Export"
        description="Bring people in from a spreadsheet, review duplicates before anything is saved, and export data out of the system."
        action={active === "import" ? <NewImportDialog /> : undefined}
      />
      <nav aria-label="Import & Export sections" className="mb-6 flex gap-1 border-b border-[var(--color-border)]">
        {[{ id: "import", label: "Import" }, { id: "export", label: "Export" }].map((t) => {
          const selected = t.id === active;
          return (
            <Link key={t.id} href={`/data?tab=${t.id}`} aria-current={selected ? "page" : undefined}
              className={cn("relative inline-flex h-10 items-center px-3 text-sm font-medium transition-colors",
                selected ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]")}>
              {t.label}
              {selected && <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--color-accent)]" />}
            </Link>
          );
        })}
      </nav>
      {active === "import" ? <ImportsList batches={batches} /> : <ExportPlaceholder />}
    </div>
  );
}
```

- [ ] **Step 2: Imports list**

```tsx
import Link from "next/link";
import { cn, formatDate } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import type { ImportBatchSummary } from "@/lib/actions/imports";

const STATUS: Record<ImportBatchSummary["status"], { label: string; className: string }> = {
  REVIEWING: { label: "Reviewing", className: "bg-amber-500/10 text-amber-600" },
  IMPORTED: { label: "Imported", className: "bg-emerald-500/10 text-emerald-600" },
  DISCARDED: { label: "Discarded", className: "bg-[var(--color-surface-container)] text-[var(--color-text-muted)]" },
};

export function ImportsList({ batches }: { batches: ImportBatchSummary[] }) {
  if (batches.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center">
        <Icon name="upload_file" size={36} className="text-[var(--color-text-muted)] mx-auto mb-2" />
        <p className="text-sm font-medium text-[var(--color-text-primary)]">No imports yet</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">Upload a CSV or Excel file of people to start a review.</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wide text-[var(--color-text-muted)] bg-[var(--color-surface-container-low)]">
          <tr>
            <th className="px-4 py-2 text-left font-medium">File</th>
            <th className="px-4 py-2 text-left font-medium">Uploaded by</th>
            <th className="px-4 py-2 text-left font-medium">Date</th>
            <th className="px-4 py-2 text-right font-medium">Rows</th>
            <th className="px-4 py-2 text-right font-medium">New</th>
            <th className="px-4 py-2 text-right font-medium">Updates</th>
            <th className="px-4 py-2 text-right font-medium">Merged</th>
            <th className="px-4 py-2 text-right font-medium">Skipped</th>
            <th className="px-4 py-2 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {batches.map((b) => (
            <tr key={b.id} className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]">
              <td className="px-4 py-3">
                <Link href={`/data/imports/${b.id}`} className="font-medium text-[var(--color-text-primary)] hover:underline inline-flex items-center gap-2">
                  <Icon name="table_chart" size={16} className="text-[var(--color-text-muted)]" />{b.fileName}
                </Link>
              </td>
              <td className="px-4 py-3 text-[var(--color-text-muted)]">{b.uploadedBy}</td>
              <td className="px-4 py-3 text-[var(--color-text-muted)]">{formatDate(b.createdAt)}</td>
              <td className="px-4 py-3 text-right">{b.rowCount}</td>
              <td className="px-4 py-3 text-right">{b.counts.create}</td>
              <td className="px-4 py-3 text-right">{b.counts.update}</td>
              <td className="px-4 py-3 text-right">{b.counts.mergedAway}</td>
              <td className="px-4 py-3 text-right">{b.counts.skipped + b.counts.invalid}</td>
              <td className="px-4 py-3">
                <span className={cn("inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium", STATUS[b.status].className)}>{STATUS[b.status].label}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: New import dialog**

```tsx
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";

export function NewImportDialog() {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function upload(file: File) {
    setError(null);
    const name = file.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".xlsx")) { setError("Choose a .csv or .xlsx file."); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/data/imports", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError(body.error || "Upload failed."); return; }
      router.push(`/data/imports/${body.id}`);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <button onClick={() => { setError(null); setOpen(true); }}
        className={cn("inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]")}>
        <Icon name="upload" size={16} /> New import
      </button>
      <Dialog open={open} onClose={() => !uploading && setOpen(false)} title="Import people from a file">
        <div className="space-y-4">
          <p className="text-xs text-[var(--color-text-muted)]">
            Nothing is saved to the system yet. You'll map columns and review possible duplicates before importing.
          </p>
          <div
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) upload(f); }}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            className={cn("flex flex-col items-center justify-center gap-3 p-8 rounded-lg cursor-pointer transition-colors border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-hover)]")}
          >
            <input ref={inputRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
            {uploading ? (
              <><Icon name="progress_activity" size={32} className="animate-material-spin text-[var(--color-accent)]" /><span className="text-sm">Reading file…</span></>
            ) : (
              <>
                <Icon name="table_chart" size={32} className="text-[var(--color-text-muted)]" />
                <span className="text-sm font-medium text-[var(--color-text-primary)]">Drop a CSV or Excel file here, or click to browse</span>
                <span className="text-xs text-[var(--color-text-muted)]">First row must be column headers. Required: first and last name.</span>
              </>
            )}
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 4: Export placeholder**

```tsx
import { Icon } from "@/components/ui/icon";

export function ExportPlaceholder() {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center">
      <Icon name="download" size={36} className="text-[var(--color-text-muted)] mx-auto mb-2" />
      <p className="text-sm font-medium text-[var(--color-text-primary)]">Export is next</p>
      <p className="text-xs text-[var(--color-text-muted)] mt-1 max-w-md mx-auto">
        You'll pick what to export (people, candidates, departments, time off, reviews…), choose columns and filters, and download CSV or Excel. Not built yet.
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Typecheck, check in the browser, commit**

`npx tsc --noEmit -p tsconfig.json`; open `http://localhost:3000/data` — the sidebar shows Import & Export, the Import tab lists the batch created in Task 9, New import uploads a CSV and lands on the batch page (which 404s until Task 11 — that's expected).

```bash
git add src/app/\(dashboard\)/data src/components/data
git commit -m "feat(import): Import & Export page with import history and upload dialog"
```

---

### Task 11: Batch page, step bar, mapping step, import placeholder

**Files:**
- Create: `src/app/(dashboard)/data/imports/[id]/page.tsx`
- Create: `src/components/data/import-steps.tsx`
- Create: `src/components/data/import-batch-view.tsx`
- Create: `src/components/data/mapping-step.tsx`
- Create: `src/components/data/import-step.tsx`

**Interfaces:**
- Consumes: `getImportBatch`, `ImportBatchDetail`, `saveImportMapping`, `discardImportBatch` (Task 9); `EMPLOYEE_FIELDS`, `FIELD_GROUPS` (Task 3).
- Produces: `ImportBatchView({ detail: ImportBatchDetail })`; a `ReviewStep` slot — Task 12 provides `ReviewStep({ detail }: { detail: ImportBatchDetail })` at `@/components/data/review-step`; until then render a `<div>Review — next</div>` in its place.

- [ ] **Step 1: Page**

```tsx
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth-helpers";
import { getImportBatch } from "@/lib/actions/imports";
import { ImportBatchView } from "@/components/data/import-batch-view";

export const dynamic = "force-dynamic";

export default async function ImportBatchPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const detail = await getImportBatch(id);
  if (!detail) notFound();
  return (
    <div className="max-w-[1400px] mx-auto py-8 px-4">
      <ImportBatchView detail={detail} />
    </div>
  );
}
```

- [ ] **Step 2: Step bar**

```tsx
"use client";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

export type ImportStepId = "map" | "review" | "import";
const STEPS: { id: "upload" | ImportStepId; label: string }[] = [
  { id: "upload", label: "Upload" }, { id: "map", label: "Map columns" }, { id: "review", label: "Review" }, { id: "import", label: "Import" },
];

export function ImportSteps({ current, onSelect, canReview }: { current: ImportStepId; onSelect: (s: ImportStepId) => void; canReview: boolean }) {
  const idx = STEPS.findIndex((s) => s.id === current);
  return (
    <ol className="flex items-center gap-2 mb-6 flex-wrap">
      {STEPS.map((s, i) => {
        const done = i < idx || s.id === "upload";
        const active = s.id === current;
        const clickable = s.id !== "upload" && (s.id === "map" || canReview);
        return (
          <li key={s.id} className="flex items-center gap-2">
            <button type="button" disabled={!clickable} onClick={() => clickable && onSelect(s.id as ImportStepId)}
              className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border",
                active ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                  : done ? "border-emerald-500/30 text-emerald-600" : "border-[var(--color-border)] text-[var(--color-text-muted)]",
                clickable ? "cursor-pointer" : "cursor-default")}>
              {done && !active ? <Icon name="check" size={14} /> : <span className="w-4 text-center">{i + 1}</span>}
              {s.label}
            </button>
            {i < STEPS.length - 1 && <Icon name="chevron_right" size={16} className="text-[var(--color-text-muted)]" />}
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 3: Orchestrator**

```tsx
"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn, formatDate } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { discardImportBatch, saveImportMapping, type ImportBatchDetail } from "@/lib/actions/imports";
import type { ColumnMapping } from "@/lib/import-export/types";
import { ImportSteps, type ImportStepId } from "./import-steps";
import { MappingStep } from "./mapping-step";
import { ImportStep } from "./import-step";
import { ReviewStep } from "./review-step";

function mappingIsComplete(m: ColumnMapping | null) {
  return !!m && m.includes("firstName") && m.includes("lastName");
}

export function ImportBatchView({ detail }: { detail: ImportBatchDetail }) {
  const router = useRouter();
  const readOnly = detail.batch.status !== "REVIEWING";
  const canReview = mappingIsComplete(detail.batch.mapping);
  const [step, setStep] = useState<ImportStepId>(canReview ? "review" : "map");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const hasDecisions = detail.groups.some((g) => g.status !== "PENDING") || detail.rows.some((r) => r.action === "MERGED_AWAY" || r.action === "UPDATE" || r.skipReason === "user");

  function run(fn: () => Promise<void>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      try { await fn(); router.refresh(); after?.(); }
      catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    });
  }

  function handleSaveMapping(mapping: ColumnMapping) {
    if (hasDecisions && !confirm("Changing the mapping re-reads every row and clears all merge / keep-separate decisions. Continue?")) return;
    run(() => saveImportMapping(detail.batch.id, mapping), () => setStep("review"));
  }

  function handleDiscard() {
    if (!confirm("Discard this import? Nothing has been saved to the system; the batch stays in history as Discarded.")) return;
    run(() => discardImportBatch(detail.batch.id), () => router.push("/data"));
  }

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/data" className="text-xs text-[var(--color-text-muted)] hover:underline inline-flex items-center gap-1"><Icon name="arrow_back" size={14} /> All imports</Link>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mt-1 inline-flex items-center gap-2">
            <Icon name="table_chart" size={22} className="text-[var(--color-text-muted)]" /> {detail.batch.fileName}
          </h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            {detail.batch.rowCount} rows · uploaded by {detail.batch.uploadedBy} on {formatDate(detail.batch.createdAt)}
            {readOnly && <span className="ml-2 font-medium">· {detail.batch.status === "IMPORTED" ? "Imported" : "Discarded"}</span>}
          </p>
        </div>
        {!readOnly && (
          <button onClick={handleDiscard} disabled={pending} className="text-xs font-medium text-red-500 hover:underline disabled:opacity-50">Discard import</button>
        )}
      </div>

      <ImportSteps current={step} onSelect={setStep} canReview={canReview} />
      {error && <p className="mb-4 text-xs text-red-500">{error}</p>}
      {pending && <p className="mb-4 text-xs text-[var(--color-text-muted)] inline-flex items-center gap-1"><Icon name="progress_activity" size={14} className="animate-material-spin" /> Working…</p>}

      {step === "map" && (
        <MappingStep headers={detail.batch.headers} mapping={detail.batch.mapping} sampleRows={detail.rows.slice(0, 5).map((r) => r.raw)} readOnly={readOnly} onSave={handleSaveMapping} />
      )}
      {step === "review" && <ReviewStep detail={detail} />}
      {step === "import" && <ImportStep detail={detail} />}
    </div>
  );
}
```

Until Task 12 lands, create `src/components/data/review-step.tsx` as `export function ReviewStep({ detail }: { detail: ImportBatchDetail }) { return <div className="text-sm text-[var(--color-text-muted)]">Review — next ({detail.stats.needsDecision} groups need a decision)</div>; }` with the import of `ImportBatchDetail` type.

- [ ] **Step 4: Mapping step**

```tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { EMPLOYEE_FIELDS, FIELD_GROUPS } from "@/lib/import-export/employee-fields";
import type { ColumnMapping, FieldKey } from "@/lib/import-export/types";

export function MappingStep({ headers, mapping, sampleRows, readOnly, onSave }: {
  headers: string[]; mapping: ColumnMapping | null; sampleRows: string[][]; readOnly: boolean; onSave: (m: ColumnMapping) => void;
}) {
  const [local, setLocal] = useState<ColumnMapping>(mapping ?? headers.map(() => "skip"));
  const used = new Set(local.filter((m) => m !== "skip"));
  const complete = local.includes("firstName") && local.includes("lastName");
  const dirty = JSON.stringify(local) !== JSON.stringify(mapping);

  const selectClass = "w-full px-2 py-1.5 rounded-lg text-sm bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40";

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--color-text-muted)]">Tell us which field each column feeds. Columns set to “(Skip)” are ignored. First and last name are required.</p>
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-[var(--color-text-muted)] bg-[var(--color-surface-container-low)]">
            <tr><th className="px-4 py-2 text-left font-medium w-56">Column in file</th><th className="px-4 py-2 text-left font-medium w-64">Field</th><th className="px-4 py-2 text-left font-medium">Sample values</th></tr>
          </thead>
          <tbody>
            {headers.map((h, i) => (
              <tr key={i} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-2 font-medium text-[var(--color-text-primary)]">{h || <span className="text-[var(--color-text-muted)]">(blank header)</span>}</td>
                <td className="px-4 py-2">
                  <select value={local[i]} disabled={readOnly} className={selectClass}
                    onChange={(e) => setLocal((m) => m.map((v, j) => (j === i ? (e.target.value as FieldKey | "skip") : v)))}>
                    <option value="skip">(Skip)</option>
                    {FIELD_GROUPS.map((g) => (
                      <optgroup key={g} label={g}>
                        {EMPLOYEE_FIELDS.filter((f) => f.group === g).map((f) => (
                          <option key={f.key} value={f.key} disabled={used.has(f.key) && local[i] !== f.key}>{f.label}{f.required ? " *" : ""}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2 text-[var(--color-text-muted)] text-xs">
                  {sampleRows.map((r) => r[i]).filter(Boolean).slice(0, 3).join(" · ") || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!complete && <p className="text-xs text-red-500">Map both First name and Last name to continue.</p>}
      {!readOnly && (
        <div className="flex justify-end">
          <button onClick={() => onSave(local)} disabled={!complete}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] disabled:opacity-50")}>
            {dirty ? "Save mapping & review" : "Continue to review"}
          </button>
        </div>
      )}
    </div>
  );
}
```

When `!dirty`, `onSave(local)` still runs `saveImportMapping` — that is fine (it re-reads rows) but wasteful; in the orchestrator, if the mapping is unchanged skip the server call and just `setStep("review")`: compare `JSON.stringify(mapping) === JSON.stringify(detail.batch.mapping)`.

- [ ] **Step 5: Import step (placeholder)**

```tsx
"use client";
import { Icon } from "@/components/ui/icon";
import type { ImportBatchDetail } from "@/lib/actions/imports";

export function ImportStep({ detail }: { detail: ImportBatchDetail }) {
  const s = detail.stats;
  const blocked = s.needsDecision > 0 || s.needsAttention > 0;
  const tiles = [
    { label: "New people", value: s.newPeople, icon: "person_add" },
    { label: "Updates to existing", value: s.updates, icon: "sync_alt" },
    { label: "Merged into another row", value: s.mergedAway, icon: "merge" },
    { label: "Skipped", value: s.skipped, icon: "block" },
  ];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]"><Icon name={t.icon} size={14} />{t.label}</div>
            <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">{t.value}</p>
          </div>
        ))}
      </div>
      {blocked && (
        <p className="text-xs text-amber-600">
          {s.needsDecision > 0 && `${s.needsDecision} duplicate group${s.needsDecision === 1 ? "" : "s"} still need a decision. `}
          {s.needsAttention > 0 && `${s.needsAttention} row${s.needsAttention === 1 ? "" : "s"} have errors to fix or skip.`}
        </p>
      )}
      <div className="flex items-center justify-end gap-3">
        <span className="text-xs text-[var(--color-text-muted)]">Importing into the system is the next build.</span>
        <button disabled className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white opacity-50 cursor-not-allowed">Import — next</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Typecheck, browser check, commit**

`npx tsc --noEmit -p tsconfig.json`; open the batch from `/data`, change a mapping, save, confirm the step bar moves to Review and the placeholder shows the group count; Discard returns to the list with status Discarded.

```bash
git add src/app/\(dashboard\)/data src/components/data
git commit -m "feat(import): batch page with mapping step and import summary"
```

---

### Task 12: Review step — groups list, all-rows list, side-by-side compare, merge, row editor

**Files:**
- Rewrite: `src/components/data/review-step.tsx`
- Create: `src/components/data/compare-panel.tsx`
- Create: `src/components/data/row-editor.tsx`

**Interfaces:**
- Consumes: `ImportBatchDetail`, `ImportGroupView`, `ImportRowView`, `EmployeeSnapshot`, `resolveGroupMerge`, `resolveGroupSeparate`, `undoGroupDecision`, `skipImportRow`, `unskipImportRow`, `updateImportRow` (Task 9); `EMPLOYEE_FIELDS`, `FIELD_GROUPS`, `FIELD_BY_KEY` (Task 3); `defaultFieldChoices` (Task 7); `normalizeEmail`, `normalizePhone`, `normalizeName` (Task 5); `refKey`, `sameRef` (Task 3).

- [ ] **Step 1: `review-step.tsx`**

Layout: a stats strip, then a two-column grid (`lg:grid-cols-[360px_1fr]`). Left column is a card with a segmented toggle **Duplicates (n)** / **All rows (n)**; right column shows `ComparePanel` for the selected group, `RowEditor` for the selected row, or an empty hint.

```tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { skipImportRow, unskipImportRow, type ImportBatchDetail, type ImportGroupView, type ImportRowView } from "@/lib/actions/imports";
import { refKey, type MemberRef } from "@/lib/import-export/types";
import { ComparePanel } from "./compare-panel";
import { RowEditor } from "./row-editor";

type Selection = { kind: "group"; id: string } | { kind: "row"; id: string } | null;

const REASON_LABEL: Record<string, string> = { email: "Same email", phone: "Same phone", name: "Same name" };
const ACTION_CHIP: Record<string, { label: string; className: string }> = {
  CREATE: { label: "New", className: "bg-emerald-500/10 text-emerald-600" },
  UPDATE: { label: "Update", className: "bg-blue-500/10 text-blue-600" },
  SKIP: { label: "Skipped", className: "bg-[var(--color-surface-container)] text-[var(--color-text-muted)]" },
  MERGED_AWAY: { label: "Merged", className: "bg-purple-500/10 text-purple-600" },
};

export function ReviewStep({ detail }: { detail: ImportBatchDetail }) {
  const router = useRouter();
  const readOnly = detail.batch.status !== "REVIEWING";
  const [tab, setTab] = useState<"groups" | "rows">("groups");
  const [selection, setSelection] = useState<Selection>(() => {
    const first = detail.groups.find((g) => g.status === "PENDING");
    return first ? { kind: "group", id: first.id } : null;
  });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const rowById = useMemo(() => new Map(detail.rows.map((r) => [r.id, r])), [detail.rows]);
  const isLive = (m: MemberRef) => (m.kind === "employee" ? !!detail.employees[m.id] : ["CREATE", "UPDATE"].includes(rowById.get(m.id)?.action ?? ""));
  const needsDecision = (g: ImportGroupView) => g.status === "PENDING" && g.members.filter(isLive).length >= 2;

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try { await fn(); router.refresh(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); }
    });
  }

  const memberLabel = (m: MemberRef) => {
    if (m.kind === "employee") return detail.employees[m.id]?.name ?? "Existing person";
    const r = rowById.get(m.id);
    return r ? `${r.data.firstName ?? ""} ${r.data.lastName ?? ""}`.trim() || `Row ${r.rowNumber}` : "Row";
  };

  const selectedGroup = selection?.kind === "group" ? detail.groups.find((g) => g.id === selection.id) : undefined;
  const selectedRow = selection?.kind === "row" ? rowById.get(selection.id) : undefined;
  const s = detail.stats;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs">
        <Stat icon="call_merge" label="need a decision" value={s.needsDecision} tone={s.needsDecision ? "warn" : "ok"} />
        <Stat icon="person_add" label="new people ready" value={s.newPeople} />
        <Stat icon="sync_alt" label="updates" value={s.updates} />
        <Stat icon="error" label="need attention" value={s.needsAttention} tone={s.needsAttention ? "warn" : undefined} />
        <Stat icon="block" label="skipped" value={s.skipped} />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
          <div className="flex border-b border-[var(--color-border)] text-xs font-medium">
            {(["groups", "rows"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={cn("flex-1 px-3 py-2", tab === t ? "text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]" : "text-[var(--color-text-muted)]")}>
                {t === "groups" ? `Duplicates (${detail.groups.length})` : `All rows (${detail.rows.length})`}
              </button>
            ))}
          </div>
          <div className="max-h-[70vh] overflow-y-auto">
            {tab === "groups" && (detail.groups.length === 0 ? (
              <p className="p-4 text-xs text-[var(--color-text-muted)]">No possible duplicates found.</p>
            ) : detail.groups.map((g) => {
              const active = selection?.kind === "group" && selection.id === g.id;
              const status = needsDecision(g) ? { label: "Needs decision", cls: "text-amber-600" } : g.status === "MERGED" ? { label: "Merged", cls: "text-purple-600" } : g.status === "SEPARATE" ? { label: "Kept separate", cls: "text-[var(--color-text-muted)]" } : { label: "Resolved", cls: "text-[var(--color-text-muted)]" };
              return (
                <button key={g.id} onClick={() => setSelection({ kind: "group", id: g.id })}
                  className={cn("w-full text-left px-4 py-3 border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]", active && "bg-[var(--color-accent)]/5")}>
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{Array.from(new Set(g.members.map(memberLabel))).join(" · ")}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {g.reasons.map((r) => <span key={r} className="px-1.5 py-0.5 rounded-full bg-[var(--color-surface-container)] text-[10px] text-[var(--color-text-muted)]">{REASON_LABEL[r]}</span>)}
                    <span className={cn("ml-auto text-[10px] font-medium", status.cls)}>{status.label}</span>
                  </div>
                </button>
              );
            }))}
            {tab === "rows" && detail.rows.map((r) => {
              const active = selection?.kind === "row" && selection.id === r.id;
              const chip = ACTION_CHIP[r.action];
              return (
                <button key={r.id} onClick={() => setSelection({ kind: "row", id: r.id })}
                  className={cn("w-full text-left px-4 py-2.5 border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] flex items-center gap-3", active && "bg-[var(--color-accent)]/5")}>
                  <span className="text-[10px] text-[var(--color-text-muted)] w-8 shrink-0">#{r.rowNumber}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-[var(--color-text-primary)] truncate">{`${r.data.firstName ?? ""} ${r.data.lastName ?? ""}`.trim() || "(no name)"}</span>
                    <span className="block text-[11px] text-[var(--color-text-muted)] truncate">{r.data.email ?? r.errors[0]?.message ?? ""}</span>
                  </span>
                  <span className={cn("px-1.5 py-0.5 rounded-full text-[10px] font-medium shrink-0", r.skipReason === "invalid" ? "bg-red-500/10 text-red-500" : chip.className)}>{r.skipReason === "invalid" ? "Needs attention" : chip.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-w-0">
          {selectedGroup && <ComparePanel key={selectedGroup.id} detail={detail} group={selectedGroup} readOnly={readOnly} busy={pending} run={run} onSkipRow={(id) => run(() => skipImportRow(detail.batch.id, id))} />}
          {selectedRow && (
            <RowEditor key={selectedRow.id} batchId={detail.batch.id} row={selectedRow} readOnly={readOnly} busy={pending} run={run}
              onSkip={() => run(() => skipImportRow(detail.batch.id, selectedRow.id))} onUnskip={() => run(() => unskipImportRow(detail.batch.id, selectedRow.id))} />
          )}
          {!selectedGroup && !selectedRow && (
            <div className="rounded-xl border border-dashed border-[var(--color-border)] p-12 text-center text-sm text-[var(--color-text-muted)]">
              {detail.groups.length === 0 ? "No duplicates to review. Head to the Import step." : "Select a duplicate group or a row to see its details."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, tone }: { icon: string; label: string; value: number; tone?: "warn" | "ok" }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]",
      tone === "warn" && "border-amber-500/40 text-amber-600", tone === "ok" && "border-emerald-500/40 text-emerald-600")}>
      <Icon name={icon} size={14} /><strong>{value}</strong> {label}
    </span>
  );
}
```

- [ ] **Step 2: `compare-panel.tsx`**

Props: `{ detail, group, readOnly, busy, run: (fn: () => Promise<void>) => void, onSkipRow: (rowId: string) => void }`.

Build `members: MergeMember & { label: string; sublabel: string; href?: string; live: boolean; badge: string }[]` from `group.members`: rows → label `Row {n} in file`, sublabel = action chip text, `live` = action CREATE/UPDATE; employees → label `Already in system`, sublabel = `status` (+ "Archived" if archived), `href = /people/{id}`.

Two modes in local state: `"view"` and `"merge"`. In both modes render a table: first column = field label (grouped by `FIELD_GROUPS` with a subtle group header row), then one column per member. Field row highlighting: compute `distinct = new Set(live members' normalized values)`; normalize by type: email → `normalizeEmail`, phone → `normalizePhone`, otherwise `normalizeName`-style lowercase/trim. If `distinct.size > 1` → `bg-amber-500/5` and value text `font-medium`; if all live values equal and non-empty → dim (`text-[var(--color-text-muted)]`). Empty values render "—".

Header row cells: the label, sublabel, and for employees a `Link` "Open profile". In merge mode, header cells hold a radio `Primary` (name `primary-{group.id}`).

Merge mode: `primary` state (default: first employee member if any, else first live row), `choices` state initialised from `defaultFieldChoices(liveMembers, primary)` and re-initialised whenever `primary` changes. For every field where `distinct.size > 1`, each member cell shows a radio (`name={`${group.id}-${field.key}`}`, checked when `sameRef(choices[key], member.ref)`); cells with an empty value show the radio too (choosing "empty" is allowed — it removes that key from `choices`… simpler: disable the radio on empty cells). A live preview column "Result" at the far right shows the value that will be kept per field.

Footer (hidden when `readOnly`):
- View mode & `group.status === "PENDING"` & ≥ 2 live members: buttons **Merge into one** (→ merge mode), **Keep separate** (`run(() => resolveGroupSeparate(detail.batch.id, group.id))`) and, per live row column header, a small **Skip this row** link (`onSkipRow(row.id)`). If two live members share the exact lowercased email, disable Keep separate and show "These records share the same email, so they can't both be imported — fix the email or merge."
- View mode & status MERGED / SEPARATE: a note ("Merged into Row 14 as an update to Maria Garcia" / "Kept as separate people") + **Undo** (`run(() => undoGroupDecision(detail.batch.id, group.id))`).
- Merge mode: **Cancel** (back to view) and **Confirm merge** → `run(() => resolveGroupMerge(detail.batch.id, group.id, primary, choices))`, then back to view mode.
- If the group contains two or more employees: an info line "Two existing people look alike — merging existing records isn't supported here; pick one as the primary and the other stays untouched."

Wrap the table in `<div className="overflow-x-auto">` and give member columns `min-w-[220px]`.

- [ ] **Step 3: `row-editor.tsx`**

Props: `{ batchId, row: ImportRowView, readOnly, busy, run, onSkip, onUnskip }`. Shows `Row {n}` header with the action chip and, for MERGED_AWAY, "Merged into row …" (find by `mergedIntoRowId` is not available here — show the id-less text "Merged into another row" and no form). For UPDATE rows show "Will update an existing person" text.

Form: a two-column grid of inputs for every `EMPLOYEE_FIELDS` entry (grouped headings), `<select>` for the `status` enum, `type="date"` inputs for date fields (value is already `YYYY-MM-DD` when valid; when invalid keep a text input showing the raw value with the error below). Errors from `row.errors` render under the matching field in red. Local state `values: RowData` initialised from `row.data`, plus the raw cell for fields with errors is not available (data omits them) — so for fields listed in `row.errors`, prefill from `row.raw` using the batch mapping is not possible here either; simply leave them empty with the error message visible. Buttons: **Save** (`run(() => updateImportRow(batchId, row.id, values))`), **Skip row** / **Unskip row** depending on action. Disabled entirely when `readOnly` or `row.action === "MERGED_AWAY"`.

- [ ] **Step 4: Typecheck, walk the whole flow, commit**

`npx tsc --noEmit -p tsconfig.json && npm test`. In the browser, with a CSV containing: an exact-email duplicate pair, a same-name pair with different emails, a row matching an existing employee by phone, and a row with a bad date — verify:
1. Groups list shows three groups with the right badges; the bad-date row is under All rows as "Needs attention".
2. Compare panel highlights differing fields; Merge → radios → Confirm produces a Merged group and the "All rows" list shows one row as Merged.
3. Keep separate is blocked for the exact-email pair with the explanatory message.
4. Undo restores the group to Needs decision.
5. Editing the bad date and saving turns the row New and re-runs detection.
6. Import step is disabled until decisions are done, then shows correct counts (button still "Import — next").

```bash
git add src/components/data
git commit -m "feat(import): duplicate review with side-by-side compare, merge, keep-separate and row editing"
```

---

### Task 13: Final verification on localhost

- [ ] Run `npm test && npx tsc --noEmit -p tsconfig.json && npm run lint`.
- [ ] Confirm the dev server on port 3000 belongs to this repo (`lsof -p <pid> | grep cwd`); if not, start `npm run dev` on another port and report that URL.
- [ ] Walk `/people` (grouping, filters, search, URL state, pending approve) and `/data` → new import → map → review → import summary; discard; history list.
- [ ] Report to the user: the localhost URL, what to try, and that nothing has been pushed (branch `feature/people-list-import-export`).
