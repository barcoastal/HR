# People list view + Import & Export tool — design

**Date:** 2026-08-26
**Status:** Sections 1–3 shipped 2026-08-26. Sections 4–5 approved the same day and being built.

## Why

Today the People page is a paginated "bento" card grid with a single department filter, and its only import is a 3-step CSV dialog that handles 9 fields, silently skips any row whose email already exists, creates everyone as Pending, and keeps no record of what was imported. There is no export at all.

We want (1) the People page to be a real list of everyone, and (2) a dedicated Import & Export tool with a **staged import**: upload → map columns → review suspected duplicates side by side → merge / keep separate / skip → commit. Every import batch is kept as history.

## Section 1 — People page & navigation

### People page (`/people`)

The card grid is replaced by a dense table of everyone the viewer may see (same visibility rules as today: managers and above; PENDING rows only for SUPER_ADMIN / ADMIN / HR).

- **Columns:** Person (photo/initials, name, preferred name, pronouns) · Job title · Department · Manager · Email · Start date · Status (existing out-of-office badge kept). Row click → `/people/[id]`.
- **Group by** control: **Job title** (default) · Department · Manager · Status · None. Each group has a sticky header with a count and is collapsible.
- **Search** (name / email / job title), **filters** (Department, Status), **sort** (Name, Start date, Job title). State lives in the URL (`?group=department&dept=Sales&status=ACTIVE&q=maria&sort=startDate`) so views are shareable and survive refresh.
- **Pending people** keep the approve / approve-all / delete flow (admins only). They show as their own group at the top when grouped by status, and carry a "Pending" badge with an inline Approve button in other groupings.
- No pagination — groups are the sectioning. (A few hundred people at most.)
- Header keeps **Add Employee** and **Archive** (super admin). **Bulk Import is removed** and replaced by an **"Import & Export"** link (admins/HR).
- `bulk-employee-import.tsx` and `bulkImportEmployees` are deleted — nothing else uses them.

`getEmployees` gains `manager: { id, firstName, lastName, preferredName }` in its include so the Manager column and Manager grouping work.

### Import & Export tool (`/data`)

- New sidebar item **"Import & Export"** (icon `swap_vert`) for SUPER_ADMIN / ADMIN / HR, in the sidebar after People and in the mobile nav's Admin section.
- Page `/data` with two tabs (URL `?tab=import|export`, default import):
  - **Import** — table of every import batch, newest first: file name, uploaded by, date, rows, new / updated / merged / skipped, status (*Reviewing* / *Imported* / *Discarded*). Plus a **New import** button (drop zone dialog). Clicking a batch opens `/data/imports/[id]`.
  - **Export** — placeholder ("Export is next") until Section 5 is designed.
- Pages use `requireAdmin()`; the upload route uses `requireApiAdmin()`; server actions throw `Forbidden` for other roles.

## Section 2 — Import: upload → map → stage

### Data model (Prisma)

```prisma
enum ImportBatchStatus { REVIEWING IMPORTED DISCARDED }
enum ImportRowAction   { CREATE UPDATE SKIP MERGED_AWAY }
enum ImportGroupStatus { PENDING MERGED SEPARATE }

model ImportBatch {
  id           String            @id @default(uuid())
  fileName     String
  fileType     String            // "csv" | "xlsx"
  headers      Json              // string[] — original column headers
  mapping      Json?             // Record<columnIndex, fieldKey | "skip">; null until first save
  status       ImportBatchStatus @default(REVIEWING)
  rowCount     Int
  summary      Json?             // set on import: { created, updated, merged, skipped, errors }
  uploadedById String
  uploadedBy   User              @relation(fields: [uploadedById], references: [id])
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt
  importedAt   DateTime?
  rows         ImportRow[]
  groups       ImportDuplicateGroup[]
  @@index([status])
  @@index([createdAt])
}

model ImportRow {
  id               String          @id @default(uuid())
  batchId          String
  batch            ImportBatch     @relation(fields: [batchId], references: [id], onDelete: Cascade)
  rowNumber        Int             // 1-based, as in the file (excluding header)
  raw              Json            // string[] — original cells
  data             Json            // Record<fieldKey, string> — cleaned values after mapping/merge
  errors           Json            // { field, message }[]
  action           ImportRowAction @default(CREATE)
  targetEmployeeId String?         // when action = UPDATE
  mergedIntoRowId  String?         // when action = MERGED_AWAY
  skipReason       String?         // "user" | "invalid"
  resultEmployeeId String?         // set on import
  @@index([batchId])
}

model ImportDuplicateGroup {
  id        String            @id @default(uuid())
  batchId   String
  batch     ImportBatch       @relation(fields: [batchId], references: [id], onDelete: Cascade)
  status    ImportGroupStatus @default(PENDING)
  reasons   Json              // ("email" | "phone" | "name")[]
  members   Json              // { kind: "row" | "employee", id: string }[]
  primary   Json?             // member ref chosen when merged
  snapshot  Json?             // rows' { id, data, action, targetEmployeeId, mergedIntoRowId } before merge — for undo
  createdAt DateTime          @default(now())
  @@index([batchId])
}
```

`User` gains `importBatches ImportBatch[]`. Batches are never deleted; **Discard** sets `status = DISCARDED`.

### Field registry — `src/lib/import-export/employee-fields.ts`

One list drives header auto-detection, the mapping UI, validation, the comparison view, and (later) export. Each field: `key`, `label`, `group` (Identity / Contact / Job / Dates / Address / Emergency / Personal), `type` (`text` | `email` | `phone` | `date` | `enum` | `relation`), `synonyms[]`, optional `required`, `enumValues`.

Importable fields: firstName*, middleName, lastName*, preferredName, pronouns, email, phone, jobTitle, department (relation by name), manager (relation by "First Last" or email), team (relation by name), startDate, birthday, anniversaryDate, benefitsEligibleDate, location, address, city, state, zipCode, country, emergencyContactName, emergencyContactPhone, emergencyContactRelation, bio, hobbies, dietaryRestrictions, tShirtSize, status (enum: PENDING / ACTIVE / PRE_ONBOARDING / TRAINING / ONBOARDING / OFFBOARDED).

### Upload — `POST /api/data/imports`

Multipart form with `file`. Accepts `.csv` and `.xlsx` (first worksheet). Parsed **on the server** (`src/lib/import-export/parse-file.ts`):

- CSV: in-house RFC 4180 parser (quoted fields, embedded newlines, `""` escapes), strips BOM, auto-detects `,` / `;` / tab delimiter from the header line.
- XLSX: `exceljs` (new dependency); cell values → strings, date cells → `YYYY-MM-DD`.
- Blank rows dropped. Creates the batch, one `ImportRow` per data row (`raw` = cells, `data` = `{}`), auto-detects a mapping from headers (case/space-insensitive synonym lookup), stores it as `mapping`, and immediately applies it (Step 2 logic below) so the batch page opens ready to review. Returns `{ id }`; client navigates to `/data/imports/[id]`.

### Batch page — `/data/imports/[id]`

Step bar: **Upload ✓ → Map → Review → Import**. A batch with status `IMPORTED` or `DISCARDED` is read-only.

**Map.** Each file column gets a select of every field (grouped) plus "(Skip)". A live preview shows the first 5 rows as they'll be read. Save (`saveImportMapping`) rebuilds every row's `data`, validates, and re-runs duplicate detection; merge decisions are cleared (the UI warns before re-saving a changed mapping when decisions exist). A mapping needs firstName + lastName.

**Validation** (`src/lib/import-export/normalize.ts`) per row: missing first/last → error; email must look like an address; dates accept ISO, `M/D/YYYY`, `M/D/YY`, `Month D, YYYY`, and Excel serials → stored as `YYYY-MM-DD`; phone keeps digits (+ leading `+`); enum must match a status. A row with errors gets `action = SKIP, skipReason = "invalid"` and is listed under **Needs attention**; the user can edit that row's fields inline (`updateImportRow`), which re-validates, un-skips it if clean, and re-runs detection.

## Section 3 — Review: duplicates & merge

### Detection — `src/lib/import-export/duplicates.ts` (pure)

`detectDuplicates(rows, existingEmployees) → groups`. Live rows only (`CREATE`/`UPDATE`); existing employees include archived. Signals:

| Signal | Rule | Strength |
|---|---|---|
| email | lowercased; Gmail-style dots and `+tag` stripped from the local part | strong |
| phone | last 10 digits, needs ≥ 10 | strong |
| name | first+last normalized (lowercase, accents stripped, punctuation/whitespace collapsed); also preferredName+last and swapped first/last | possible |

Pairs are row↔row and row↔employee (never employee↔employee). Union-find clusters pairs into groups; each group records the union of reasons. Ordered: groups with a strong reason first, then name-only; then by lowest row number. Groups are persisted (`ImportDuplicateGroup`) so decisions survive navigation; detection is re-run (groups replaced) whenever mapping or row data changes, preserving decisions for groups whose member set is unchanged.

### Review screen

- Top: counters — "N groups need a decision", "N new people ready", "N rows need attention", "N skipped".
- **Left:** list of groups (names involved, reason badges, status chip *Needs decision* / *Merged* / *Kept separate*). A toggle switches to **All rows**: every row with its number, name, email, action chip (New / Update / Skipped / Merged), errors, and Skip/Unskip.
- **Right:** the selected group, one **column per record**, **one row per field** (all ~30 fields). Column header: "Row 14 in file" or "Already in system" (badge + link to `/people/[id]`). Differing fields highlighted; identical fields dimmed. 3+ records scroll horizontally.
- **Actions per group**
  - **Merge into one** — pick the primary (default: the existing employee if there is one, else lowest row). For each differing field a radio per column picks the winner; defaults = primary's value, blanks filled from the others. Confirm → `resolveGroupMerge(batchId, groupId, primary, fieldChoices)`:
    - carrier row = primary row, or (primary is an employee) the lowest-numbered live row in the group;
    - carrier `data` = chosen values; `action` = `UPDATE` + `targetEmployeeId` when primary is an employee, else `CREATE`;
    - every other live row → `MERGED_AWAY`, `mergedIntoRowId` = carrier;
    - group `status = MERGED`, `primary` set, `snapshot` = the rows' prior state.
    - Existing↔existing merging is **out of scope**: if a group holds two existing people, the UI notes it; only one can be the target and the other is untouched.
  - **Keep separate** — `resolveGroupSeparate`: group `SEPARATE`, rows untouched. Disabled (with the reason shown) when two live members share the exact same email, since `Employee.email` is unique — fix the email or merge.
  - **Skip** a single record (`skipImportRow` / `unskipImportRow`): `action = SKIP, skipReason = "user"`. A group counts as needing a decision only while `status = PENDING` **and** it still has ≥ 2 live members.
  - **Undo** (`undoGroupDecision`): restores the snapshot rows and sets the group back to `PENDING`.
- The **Import** button is enabled only when no group needs a decision and no row is invalid. (Section 4 will define what it does; until then it is a disabled "Import — next" placeholder with the summary counts.)

## Section 4 — Import (commit)

Approved 2026-08-26. Triggered by the **Import** button on the batch page; allowed only while `status = REVIEWING`, no group needs a decision, and no row is invalid.

**Before committing** the Import step states the external effects: how many people will be created as *Pending* (no login, no email — approve later from People), how many will be created with another status (they get a login and the welcome email, exactly like "Approve & invite"), and how many existing people will be updated. A confirm dialog repeats those numbers.

**What happens, row by row** (`commitImportBatch`, one row failing never rolls back the others):

1. **Departments / teams** named in the file are created if they don't exist (case-insensitive match on name). A team needs a department; a team named on a row without a department is skipped with a warning.
2. **`CREATE` rows** → `Employee.create` with every field in the row's data. Defaults: `jobTitle` "Employee", `startDate` today, `anniversaryDate` = `startDate`, `status` **PENDING**. A row with no email gets `first.last@pending.local` like the old import. If the email is already taken the row **fails** ("Email already in use").
   Non-PENDING statuses additionally get a `User` account (role EMPLOYEE, linked to the employee — reusing an existing account with that email if present) and the welcome email.
3. **`UPDATE` rows** → `Employee.update` on `targetEmployeeId` with only the fields present in the row's data; blanks never overwrite. `status` is never changed by an update. `email` is changed only if no `User` account is bound to the current email; otherwise a warning ("Email kept — it's the login").
4. **Managers** (second pass, after every row exists): `manager` is matched by exact email, else by name (same normalization as duplicate detection: first+last or preferred+last) against all employees, including the ones this import just created. Exactly one match → `managerId` set; none or several → warning on the row.
5. **Audit**: `employee.created` / `employee.updated` per person (`details.via = "import"`, `batchId`), plus one `import.completed` entry with the summary.
6. **Batch**: `status = IMPORTED`, `importedAt`, `summary = { created, updated, failed, warnings, invited }`. Each row records `result` (`created` | `updated` | `failed`), `resultEmployeeId`, and `resultNotes` (warnings / failure reason).

`ImportRow` gains `result String?` and `resultNotes Json?`.

**After committing** the batch page opens on the Import step showing a results table: row, name, result chip, notes, link to the person. The People page (`/people`, `/org`) is revalidated. No undo in this version — use Archive/Delete on the person.

## Section 5 — Export

Approved 2026-08-26. Export tab on `/data`, SUPER_ADMIN / ADMIN / HR only.

**Entities (v1)** — a registry (`export-registry.ts`) declares each one's columns (with a default-on set) and filters:

| Entity | Columns | Filters |
|---|---|---|
| People | first/last/preferred name, pronouns, email, phone, job title, department, team, manager, status, start/end date, birthday, location, address/city/state/zip/country, emergency contact name/phone/relation, T-shirt size, created | status, department |
| Candidates | first/last name, email, phone, status, position, source, recruiter, manager, applied, hired, background check status/date, hourly rate, LinkedIn | status, position, applied date range |
| Departments | name, description, head, parent department, member count, created | — |
| Time off requests | employee, policy, start, end, days, status, approver, reason, requested | status, date range (start) |
| Reviews | employee, reviewer, cycle, type, status, rating, created | status, cycle date range |
| Interviews | candidate, position, interviewer, scheduled at, duration, type, status, meet link, created | status, scheduled date range |

**Builder UI**: pick an entity → tick columns (defaults pre-ticked; Select all / Defaults) → filters → format (**CSV** or **Excel**) → live "N rows match" count → **Download**. The download is a direct `GET /api/data/export?entity=…&columns=…&format=…&<filters>`; the server validates entity and columns against the registry, so the URL cannot request columns the registry doesn't expose.

**Output**: CSV is UTF-8 with BOM (opens cleanly in Excel), RFC 4180 quoting; Excel is a single sheet with a bold header row. File name `<entity>-<YYYY-MM-DD>.<csv|xlsx>`. Each download writes an audit entry `data.exported` (entity, filters, column count, row count). No export history UI.

## Testing

`vitest` (new dev dependency, `npm test`) covers the pure modules: CSV parsing, header auto-detection, date/phone/email/name normalization, row validation, duplicate detection and group ordering, and merge-resolution (carrier choice, field choices, snapshot/undo shape). UI and server actions are verified by hand on localhost before anything is committed or pushed (`main` auto-deploys).

## Out of scope (this round)

Merging two *existing* employees; importing candidates (the `/cv` CSV import stays as-is); Gusto sync of imported people; editing arbitrary cells for rows without errors.
