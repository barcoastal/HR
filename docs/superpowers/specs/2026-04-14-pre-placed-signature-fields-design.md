# Pre-placed Signature Fields

## Summary

When HR uploads a document through the SEND or FILL flow, they must place one or more signature boxes on the PDF before it can be sent. The recipient opens the link, draws their signature once, and it is stamped into every placed position along with today's date.

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

Add one column to `SigningRequest` (used by both SEND and FILL):

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
};
```

Percentages make placements resolution-independent across the placement editor, pdf.js render, and server-side screenshot render.

A `SigningRequest` with `status = PENDING` and `signaturePlacements = null` is invalid and cannot be created; the server action enforces ≥1 placement.

## UX Flow

### Uploader (HR) — SEND and FILL

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

New:
- `src/components/signatures/signature-placement-editor.tsx` — reusable. Props: `pdfUrl`, `initialPlacements?`, `onChange(placements)`, `onContinue()`.
- `src/components/signatures/placement-overlay.tsx` — renders dashed boxes on top of a pdf.js page layer. Used by recipient views.

Modified:
- `src/components/filling/filling-page.tsx` — render `PlacementOverlay`, remove the "choose where to place signature" step, stamp signature into all placements.
- `src/components/signing/signing-page.tsx` — same treatment.
- Send/fill upload dialogs (wherever the existing upload modals live) — insert the placement editor step before final submit.

## Server Changes

- `src/lib/actions/signing.ts` (or whichever action creates `SigningRequest`): accept `signaturePlacements: Placement[]`, validate `placements.length >= 1`, persist.
- `src/app/api/sign/[token]/route.ts` and `src/app/api/fill/[token]/route.ts`:
  - Read `signaturePlacements` from the request row.
  - When compositing the final PDF, for each placement: compute px position from page dimensions × percentages, draw the signature image, draw date string below.
- `src/app/api/fill/[token]/preview/route.ts`: same compositing behavior for preview.

## Error Handling

- Recipient opens a request with no placements (data inconsistency): show error page, no fallback UI. Should not occur given server validation.
- PDF fails to render in placement editor: show existing error state; disable "Continue" (no placements possible).
- Placement box dragged off-page: clamp to page bounds on drop.

## Migration

- Prisma: `prisma db push` adds nullable column. Existing `SigningRequest` rows keep `null` — they are historical / already completed and aren't rendered through the new flow.
- No backfill needed.

## Testing

- Unit: percentage math (page px ↔ placement % round-trips exactly within a 1px tolerance).
- Manual: upload a 3-page PDF, place boxes on page 1 and page 3, send, open recipient link, sign, verify both stamps land in the right spots on the downloaded PDF.
- Manual: I-9 (XFA) still renders and signs correctly.

## Open Questions

None at spec time.
