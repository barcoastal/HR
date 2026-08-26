# People list view + Import & Export tool — design

**Date:** 2026-08-26
**Status:** Sections 1–3 approved in chat and being built. Sections 4–5 (Import commit, Export) are *not yet designed* — placeholders only.

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

## Section 4 — Import (commit) — *not yet designed*

Placeholder in the UI. To be designed: creating `CREATE` rows (status default PENDING → approve/invite flow), applying `UPDATE` rows to their target employee, resolving departments / managers / teams (including managers that are themselves in the batch), audit entries, summary.

## Section 5 — Export — *not yet designed*

Agreed direction: pick an entity (People, Candidates, Departments, Time Off, Reviews, Interviews, …), choose columns, apply filters, download CSV/XLSX. Placeholder tab until designed.

## Testing

`vitest` (new dev dependency, `npm test`) covers the pure modules: CSV parsing, header auto-detection, date/phone/email/name normalization, row validation, duplicate detection and group ordering, and merge-resolution (carrier choice, field choices, snapshot/undo shape). UI and server actions are verified by hand on localhost before anything is committed or pushed (`main` auto-deploys).

## Out of scope (this round)

Merging two *existing* employees; importing candidates (the `/cv` CSV import stays as-is); Gusto sync of imported people; editing arbitrary cells for rows without errors.
