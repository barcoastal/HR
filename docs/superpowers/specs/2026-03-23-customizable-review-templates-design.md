# Customizable Review Templates — Design Spec

## Goal

Allow SUPER_ADMIN and ADMIN to build custom review forms per cycle with configurable field types (star ratings, numeric scales, text, multiple choice, checkboxes, yes/no), with optional per-review-type overrides. Templates are built as part of cycle creation, not reusable across cycles.

## Constraints

- Only SUPER_ADMIN and ADMIN can create/edit templates (HR can create cycles but not attach/edit templates)
- Templates are per-cycle (built fresh, not a shared library)
- Backward compatible — existing cycles with no template use the current hardcoded form
- One default template per cycle, with optional overrides per review type (Self/Manager/Peer)
- Template is locked once cycle status moves to ACTIVE — no edits after reviews can be submitted

---

## Field Types

| Type | Config Options | Response Value |
|------|---------------|----------------|
| `star_rating` | — | integer 1-5 |
| `numeric_scale` | `min`, `max` (both required, integers, min < max, range 0-100) | integer |
| `text_area` | — | string (max 5000 chars) |
| `short_text` | — | string (max 500 chars) |
| `multiple_choice` | `choices: string[]` (2-20 choices, each max 200 chars) | string (must match a defined choice) |
| `checkbox_list` | `choices: string[]` (2-20 choices, each max 200 chars) | string[] (must be subset of defined choices) |
| `yes_no` | — | boolean |

Each field has: `id` (uuid), `type`, `label` (max 200 chars), `required` (boolean), and type-specific `options`.

---

## Data Model Changes

### ReviewCycle — add JSON fields

**File:** `prisma/schema.prisma`

Add to the `ReviewCycle` model:

```
template         Json?    // default field definitions array
selfTemplate     Json?    // override for Self reviews
managerTemplate  Json?    // override for Manager reviews
peerTemplate     Json?    // override for Peer reviews
```

### Review — add responses JSON

**File:** `prisma/schema.prisma`

Add to the `Review` model:

```
responses        Json?    // { "field-uuid": value, ... }
```

Existing fields (`rating`, `strengths`, `improvements`, `goals`) remain untouched for backward compatibility.

### Template JSON structure

```json
[
  {
    "id": "uuid-string",
    "type": "star_rating",
    "label": "Overall Rating",
    "required": true,
    "options": {}
  },
  {
    "id": "uuid-string",
    "type": "numeric_scale",
    "label": "Leadership Score",
    "required": false,
    "options": { "min": 1, "max": 10 }
  },
  {
    "id": "uuid-string",
    "type": "multiple_choice",
    "label": "Promotion Readiness",
    "required": true,
    "options": { "choices": ["Not ready", "Almost ready", "Ready", "Overdue"] }
  }
]
```

---

## Flow

```
Create/Edit Cycle (DRAFT only — template locked once ACTIVE)
  ├─ Enter name, dates
  ├─ Build template (add/remove/reorder fields)
  │   └─ Optionally override per review type (Self/Manager/Peer)
  └─ Save cycle with template JSON

Submit Review
  ├─ Load cycle template (or type-specific override)
  ├─ Render dynamic form based on field definitions
  ├─ Validate required fields
  └─ Save responses as JSON on Review.responses

View Review
  ├─ Load template + responses
  └─ Render each field read-only with its value

Stats (closed cycles)
  ├─ Star/Numeric fields: average score
  ├─ Multiple choice: distribution counts
  ├─ Checkbox list: count per option
  ├─ Yes/No: percentage split
  └─ Text: no aggregation
```

---

## Changes

### 1. Schema migration

**File:** `prisma/schema.prisma`

- Add `template`, `selfTemplate`, `managerTemplate`, `peerTemplate` (all `Json?`) to `ReviewCycle`
- Add `responses` (`Json?`) to `Review`

### 2. Template builder component

**File:** `src/components/reviews/template-builder.tsx` (new)

Client component for building the field list:

- "Add Field" button with dropdown of 7 field types
- Each field renders as a row: type icon, label, required badge, config summary
- Up/down arrow buttons for reordering
- Edit button opens inline form (label, required toggle, type-specific options)
- Delete button removes field
- Default pre-populated fields: Star Rating ("Overall Rating", required), Text Area ("Strengths"), Text Area ("Areas for Improvement"), Text Area ("Goals")

### 3. Per-type override section

**File:** `src/components/reviews/template-builder.tsx`

Collapsible section below default builder: "Customize by review type"

- 3 tabs: Self / Manager / Peer
- Each tab has its own template builder instance
- If left empty, falls back to default template

### 4. Integrate builder into Create Cycle dialog

**File:** `src/components/reviews/create-cycle-dialog.tsx`

- Add template builder section after date inputs, before department selection
- Pass built template JSON to `createReviewCycle` action
- Save template fields on the cycle record

### 5. Update create/update cycle actions

**File:** `src/lib/actions/reviews.ts`

- `createReviewCycle` accepts optional `template`, `selfTemplate`, `managerTemplate`, `peerTemplate` JSON
- Store on cycle record

### 6. Dynamic submit review dialog

**File:** `src/components/reviews/submit-review-dialog.tsx`

- Check if cycle has a template
  - If yes: render dynamic form from template fields
  - If no: render current hardcoded form (backward compat)
- Resolve which template to use: type-specific override → default template → hardcoded fallback
- Render each field by type:
  - `star_rating`: clickable 5-star picker
  - `numeric_scale`: number input with min/max
  - `text_area`: multiline textarea
  - `short_text`: single-line input
  - `multiple_choice`: radio buttons
  - `checkbox_list`: checkboxes
  - `yes_no`: toggle switch
- Validate required fields before submit
- Save to `Review.responses` as JSON

### 7. Update submit review action

**File:** `src/lib/actions/reviews.ts`

- `submitReview` accepts optional `responses` JSON
- If responses provided, validate against cycle template:
  - All required fields must have values
  - `multiple_choice` value must match one of the defined choices
  - `checkbox_list` values must be a subset of defined choices
  - `numeric_scale` value must be within min/max range
  - `short_text` max 500 chars, `text_area` max 5000 chars
- Save validated responses to `Review.responses`
- Keep existing `rating`/`strengths`/`improvements`/`goals` params for backward compat

### 8. Dynamic view review dialog

**File:** `src/components/reviews/view-review-dialog.tsx`

- Check if cycle has a template
  - If yes: render each field read-only with response value
  - If no: render current hardcoded view
- Field display:
  - Star rating: filled/empty stars
  - Numeric scale: number with min-max context
  - Text: paragraph
  - Multiple choice: selected option as badge
  - Checkbox list: selected options as badges
  - Yes/No: "Yes" or "No" badge

### 9. Stats aggregation for template fields

**File:** `src/app/(dashboard)/reviews/page.tsx`

- For cycles with templates, aggregate per-field:
  - Star/Numeric: calculate average
  - Multiple choice: count per option
  - Checkbox list: count per option
  - Yes/No: percentage split
  - Text: skip
- Use first `star_rating` or `numeric_scale` field as the "primary rating" for the stats cards
- Cycles without templates use existing logic

---

## File Summary

| Action | File |
|--------|------|
| Modify | `prisma/schema.prisma` (add JSON fields to ReviewCycle and Review) |
| Create | `src/components/reviews/template-builder.tsx` (field list builder with reorder/edit/delete) |
| Modify | `src/components/reviews/create-cycle-dialog.tsx` (integrate template builder) |
| Modify | `src/lib/actions/reviews.ts` (accept/store template JSON, accept responses JSON) |
| Modify | `src/components/reviews/submit-review-dialog.tsx` (dynamic form rendering) |
| Modify | `src/components/reviews/view-review-dialog.tsx` (dynamic read-only rendering) |
| Modify | `src/app/(dashboard)/reviews/page.tsx` (template-aware stats aggregation) |
