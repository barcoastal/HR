# Pre-placed Signature Fields

## Summary

Every document that will be signed or filled must have at least one signature placement on the PDF before it is sent. The recipient opens the link, draws their signature once, and it is stamped into every placed position along with today's date.

This applies in two places:

1. **Stage Documents** (`Settings → Stage Documents`) — reusable PDFs per stage (Pre-Onboarding / Onboarding / Offboarding). The existing click-to-place UI supports data placeholders like `{{firstName}}`; we extend it to also support `{{signature}}` and `{{signatureDate}}`.
2. **Ad-hoc SEND / FILL** — one-off document uploads. Uses the same placement editor component as Stage Documents.

## Goals

- Remove ambiguity about where the recipient should sign.
- Require placement (no fallback to free-placement) for both SEND and FILL.
- Support 1..N signature boxes across any pages.
- Keep the existing canvas-screenshot rendering approach (works for XFA/static PDFs).

## Non-goals

- Text, checkbox, initial, or name fields. Only signature + auto-filled date.
- Multi-party signing / countersignatures.
- Template library of reusable placements.
- Changes to how recipients fill form fields in FILL (pdf.js native annotations stay as-is).

## Data Model

### Stage Documents

No schema change. Reuse the existing `StageDocument.placeholders` JSON array. Today each entry looks like:

```ts
{ page: number; x: number; y: number; width: number; placeholder: string; fontSize: number }
```

Extend the allowed values of `placeholder` to include two new tokens:

- `{{signature}}` — signer's drawn signature
- `{{signatureDate}}` — today's date at sign time

At send time, when a `SigningRequest` is created from a `StageDocument`, copy the placements through into the new `signaturePlacements` column (or resolve them on the fly — see Server Changes).

### Ad-hoc SEND / FILL

Add one column to `SigningRequest`:

```prisma
signaturePlacements Json?  // Placement[]
```

`Placement` shape:
```ts
type Placement = {
  page: number;        // 1-indexed
  xPct: number;        // 0..1, left edge relative to page width
  yPct: number;        // 0..1, top edge relative to page height
  widthPct: number;    // 0..1
  heightPct: number;   // 0..1
  kind: "signature" | "signatureDate";
};
```

Percentages make placements resolution-independent across the placement editor, pdf.js render, and server-side screenshot render.

**Validation:** a `SigningRequest` with action SIGN or FILL cannot be created unless the source (Stage Document placements or ad-hoc editor) yields ≥1 placement of `kind = "signature"`.

## UX Flow

### HR — Stage Documents setup

1. In `Settings → Stage Documents`, after selecting `Sign` or `Fill` action, the field chip row shows existing data chips plus two new ones: **`{{signature}}`** and **`{{signatureDate}}`**.
2. Clicking `{{signature}}` switches the active chip; clicking on the PDF drops a signature placeholder (rendered as a dashed box labeled "Signature").
3. `{{signatureDate}}` behaves the same, labeled "Date".
4. Save is disabled for Sign/Fill actions until the document has ≥1 `{{signature}}` placement.
5. Attachment action is unchanged — no signature required.

### HR — Ad-hoc SEND and FILL

1. Existing upload dialog collects file, recipient, message.
2. **New step: Placement editor.**
   - PDF renders with pdf.js, one page at a time, with page navigation.
   - Toolbar: "Add signature box" (default cursor mode), "Delete", page indicator.
   - Click on the page → drops a default-sized signature box at that point (e.g., 180×60 px at 100% zoom, stored as % of page).
   - Each box is draggable and shows "Signature + date" label.
   - X button on hover removes the box.
   - "Continue" disabled until ≥1 box exists.
3. On submit → server action creates `SigningRequest` with `signaturePlacements` and sends email.

### Recipient — SEND (`/sign/[token]`)

1. Opens link → PDF renders with placement boxes drawn as dashed outlines, labeled "Click to sign".
2. Click any box → opens signature pad modal → draw & confirm.
3. Same signature image fills every placement. Date underneath each is today's date in the recipient's locale.
4. "Submit signed document" → server composites PDF via canvas screenshot (existing route).

### Recipient — FILL (`/fill/[token]`)

1. Same as today: pdf.js renders with native form annotations; recipient fills fields inline.
2. Signature placements render as dashed overlays on top of the PDF pages.
3. Click any placement → signature pad → stamps all placements.
4. Submit → existing canvas-screenshot composite route draws filled fields + placed signatures + dates.

## Components

Modified:
- `src/components/settings/stage-documents-manager.tsx` — add `{{signature}}` and `{{signatureDate}}` chips (visible only when action is Sign or Fill); render signature placements with a distinct dashed style; enforce ≥1 signature placement on save.
- `src/components/filling/filling-page.tsx` — render signature placements as dashed overlays, remove the existing "choose where to place signature" step, stamp signature + date into all placements.
- `src/components/signing/signing-page.tsx` — same treatment.
- Send/fill ad-hoc upload dialogs — insert the placement editor step before final submit.

New:
- `src/components/signatures/signature-placement-editor.tsx` — reusable placement UI for ad-hoc SEND/FILL. Props: `pdfUrl`, `initialPlacements?`, `onChange(placements)`, `onContinue()`. Internally uses the same placement primitives as `stage-documents-manager`.
- `src/components/signatures/placement-overlay.tsx` — renders dashed boxes on top of a pdf.js page layer. Used by recipient views and both editors.

## Server Changes

- `src/lib/actions/signing.ts` (or whichever action creates `SigningRequest`):
  - Accept `signaturePlacements: Placement[]` for ad-hoc uploads.
  - When the request originates from a `StageDocument`, derive placements by filtering `StageDocument.placeholders` for entries with `placeholder in ("{{signature}}", "{{signatureDate}}")` and mapping them to `Placement` (converting stored units to percentages if needed — check current unit in the placeholders JSON before implementation).
  - Validate ≥1 `kind = "signature"` placement. Reject otherwise.
  - Persist to `SigningRequest.signaturePlacements`.
- `src/app/api/sign/[token]/route.ts` and `src/app/api/fill/[token]/route.ts`:
  - Read `signaturePlacements` from the request row.
  - When compositing the final PDF, for each placement: compute px position from page dimensions × percentages, draw the signature image (for `signature`) or today's date string (for `signatureDate`).
- `src/app/api/fill/[token]/preview/route.ts`: same compositing behavior for preview.

## Error Handling

- Recipient opens a request with no placements (data inconsistency): show error page, no fallback UI. Should not occur given server validation.
- PDF fails to render in placement editor: show existing error state; disable "Continue" (no placements possible).
- Placement box dragged off-page: clamp to page bounds on drop.

## Migration

- Prisma: `prisma db push` adds the nullable `signaturePlacements` column on `SigningRequest`. Existing rows keep `null` — historical / already completed, not rendered through the new flow.
- Existing `StageDocument` rows keep working; the new chips just become available in the editor. Each existing Sign/Fill stage document must be opened once and have `{{signature}}` placed before its next send — the server validation enforces this at send time with a clear error. No automated backfill.

## Testing

- Unit: percentage math (page px ↔ placement % round-trips exactly within a 1px tolerance).
- Manual: upload a 3-page PDF, place boxes on page 1 and page 3, send, open recipient link, sign, verify both stamps land in the right spots on the downloaded PDF.
- Manual: I-9 (XFA) still renders and signs correctly.

## Open Questions

None at spec time.
