# Customizable Review Templates Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins to build custom review forms per cycle with 7 field types (star rating, numeric scale, text area, short text, multiple choice, checkbox list, yes/no), with optional per-review-type overrides.

**Architecture:** Templates are stored as JSON on ReviewCycle (not a separate table). Each Review stores its responses as JSON. The template builder is a client component integrated into the Create Cycle dialog. Submit and View dialogs dynamically render fields based on the cycle's template, falling back to the current hardcoded form for backward compatibility.

**Tech Stack:** Next.js 16 App Router, Prisma (PostgreSQL), TypeScript, Tailwind CSS v4, Material Symbols icons via `<Icon>` component, `framer-motion` for Dialog animations.

**Spec:** `docs/superpowers/specs/2026-03-23-customizable-review-templates-design.md`

---

## Chunk 1: Schema + Types + Template Builder

### Task 1: Prisma Schema Migration

**Files:**
- Modify: `prisma/schema.prisma:347-379`

- [ ] **Step 1: Add JSON fields to ReviewCycle model**

In `prisma/schema.prisma`, find the `ReviewCycle` model (line 347) and add 4 JSON fields after `status`:

```prisma
model ReviewCycle {
  id              String            @id @default(uuid())
  name            String
  startDate       DateTime
  endDate         DateTime
  status          ReviewCycleStatus @default(DRAFT)
  template        Json?
  selfTemplate    Json?
  managerTemplate Json?
  peerTemplate    Json?
  createdAt       DateTime          @default(now())

  reviews         Review[]
}
```

- [ ] **Step 2: Add responses JSON to Review model**

In the `Review` model (line 358), add `responses` field after `goals`:

```prisma
model Review {
  id           String       @id @default(uuid())
  cycleId      String
  employeeId   String
  reviewerId   String
  type         ReviewType
  rating       Int?
  strengths    String?
  improvements String?
  goals        String?
  responses    Json?
  status       ReviewStatus @default(PENDING)
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt

  cycle        ReviewCycle  @relation(fields: [cycleId], references: [id], onDelete: Cascade)
  employee     Employee     @relation("ReviewEmployee", fields: [employeeId], references: [id], onDelete: Cascade)
  reviewer     Employee     @relation("ReviewReviewer", fields: [reviewerId], references: [id], onDelete: Cascade)

  @@index([cycleId])
  @@index([employeeId])
  @@index([reviewerId])
}
```

- [ ] **Step 3: Generate Prisma client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client" success message.

Note: The actual migration will run on Railway deploy via `prisma migrate deploy`. For local dev, `prisma generate` is enough since the app connects to Railway DB.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(reviews): add template and responses JSON fields to schema"
```

---

### Task 2: Template Field Types

**Files:**
- Create: `src/lib/review-templates.ts`

- [ ] **Step 1: Create the types and validation file**

Create `src/lib/review-templates.ts` with TypeScript types and a validation function for template fields:

```typescript
export const FIELD_TYPES = [
  "star_rating",
  "numeric_scale",
  "text_area",
  "short_text",
  "multiple_choice",
  "checkbox_list",
  "yes_no",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export type TemplateField = {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  options: {
    min?: number;
    max?: number;
    choices?: string[];
  };
};

/** Human-readable labels and Material Symbols icon names for each field type */
export const FIELD_TYPE_META: Record<
  FieldType,
  { label: string; icon: string; description: string }
> = {
  star_rating: { label: "Star Rating", icon: "star", description: "1–5 stars" },
  numeric_scale: { label: "Numeric Scale", icon: "linear_scale", description: "Custom range" },
  text_area: { label: "Text Area", icon: "notes", description: "Long text" },
  short_text: { label: "Short Text", icon: "short_text", description: "Single line" },
  multiple_choice: { label: "Multiple Choice", icon: "radio_button_checked", description: "Pick one" },
  checkbox_list: { label: "Checkbox List", icon: "checklist", description: "Pick many" },
  yes_no: { label: "Yes / No", icon: "toggle_on", description: "Toggle" },
};

/** Default template matching the current hardcoded review form */
export function getDefaultTemplate(): TemplateField[] {
  return [
    { id: crypto.randomUUID(), type: "star_rating", label: "Overall Rating", required: true, options: {} },
    { id: crypto.randomUUID(), type: "text_area", label: "Strengths", required: false, options: {} },
    { id: crypto.randomUUID(), type: "text_area", label: "Areas for Improvement", required: false, options: {} },
    { id: crypto.randomUUID(), type: "text_area", label: "Goals", required: false, options: {} },
  ];
}

/** Validate a single response value against its field definition */
export function validateFieldResponse(
  field: TemplateField,
  value: unknown
): string | null {
  if (field.required && (value === undefined || value === null || value === "")) {
    return `${field.label} is required`;
  }
  if (value === undefined || value === null || value === "") return null;

  switch (field.type) {
    case "star_rating": {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1 || n > 5) return `${field.label} must be 1–5`;
      break;
    }
    case "numeric_scale": {
      const n = Number(value);
      const min = field.options.min ?? 1;
      const max = field.options.max ?? 10;
      if (!Number.isInteger(n) || n < min || n > max) return `${field.label} must be ${min}–${max}`;
      break;
    }
    case "text_area": {
      if (typeof value !== "string") return `${field.label} must be text`;
      if (value.length > 5000) return `${field.label} must be under 5000 characters`;
      break;
    }
    case "short_text": {
      if (typeof value !== "string") return `${field.label} must be text`;
      if (value.length > 500) return `${field.label} must be under 500 characters`;
      break;
    }
    case "multiple_choice": {
      if (typeof value !== "string") return `${field.label}: invalid selection`;
      if (!field.options.choices?.includes(value)) return `${field.label}: invalid choice`;
      break;
    }
    case "checkbox_list": {
      if (!Array.isArray(value)) return `${field.label}: invalid selection`;
      const choices = field.options.choices || [];
      for (const v of value) {
        if (!choices.includes(v)) return `${field.label}: invalid choice "${v}"`;
      }
      break;
    }
    case "yes_no": {
      if (typeof value !== "boolean") return `${field.label} must be yes or no`;
      break;
    }
  }
  return null;
}

/** Validate all responses against a template. Returns array of error strings (empty = valid). */
export function validateResponses(
  template: TemplateField[],
  responses: Record<string, unknown>
): string[] {
  const errors: string[] = [];
  for (const field of template) {
    const err = validateFieldResponse(field, responses[field.id]);
    if (err) errors.push(err);
  }
  return errors;
}

/** Resolve which template to use for a given review type */
export function resolveTemplate(
  cycle: {
    template?: TemplateField[] | null;
    selfTemplate?: TemplateField[] | null;
    managerTemplate?: TemplateField[] | null;
    peerTemplate?: TemplateField[] | null;
  },
  reviewType: "SELF" | "MANAGER" | "PEER"
): TemplateField[] | null {
  const overrideKey = `${reviewType.toLowerCase()}Template` as keyof typeof cycle;
  const override = cycle[overrideKey] as TemplateField[] | null | undefined;
  if (override && override.length > 0) return override;
  if (cycle.template && (cycle.template as TemplateField[]).length > 0)
    return cycle.template as TemplateField[];
  return null; // fallback to hardcoded form
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/review-templates.ts
git commit -m "feat(reviews): add template field types, validation, and resolver"
```

---

### Task 3: Template Builder Component

**Files:**
- Create: `src/components/reviews/template-builder.tsx`

This is a client component that renders the field list with add/reorder/edit/delete. It takes a `value` (array of TemplateField) and an `onChange` callback — controlled component pattern.

- [ ] **Step 1: Create the template builder**

Create `src/components/reviews/template-builder.tsx`:

```tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import type { TemplateField, FieldType } from "@/lib/review-templates";
import { FIELD_TYPES, FIELD_TYPE_META } from "@/lib/review-templates";

interface TemplateBuilderProps {
  value: TemplateField[];
  onChange: (fields: TemplateField[]) => void;
}

export function TemplateBuilder({ value, onChange }: TemplateBuilderProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

  function addField(type: FieldType) {
    const newField: TemplateField = {
      id: crypto.randomUUID(),
      type,
      label: FIELD_TYPE_META[type].label,
      required: false,
      options:
        type === "numeric_scale"
          ? { min: 1, max: 10 }
          : type === "multiple_choice" || type === "checkbox_list"
            ? { choices: ["Option 1", "Option 2"] }
            : {},
    };
    onChange([...value, newField]);
    setEditingId(newField.id);
    setShowAddMenu(false);
  }

  function updateField(id: string, updates: Partial<TemplateField>) {
    onChange(value.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  }

  function removeField(id: string) {
    onChange(value.filter((f) => f.id !== id));
    if (editingId === id) setEditingId(null);
  }

  function moveField(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= value.length) return;
    const copy = [...value];
    [copy[index], copy[newIndex]] = [copy[newIndex], copy[index]];
    onChange(copy);
  }

  const inputClass = cn(
    "w-full px-3 py-2 rounded-lg text-sm",
    "bg-[var(--color-background)] border border-[var(--color-border)]",
    "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
  );

  return (
    <div className="space-y-2">
      {value.map((field, idx) => {
        const meta = FIELD_TYPE_META[field.type];
        const isEditing = editingId === field.id;

        return (
          <div
            key={field.id}
            className={cn(
              "rounded-xl border p-3 transition-colors",
              isEditing
                ? "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/5"
                : "border-[var(--color-border)] bg-[var(--color-background)]"
            )}
          >
            {/* Field header row */}
            <div className="flex items-center gap-2">
              <Icon name={meta.icon} size={16} className="text-[var(--color-accent)] shrink-0" />
              <span className="text-sm font-medium text-[var(--color-text-primary)] flex-1 truncate">
                {field.label}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] shrink-0">
                {meta.description}
              </span>
              {field.required && (
                <span className="text-xs font-medium text-red-400 shrink-0">Required</span>
              )}

              {/* Reorder buttons */}
              <button
                onClick={() => moveField(idx, -1)}
                disabled={idx === 0}
                className="p-0.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-30"
              >
                <Icon name="arrow_upward" size={14} />
              </button>
              <button
                onClick={() => moveField(idx, 1)}
                disabled={idx === value.length - 1}
                className="p-0.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-30"
              >
                <Icon name="arrow_downward" size={14} />
              </button>

              {/* Edit / delete */}
              <button
                onClick={() => setEditingId(isEditing ? null : field.id)}
                className="p-0.5 rounded text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
              >
                <Icon name={isEditing ? "check" : "edit"} size={14} />
              </button>
              <button
                onClick={() => removeField(field.id)}
                className="p-0.5 rounded text-[var(--color-text-muted)] hover:text-red-400"
              >
                <Icon name="delete" size={14} />
              </button>
            </div>

            {/* Inline edit form */}
            {isEditing && (
              <div className="mt-3 space-y-3 border-t border-[var(--color-border)]/50 pt-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
                    Label
                  </label>
                  <input
                    value={field.label}
                    onChange={(e) => updateField(field.id, { label: e.target.value.slice(0, 200) })}
                    className={inputClass}
                    maxLength={200}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => updateField(field.id, { required: e.target.checked })}
                    className="rounded"
                  />
                  Required
                </label>

                {/* numeric_scale options */}
                {field.type === "numeric_scale" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
                        Min
                      </label>
                      <input
                        type="number"
                        value={field.options.min ?? 1}
                        onChange={(e) =>
                          updateField(field.id, {
                            options: { ...field.options, min: Math.max(0, Math.min(99, parseInt(e.target.value) || 0)) },
                          })
                        }
                        className={inputClass}
                        min={0}
                        max={99}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
                        Max
                      </label>
                      <input
                        type="number"
                        value={field.options.max ?? 10}
                        onChange={(e) =>
                          updateField(field.id, {
                            options: { ...field.options, max: Math.max(1, Math.min(100, parseInt(e.target.value) || 1)) },
                          })
                        }
                        className={inputClass}
                        min={1}
                        max={100}
                      />
                    </div>
                  </div>
                )}

                {/* multiple_choice / checkbox_list options */}
                {(field.type === "multiple_choice" || field.type === "checkbox_list") && (
                  <div>
                    <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
                      Choices
                    </label>
                    <div className="space-y-1.5">
                      {(field.options.choices || []).map((choice, ci) => (
                        <div key={ci} className="flex items-center gap-2">
                          <input
                            value={choice}
                            onChange={(e) => {
                              const newChoices = [...(field.options.choices || [])];
                              newChoices[ci] = e.target.value.slice(0, 200);
                              updateField(field.id, { options: { ...field.options, choices: newChoices } });
                            }}
                            className={cn(inputClass, "flex-1")}
                            maxLength={200}
                            placeholder={`Choice ${ci + 1}`}
                          />
                          <button
                            onClick={() => {
                              const newChoices = (field.options.choices || []).filter((_, i) => i !== ci);
                              updateField(field.id, { options: { ...field.options, choices: newChoices } });
                            }}
                            disabled={(field.options.choices || []).length <= 2}
                            className="p-1 text-[var(--color-text-muted)] hover:text-red-400 disabled:opacity-30"
                          >
                            <Icon name="close" size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    {(field.options.choices || []).length < 20 && (
                      <button
                        onClick={() => {
                          const newChoices = [...(field.options.choices || []), `Option ${(field.options.choices || []).length + 1}`];
                          updateField(field.id, { options: { ...field.options, choices: newChoices } });
                        }}
                        className="mt-1.5 flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
                      >
                        <Icon name="add" size={12} /> Add choice
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Add Field button */}
      <div className="relative">
        <button
          onClick={() => setShowAddMenu(!showAddMenu)}
          className={cn(
            "w-full py-2.5 rounded-xl border-2 border-dashed text-sm font-medium transition-colors",
            "border-[var(--color-border)] text-[var(--color-text-muted)]",
            "hover:border-[var(--color-accent)]/40 hover:text-[var(--color-accent)]"
          )}
        >
          <Icon name="add" size={16} className="inline mr-1 align-text-bottom" />
          Add Field
        </button>
        {showAddMenu && (
          <div className="absolute left-0 right-0 top-full mt-1 z-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-container-lowest)] shadow-lg p-1">
            {FIELD_TYPES.map((type) => {
              const m = FIELD_TYPE_META[type];
              return (
                <button
                  key={type}
                  onClick={() => addField(type)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left hover:bg-[var(--color-surface-hover)] transition-colors"
                >
                  <Icon name={m.icon} size={16} className="text-[var(--color-accent)]" />
                  <span className="font-medium text-[var(--color-text-primary)]">{m.label}</span>
                  <span className="text-xs text-[var(--color-text-muted)] ml-auto">{m.description}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx next build --no-lint 2>&1 | head -30`

Expected: No TypeScript errors related to `template-builder.tsx`. Build may have unrelated warnings — that's fine.

- [ ] **Step 3: Commit**

```bash
git add src/components/reviews/template-builder.tsx
git commit -m "feat(reviews): add template builder component with field CRUD and reordering"
```

---

### Task 4: Integrate Template Builder into Create Cycle Dialog

**Files:**
- Modify: `src/components/reviews/create-cycle-dialog.tsx`
- Modify: `src/lib/actions/reviews.ts:31-53`

- [ ] **Step 1: Update createReviewCycle action to accept template data**

In `src/lib/actions/reviews.ts`, modify the `createReviewCycle` function signature and body:

```typescript
export async function createReviewCycle(data: {
  name: string;
  startDate: string;
  endDate: string;
  template?: unknown;
  selfTemplate?: unknown;
  managerTemplate?: unknown;
  peerTemplate?: unknown;
}) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR") {
    throw new Error("Not authorized");
  }

  // Only SUPER_ADMIN and ADMIN can attach templates
  const canSetTemplate = role === "SUPER_ADMIN" || role === "ADMIN";

  const cycle = await db.reviewCycle.create({
    data: {
      name: data.name,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      status: "DRAFT",
      ...(canSetTemplate && data.template ? { template: data.template } : {}),
      ...(canSetTemplate && data.selfTemplate ? { selfTemplate: data.selfTemplate } : {}),
      ...(canSetTemplate && data.managerTemplate ? { managerTemplate: data.managerTemplate } : {}),
      ...(canSetTemplate && data.peerTemplate ? { peerTemplate: data.peerTemplate } : {}),
    },
  });
  revalidatePath("/reviews");
  return cycle;
}
```

- [ ] **Step 2: Add template builder to the Create Cycle dialog**

In `src/components/reviews/create-cycle-dialog.tsx`:

Add imports at the top:

```typescript
import { TemplateBuilder } from "@/components/reviews/template-builder";
import { getDefaultTemplate } from "@/lib/review-templates";
import type { TemplateField } from "@/lib/review-templates";
```

Add state for template fields inside the component (after existing `useState` calls):

```typescript
const [template, setTemplate] = useState<TemplateField[]>(getDefaultTemplate());
const [showTypeOverrides, setShowTypeOverrides] = useState(false);
const [selfTemplate, setSelfTemplate] = useState<TemplateField[]>([]);
const [managerTemplate, setManagerTemplate] = useState<TemplateField[]>([]);
const [peerTemplate, setPeerTemplate] = useState<TemplateField[]>([]);
```

In `handleCreate`, pass template data to the action:

```typescript
const cycle = await createReviewCycle({
  ...form,
  template: template.length > 0 ? template : undefined,
  selfTemplate: selfTemplate.length > 0 ? selfTemplate : undefined,
  managerTemplate: managerTemplate.length > 0 ? managerTemplate : undefined,
  peerTemplate: peerTemplate.length > 0 ? peerTemplate : undefined,
});
```

Also reset template state after successful creation:

```typescript
setTemplate(getDefaultTemplate());
setShowTypeOverrides(false);
setSelfTemplate([]);
setManagerTemplate([]);
setPeerTemplate([]);
```

In the JSX, add the template builder section **between the date inputs and the department selection section**. Insert right before the `{/* Department Selection */}` comment:

```tsx
{/* Review Form Template */}
<div>
  <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-2">
    <Icon name="dynamic_form" size={12} className="inline mr-1" />
    Review Form Fields
  </label>
  <TemplateBuilder value={template} onChange={setTemplate} />

  {/* Per-type overrides */}
  <button
    onClick={() => setShowTypeOverrides(!showTypeOverrides)}
    className="mt-3 flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
  >
    <Icon name={showTypeOverrides ? "expand_less" : "expand_more"} size={14} />
    Customize by review type
  </button>
  {showTypeOverrides && (
    <div className="mt-3 space-y-4 border-t border-[var(--color-border)]/50 pt-3">
      {([
        { label: "Self Review", value: selfTemplate, onChange: setSelfTemplate },
        { label: "Manager Review", value: managerTemplate, onChange: setManagerTemplate },
        { label: "Peer Review", value: peerTemplate, onChange: setPeerTemplate },
      ] as const).map(({ label, value: tpl, onChange: setTpl }) => (
        <div key={label}>
          <p className="text-xs font-medium text-[var(--color-text-primary)] mb-1.5">
            {label} {tpl.length === 0 && <span className="text-[var(--color-text-muted)] font-normal">(uses default)</span>}
          </p>
          <TemplateBuilder value={tpl} onChange={setTpl} />
        </div>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 3: Verify build**

Run: `npx next build --no-lint 2>&1 | tail -10`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/reviews/create-cycle-dialog.tsx src/lib/actions/reviews.ts
git commit -m "feat(reviews): integrate template builder into create cycle dialog"
```

---

## Chunk 2: Dynamic Submit + View + Server Validation

### Task 5: Dynamic Field Renderers

**Files:**
- Create: `src/components/reviews/review-field-renderer.tsx`

Create a shared component that renders a single template field in either "edit" or "view" mode. This keeps the submit and view dialogs DRY.

- [ ] **Step 1: Create the field renderer component**

Create `src/components/reviews/review-field-renderer.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import type { TemplateField } from "@/lib/review-templates";

const inputClass = cn(
  "w-full px-3 py-2 rounded-lg text-sm",
  "bg-[var(--color-background)] border border-[var(--color-border)]",
  "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
  "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
);

interface FieldRendererProps {
  field: TemplateField;
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly?: boolean;
}

export function ReviewFieldRenderer({ field, value, onChange, readOnly = false }: FieldRendererProps) {
  if (readOnly) return <ReadOnlyField field={field} value={value} />;
  return <EditableField field={field} value={value} onChange={onChange} />;
}

function EditableField({
  field,
  value,
  onChange,
}: {
  field: TemplateField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  switch (field.type) {
    case "star_rating": {
      const current = (value as number) || 0;
      return (
        <div>
          <FieldLabel field={field} />
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                className="p-0.5 transition-transform hover:scale-110"
              >
                <Icon
                  name="star"
                  fill={n <= current}
                  className={cn("h-7 w-7 transition-colors", n <= current ? "text-amber-400" : "text-[var(--color-border)]")}
                />
              </button>
            ))}
            {current > 0 && <span className="ml-2 text-sm text-[var(--color-text-muted)] self-center">{current}/5</span>}
          </div>
        </div>
      );
    }

    case "numeric_scale": {
      const min = field.options.min ?? 1;
      const max = field.options.max ?? 10;
      return (
        <div>
          <FieldLabel field={field} />
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={min}
              max={max}
              value={(value as number) || min}
              onChange={(e) => onChange(parseInt(e.target.value))}
              className="flex-1 accent-[var(--color-accent)]"
            />
            <span className="text-sm font-medium text-[var(--color-text-primary)] min-w-[2rem] text-center">
              {(value as number) ?? min}
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">/ {max}</span>
          </div>
        </div>
      );
    }

    case "text_area":
      return (
        <div>
          <FieldLabel field={field} />
          <textarea
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value.slice(0, 5000))}
            rows={3}
            className={inputClass}
            maxLength={5000}
          />
        </div>
      );

    case "short_text":
      return (
        <div>
          <FieldLabel field={field} />
          <input
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value.slice(0, 500))}
            className={inputClass}
            maxLength={500}
          />
        </div>
      );

    case "multiple_choice": {
      const choices = field.options.choices || [];
      return (
        <div>
          <FieldLabel field={field} />
          <div className="space-y-1.5">
            {choices.map((choice) => (
              <label key={choice} className="flex items-center gap-2 text-sm text-[var(--color-text-primary)] cursor-pointer">
                <input
                  type="radio"
                  name={field.id}
                  checked={value === choice}
                  onChange={() => onChange(choice)}
                  className="accent-[var(--color-accent)]"
                />
                {choice}
              </label>
            ))}
          </div>
        </div>
      );
    }

    case "checkbox_list": {
      const choices = field.options.choices || [];
      const selected = (value as string[]) || [];
      return (
        <div>
          <FieldLabel field={field} />
          <div className="space-y-1.5">
            {choices.map((choice) => (
              <label key={choice} className="flex items-center gap-2 text-sm text-[var(--color-text-primary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(choice)}
                  onChange={(e) => {
                    if (e.target.checked) onChange([...selected, choice]);
                    else onChange(selected.filter((s) => s !== choice));
                  }}
                  className="rounded accent-[var(--color-accent)]"
                />
                {choice}
              </label>
            ))}
          </div>
        </div>
      );
    }

    case "yes_no":
      return (
        <div>
          <FieldLabel field={field} />
          <div className="flex gap-3">
            {[
              { label: "Yes", val: true },
              { label: "No", val: false },
            ].map(({ label, val }) => (
              <button
                key={label}
                type="button"
                onClick={() => onChange(val)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                  value === val
                    ? "bg-[var(--color-accent)] text-white"
                    : "bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      );
  }
}

function ReadOnlyField({ field, value }: { field: TemplateField; value: unknown }) {
  switch (field.type) {
    case "star_rating": {
      const n = (value as number) || 0;
      return (
        <div>
          <FieldLabel field={field} readOnly />
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <Icon key={i} name="star" fill={i <= n} size={20} className={i <= n ? "text-amber-400" : "text-[var(--color-border)]"} />
            ))}
            <span className="ml-2 text-sm text-[var(--color-text-muted)]">{n}/5</span>
          </div>
        </div>
      );
    }

    case "numeric_scale": {
      const max = field.options.max ?? 10;
      return (
        <div>
          <FieldLabel field={field} readOnly />
          <p className="text-sm text-[var(--color-text-primary)]">
            <span className="font-semibold">{value as number}</span>
            <span className="text-[var(--color-text-muted)]"> / {max}</span>
          </p>
        </div>
      );
    }

    case "text_area":
    case "short_text":
      return value ? (
        <div>
          <FieldLabel field={field} readOnly />
          <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-line">{value as string}</p>
        </div>
      ) : null;

    case "multiple_choice":
      return value ? (
        <div>
          <FieldLabel field={field} readOnly />
          <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
            {value as string}
          </span>
        </div>
      ) : null;

    case "checkbox_list": {
      const selected = (value as string[]) || [];
      return selected.length > 0 ? (
        <div>
          <FieldLabel field={field} readOnly />
          <div className="flex flex-wrap gap-1">
            {selected.map((s) => (
              <span key={s} className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                {s}
              </span>
            ))}
          </div>
        </div>
      ) : null;
    }

    case "yes_no":
      return value !== undefined && value !== null ? (
        <div>
          <FieldLabel field={field} readOnly />
          <span
            className={cn(
              "inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium",
              value ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
            )}
          >
            {value ? "Yes" : "No"}
          </span>
        </div>
      ) : null;
  }
}

function FieldLabel({ field, readOnly = false }: { field: TemplateField; readOnly?: boolean }) {
  return (
    <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1.5">
      {field.label}
      {field.required && !readOnly && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/reviews/review-field-renderer.tsx
git commit -m "feat(reviews): add dynamic field renderer for edit and read-only modes"
```

---

### Task 6: Update Submit Review Dialog for Dynamic Templates

**Files:**
- Modify: `src/components/reviews/submit-review-dialog.tsx`
- Modify: `src/lib/actions/reviews.ts:111-146`

- [ ] **Step 1: Update the submitReview server action**

In `src/lib/actions/reviews.ts`, update the `submitReview` function to accept optional `responses` and validate them:

```typescript
export async function submitReview(
  reviewId: string,
  data: {
    rating?: number;
    strengths?: string;
    improvements?: string;
    goals?: string;
    responses?: Record<string, unknown>;
  }
) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const employeeId = session.user?.employeeId;

  const review = await db.review.findUnique({
    where: { id: reviewId },
    include: { cycle: true },
  });
  if (!review) throw new Error("Review not found");

  // Only the assigned reviewer can submit, or admin/hr
  const role = session.user?.role;
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN" || role === "HR";
  if (review.reviewerId !== employeeId && !isAdmin) {
    throw new Error("Not authorized to submit this review");
  }

  // If responses provided, validate against template
  if (data.responses) {
    const { resolveTemplate, validateResponses } = await import("@/lib/review-templates");
    const template = resolveTemplate(
      review.cycle as any,
      review.type as "SELF" | "MANAGER" | "PEER"
    );
    if (template) {
      const errors = validateResponses(template, data.responses);
      if (errors.length > 0) {
        throw new Error(errors.join(", "));
      }
    }
  }

  const updated = await db.review.update({
    where: { id: reviewId },
    data: {
      ...(data.rating !== undefined ? { rating: data.rating } : {}),
      ...(data.strengths !== undefined ? { strengths: data.strengths } : {}),
      ...(data.improvements !== undefined ? { improvements: data.improvements } : {}),
      ...(data.goals !== undefined ? { goals: data.goals } : {}),
      ...(data.responses ? { responses: data.responses } : {}),
      status: "SUBMITTED",
    },
  });
  revalidatePath("/reviews");
  return updated;
}
```

- [ ] **Step 2: Update the SubmitReviewDialog component**

Rewrite `src/components/reviews/submit-review-dialog.tsx` to support both template-based and legacy forms:

```tsx
"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { submitReview } from "@/lib/actions/reviews";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { ReviewFieldRenderer } from "@/components/reviews/review-field-renderer";
import type { TemplateField } from "@/lib/review-templates";

type ReviewData = {
  id: string;
  employeeName: string;
  type: string;
  template?: TemplateField[] | null;
};

export function SubmitReviewDialog({ review }: { review: ReviewData }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  // Legacy form state
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [strengths, setStrengths] = useState("");
  const [improvements, setImprovements] = useState("");
  const [goals, setGoals] = useState("");

  // Template-based state
  const [responses, setResponses] = useState<Record<string, unknown>>({});

  const hasTemplate = review.template && review.template.length > 0;

  function updateResponse(fieldId: string, value: unknown) {
    setResponses((prev) => ({ ...prev, [fieldId]: value }));
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      if (hasTemplate) {
        await submitReview(review.id, { responses });
      } else {
        if (rating === 0) return;
        await submitReview(review.id, { rating, strengths, improvements, goals });
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = hasTemplate
    ? review.template!.filter((f) => f.required).every((f) => {
        const val = responses[f.id];
        return val !== undefined && val !== null && val !== "" && !(Array.isArray(val) && val.length === 0);
      })
    : rating > 0;

  const inputClass = cn(
    "w-full px-3 py-2 rounded-lg text-sm",
    "bg-[var(--color-background)] border border-[var(--color-border)]",
    "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
  );

  const activeRating = hoverRating || rating;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "px-3 py-1.5 rounded-lg text-xs font-medium",
          "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors"
        )}
      >
        Submit Review
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title={`${review.type} Review for ${review.employeeName}`}>
        <div className="space-y-4">
          {hasTemplate ? (
            /* Dynamic template form */
            review.template!.map((field) => (
              <ReviewFieldRenderer
                key={field.id}
                field={field}
                value={responses[field.id]}
                onChange={(val) => updateResponse(field.id, val)}
              />
            ))
          ) : (
            /* Legacy hardcoded form */
            <>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-2">Rating</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onMouseEnter={() => setHoverRating(n)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(n)}
                      className="p-0.5 transition-transform hover:scale-110"
                    >
                      <Icon name="star" className={cn(
                        "h-7 w-7 transition-colors",
                        n <= activeRating ? "text-amber-400 fill-amber-400" : "text-[var(--color-border)]"
                      )} />
                    </button>
                  ))}
                  {rating > 0 && <span className="ml-2 text-sm text-[var(--color-text-muted)] self-center">{rating}/5</span>}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Strengths</label>
                <textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} placeholder="What does this person do well?" rows={3} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Areas for Improvement</label>
                <textarea value={improvements} onChange={(e) => setImprovements(e.target.value)} placeholder="Where can they grow?" rows={3} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Goals for Next Period</label>
                <textarea value={goals} onChange={(e) => setGoals(e.target.value)} placeholder="What should they focus on?" rows={3} className={inputClass} />
              </div>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={saving || !canSubmit}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium", "bg-[var(--color-accent)] text-white", "hover:bg-[var(--color-accent-hover)]", "disabled:opacity-50")}
          >
            {saving ? "Submitting..." : "Submit Review"}
          </button>
        </div>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/reviews/submit-review-dialog.tsx src/lib/actions/reviews.ts
git commit -m "feat(reviews): dynamic template-based submit review with server validation"
```

---

### Task 7: Update View Review Dialog for Dynamic Templates

**Files:**
- Modify: `src/components/reviews/view-review-dialog.tsx`

- [ ] **Step 1: Update the ViewReviewDialog to support templates**

Rewrite `src/components/reviews/view-review-dialog.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { ReviewFieldRenderer } from "@/components/reviews/review-field-renderer";
import type { TemplateField } from "@/lib/review-templates";

type ReviewInfo = {
  employeeName: string;
  reviewerName: string;
  type: string;
  rating: number | null;
  strengths: string | null;
  improvements: string | null;
  goals: string | null;
  template?: TemplateField[] | null;
  responses?: Record<string, unknown> | null;
};

export function ViewReviewDialog({ review }: { review: ReviewInfo }) {
  const [open, setOpen] = useState(false);

  const hasTemplate = review.template && review.template.length > 0 && review.responses;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
          "text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors"
        )}
      >
        <Icon name="visibility" size={12} />View
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title={`${review.type} Review — ${review.employeeName}`}>
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1">Reviewed by</p>
            <p className="text-sm text-[var(--color-text-primary)]">{review.reviewerName}</p>
          </div>

          {hasTemplate ? (
            /* Dynamic template view */
            review.template!.map((field) => (
              <ReviewFieldRenderer
                key={field.id}
                field={field}
                value={review.responses![field.id]}
                onChange={() => {}}
                readOnly
              />
            ))
          ) : (
            /* Legacy hardcoded view */
            <>
              <div>
                <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1">Rating</p>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Icon key={n} name="star" fill={n <= (review.rating || 0)} className={cn("h-5 w-5", n <= (review.rating || 0) ? "text-amber-400" : "text-[var(--color-border)]")} />
                  ))}
                  <span className="ml-2 text-sm text-[var(--color-text-muted)]">{review.rating}/5</span>
                </div>
              </div>
              {review.strengths && (
                <div>
                  <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1">Strengths</p>
                  <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-line">{review.strengths}</p>
                </div>
              )}
              {review.improvements && (
                <div>
                  <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1">Areas for Improvement</p>
                  <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-line">{review.improvements}</p>
                </div>
              )}
              {review.goals && (
                <div>
                  <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1">Goals</p>
                  <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-line">{review.goals}</p>
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex justify-end pt-4">
          <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]">Close</button>
        </div>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/reviews/view-review-dialog.tsx
git commit -m "feat(reviews): dynamic template-based view review dialog"
```

---

## Chunk 3: Page Integration + Stats

### Task 8: Wire Template Data Through the Reviews Page

**Files:**
- Modify: `src/app/(dashboard)/reviews/page.tsx`

The reviews page needs to:
1. Include cycle template data in queries
2. Pass resolved templates to SubmitReviewDialog and ViewReviewDialog
3. Use `resolveTemplate` to pick the right template per review type

- [ ] **Step 1: Update the Prisma query to include template fields**

In `src/app/(dashboard)/reviews/page.tsx`, the `db.reviewCycle.findMany` call currently includes reviews. The cycle already returns all scalar fields by default with Prisma, so `template`, `selfTemplate`, `managerTemplate`, `peerTemplate` will be included automatically once the schema is migrated. Similarly, `responses` on Review is a scalar field and will be included by default.

No query changes needed — Prisma includes all scalar fields by default.

- [ ] **Step 2: Update SubmitReviewDialog props throughout the page**

Everywhere `SubmitReviewDialog` is rendered (there are 3 places in the file), add the `template` prop. The template should be resolved based on the review type and the cycle.

Import at the top of the file:

```typescript
import { resolveTemplate } from "@/lib/review-templates";
import type { TemplateField } from "@/lib/review-templates";
```

Then update each `SubmitReviewDialog` usage. There are 3 instances:

**Instance 1** — "Your Pending Reviews" section (around line 143). The `review` here has `review.type` and we need the cycle. Since `myPendingReviews` is filtered from `allReviews` which comes from `cycles`, we need to also track the cycle for each pending review.

Change the `myPendingReviews` computation to also include cycle data:

```typescript
const myPendingReviews = currentEmployeeId
  ? cycles
      .filter((c) => c.status === "ACTIVE")
      .flatMap((c) =>
        c.reviews
          .filter((r) => r.reviewerId === currentEmployeeId && r.status === "PENDING")
          .map((r) => ({ ...r, cycle: c }))
      )
  : [];
```

Then update the SubmitReviewDialog prop in the "Your Pending Reviews" JSX:

```tsx
<SubmitReviewDialog
  review={{
    id: review.id,
    employeeName: `${review.employee.firstName} ${review.employee.lastName}`,
    type: review.type,
    template: resolveTemplate(review.cycle as any, review.type as "SELF" | "MANAGER" | "PEER") as TemplateField[] | null,
  }}
/>
```

**Instance 2** — Non-admin simple list view (around line 372). The `review` here is from `cycle.reviews` and we have `cycle` in scope:

```tsx
<SubmitReviewDialog
  review={{
    id: review.id,
    employeeName: `${review.employee.firstName} ${review.employee.lastName}`,
    type: review.type,
    template: resolveTemplate(cycle as any, review.type as "SELF" | "MANAGER" | "PEER") as TemplateField[] | null,
  }}
/>
```

**Instance 3** — Admin ReviewPill (around line 441). The `ReviewPill` component needs to accept and pass cycle data. Update the `ReviewPill` component to accept a `cycle` prop.

Add `cycle: any` to the ReviewPill props type and pass it through:

```tsx
// In ReviewPill component signature, add cycle prop:
function ReviewPill({
  review,
  type,
  currentEmployeeId,
  isAdmin,
  cycleActive,
  cycle,
}: {
  review: { ... };
  type: string;
  currentEmployeeId?: string | null;
  isAdmin: boolean;
  cycleActive: boolean;
  cycle: any;
}) {
```

Then inside ReviewPill, update the SubmitReviewDialog:

```tsx
<SubmitReviewDialog
  review={{
    id: review.id,
    employeeName: `${review.employee.firstName} ${review.employee.lastName}`,
    type: review.type,
    template: resolveTemplate(cycle, review.type as "SELF" | "MANAGER" | "PEER") as TemplateField[] | null,
  }}
/>
```

And everywhere ReviewPill is rendered (3 places — selfR, mgrR, peerRs), add `cycle={cycle}`:

```tsx
<ReviewPill review={selfR} type="SELF" currentEmployeeId={currentEmployeeId} isAdmin={isAdmin} cycleActive={cycle.status === "ACTIVE"} cycle={cycle} />
```

- [ ] **Step 3: Update ViewReviewDialog props throughout the page**

Similarly, update all `ViewReviewDialog` usages to include template and responses.

**In the non-admin list view** (around line 374):

```tsx
<ViewReviewDialog review={{
  employeeName: `${review.employee.firstName} ${review.employee.lastName}`,
  reviewerName: `${review.reviewer.firstName} ${review.reviewer.lastName}`,
  type: review.type,
  rating: review.rating,
  strengths: review.strengths,
  improvements: review.improvements,
  goals: review.goals,
  template: resolveTemplate(cycle as any, review.type as "SELF" | "MANAGER" | "PEER") as TemplateField[] | null,
  responses: (review as any).responses,
}} />
```

**In the ReviewPill component** (around line 444):

```tsx
<ViewReviewDialog review={{
  employeeName: `${review.employee.firstName} ${review.employee.lastName}`,
  reviewerName: `${review.reviewer.firstName} ${review.reviewer.lastName}`,
  type: review.type,
  rating: review.rating,
  strengths: review.strengths,
  improvements: review.improvements,
  goals: review.goals,
  template: resolveTemplate(cycle, review.type as "SELF" | "MANAGER" | "PEER") as TemplateField[] | null,
  responses: (review as any).responses,
}} />
```

**In the employee completed pairs section** (around line 164-229): These render inline review content. For template-based reviews, the legacy fields (`strengths`, `improvements`, `goals`) won't be populated. Update this section to detect template-based reviews and show a "View Details" button instead of empty content.

For each review in the pair (selfReview, managerReview), after the star rating display, add a check:

```tsx
{/* For template-based reviews, show a View button instead of empty legacy fields */}
{(pair.selfReview as any)?.responses ? (
  <div className="mt-2">
    <ViewReviewDialog review={{
      employeeName: `${/* current employee name */}`,
      reviewerName: "You",
      type: "SELF",
      rating: pair.selfReview!.rating,
      strengths: pair.selfReview!.strengths,
      improvements: pair.selfReview!.improvements,
      goals: pair.selfReview!.goals,
      template: resolveTemplate(cycles.find(c => c.id === pair.cycleId) as any, "SELF") as TemplateField[] | null,
      responses: (pair.selfReview as any).responses,
    }} />
  </div>
) : (
  /* existing legacy inline display */
)}
```

Apply the same pattern for the manager review side. The exact integration depends on how deeply nested this is — the implementer should follow the same pattern as the non-admin list view, wrapping legacy inline content in an else-branch and showing ViewReviewDialog when `responses` exist.

- [ ] **Step 4: Verify build**

Run: `npx next build --no-lint 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/reviews/page.tsx
git commit -m "feat(reviews): wire template data through reviews page to submit/view dialogs"
```

---

### Task 9: Template-Aware Stats Aggregation

**Files:**
- Modify: `src/app/(dashboard)/reviews/page.tsx`

- [ ] **Step 1: Update the average rating calculation to handle template-based reviews**

In the reviews page, the current stats calculation (around line 82-88) uses the `rating` field directly. Update it to also consider template-based responses.

Note: `resolveTemplate` is already imported at the top of the file from Task 8. Use it directly (no dynamic import needed).

Replace the `avgRating` calculation:

```typescript
// Calculate average rating — check template responses first, fall back to legacy rating field
const allRatings: number[] = [];
for (const r of allReviews) {
  if (r.status !== "SUBMITTED") continue;
  // Check template responses for star_rating or numeric_scale
  const resp = (r as any).responses as Record<string, unknown> | null;
  const cycle = cycles.find((c) => c.id === r.cycleId);
  if (resp && cycle) {
    const tpl = resolveTemplate(cycle as any, r.type as "SELF" | "MANAGER" | "PEER");
    if (tpl) {
      const ratingField = tpl.find((f) => f.type === "star_rating" || f.type === "numeric_scale");
      if (ratingField && typeof resp[ratingField.id] === "number") {
        // Normalize to 5-point scale for display
        if (ratingField.type === "star_rating") {
          allRatings.push(resp[ratingField.id] as number);
        } else {
          const max = ratingField.options?.max ?? 10;
          allRatings.push(((resp[ratingField.id] as number) / max) * 5);
        }
        continue;
      }
    }
  }
  // Legacy fallback
  if (r.rating) allRatings.push(r.rating);
}
const avgRating = allRatings.length > 0
  ? (allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(1)
  : "—";
```

- [ ] **Step 2: Verify build**

Run: `npx next build --no-lint 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/reviews/page.tsx
git commit -m "feat(reviews): template-aware average rating stats"
```

---

### Task 10: Prisma Migration and Final Verification

**Files:**
- Modified in previous tasks (verification only)

- [ ] **Step 1: Create the Prisma migration**

Run: `npx prisma migrate dev --name add-review-templates --create-only`

This creates the migration SQL without running it. The migration will run on Railway via `prisma migrate deploy` in the build command.

- [ ] **Step 2: Full build verification**

Run: `npx next build --no-lint 2>&1 | tail -20`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Final commit**

```bash
git add prisma/
git commit -m "feat(reviews): add migration for review template JSON fields"
```
