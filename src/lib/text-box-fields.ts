// Two-way text boxes on e-signature documents.
//
// A text box ("freeText" placement) records who fills it in:
//   - "signer": the recipient types it while signing (the original behavior)
//   - "admin":  HR fills it in; the recipient sees it read-only
//   - "both":   HR can pre-fill it; the recipient can still edit it
// HR's value lives on the placement itself (`value`) inside
// SigningRequest.signaturePlacements, so no schema change is needed.
//
// Everything here is pure so the signing page, the HR dialogs and the server
// actions share one set of rules.

export type TextBoxFilledBy = "signer" | "admin" | "both";

export const TEXT_BOX_FILLED_BY_OPTIONS: { value: TextBoxFilledBy; label: string; description: string }[] = [
  { value: "signer", label: "Recipient", description: "The person signing types this in" },
  { value: "admin", label: "HR", description: "HR fills this in; the recipient sees it but can't change it" },
  { value: "both", label: "Both", description: "HR can pre-fill it and the recipient can edit it" },
];

export const TEXT_BOX_MAX_LENGTH = 500;

/** The text-box-related part of a stored placement. */
export type TextBoxPlacementLike = {
  kind: string;
  fieldId?: string;
  label?: string;
  filledBy?: TextBoxFilledBy | string;
  required?: boolean;
  value?: string;
};

export type TextBoxField = {
  fieldId: string;
  label: string;
  filledBy: TextBoxFilledBy;
  required: boolean;
  /** HR's value (admin / both fields), "" when not filled. */
  value: string;
};

/** Older placements have no filledBy — they were always typed by the recipient. */
export function normalizeFilledBy(filledBy: unknown): TextBoxFilledBy {
  return filledBy === "admin" || filledBy === "both" ? filledBy : "signer";
}

/** Older placements have no required flag — they were always required. */
export function isTextBoxRequired(p: { required?: boolean }): boolean {
  return p.required !== false;
}

export function adminCanFill(filledBy: TextBoxFilledBy): boolean {
  return filledBy === "admin" || filledBy === "both";
}

export function signerCanFill(filledBy: TextBoxFilledBy): boolean {
  return filledBy === "signer" || filledBy === "both";
}

function cleanValue(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, TEXT_BOX_MAX_LENGTH) : "";
}

/**
 * One entry per distinct text field (the same fieldId can be placed in several
 * spots). The first placement of a field decides its settings.
 */
export function getTextBoxFields(placements: readonly TextBoxPlacementLike[]): TextBoxField[] {
  const byId = new Map<string, TextBoxField>();
  for (const p of placements) {
    if (p.kind !== "freeText" || !p.fieldId || byId.has(p.fieldId)) continue;
    const filledBy = normalizeFilledBy(p.filledBy);
    byId.set(p.fieldId, {
      fieldId: p.fieldId,
      label: p.label?.trim() || "Text",
      filledBy,
      required: isTextBoxRequired(p),
      value: adminCanFill(filledBy) ? cleanValue(p.value) : "",
    });
  }
  return Array.from(byId.values());
}

export function hasAdminTextBoxes(placements: readonly TextBoxPlacementLike[]): boolean {
  return getTextBoxFields(placements).some((f) => adminCanFill(f.filledBy));
}

/** HR-only required boxes that HR has not filled yet — these block signing. */
export function missingAdminRequiredFields(placements: readonly TextBoxPlacementLike[]): TextBoxField[] {
  return getTextBoxFields(placements).filter((f) => f.filledBy === "admin" && f.required && !f.value);
}

/**
 * Writes HR's values onto the placements. Only admin / both boxes accept a
 * value; anything sent for a recipient-only box (or an unknown field) is
 * ignored. Fields missing from `values` keep their current value.
 */
export function applyAdminTextValues<T extends TextBoxPlacementLike>(
  placements: readonly T[],
  values: Record<string, unknown>
): T[] {
  return placements.map((p) => {
    if (p.kind !== "freeText" || !p.fieldId) return p;
    if (!adminCanFill(normalizeFilledBy(p.filledBy))) return p;
    if (!Object.prototype.hasOwnProperty.call(values, p.fieldId)) return p;
    const value = cleanValue(values[p.fieldId]);
    const next = { ...p };
    if (value) next.value = value;
    else delete next.value;
    return next;
  });
}

export type ResolvedTextValues =
  | { ok: true; values: Record<string, string> }
  // `values` is still filled on failure so a preview can show what was entered.
  | { ok: false; error: string; values: Record<string, string>; missingAdmin: string[]; missingSigner: string[] };

/**
 * Combines HR's stored values with what the recipient submitted, returning the
 * text to stamp per fieldId:
 *   - admin boxes always use HR's value (the recipient cannot override it)
 *   - both boxes use the recipient's value when sent, otherwise HR's value
 *   - signer boxes use the recipient's value
 * Fails when a required box ends up empty.
 */
export function resolveTextValuesForSigning(
  placements: readonly TextBoxPlacementLike[],
  signerValues: Record<string, unknown> | undefined
): ResolvedTextValues {
  const values: Record<string, string> = {};
  const missingAdmin: string[] = [];
  const missingSigner: string[] = [];
  const submitted = signerValues ?? {};

  for (const f of getTextBoxFields(placements)) {
    let value: string;
    if (f.filledBy === "admin") {
      value = f.value;
    } else if (f.filledBy === "both") {
      value = Object.prototype.hasOwnProperty.call(submitted, f.fieldId)
        ? cleanValue(submitted[f.fieldId])
        : f.value;
    } else {
      value = cleanValue(submitted[f.fieldId]);
    }
    if (value) values[f.fieldId] = value;
    else if (f.required) (f.filledBy === "admin" ? missingAdmin : missingSigner).push(f.label);
  }

  if (missingAdmin.length > 0) {
    return {
      ok: false,
      error: `HR still needs to complete ${missingAdmin.join(", ")} before this document can be signed.`,
      values,
      missingAdmin,
      missingSigner,
    };
  }
  if (missingSigner.length > 0) {
    return { ok: false, error: `Please fill in: ${missingSigner.join(", ")}`, values, missingAdmin, missingSigner };
  }
  return { ok: true, values };
}

/**
 * The standard PDF fonts only cover Latin-1. Characters outside it (emoji,
 * other scripts) would make pdf-lib throw and fail the whole signature, so
 * they are replaced; line breaks become spaces.
 */
export function toPdfSafeText(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\x20-\x7E\xA0-\xFF]/gu, "?");
}
