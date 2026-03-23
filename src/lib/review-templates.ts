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
