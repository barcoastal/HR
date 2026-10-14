import { describe, expect, it } from "vitest";
import {
  applyAdminTextValues,
  getTextBoxFields,
  hasAdminTextBoxes,
  missingAdminRequiredFields,
  normalizeFilledBy,
  resolveTextValuesForSigning,
  TEXT_BOX_MAX_LENGTH,
  toPdfSafeText,
  type TextBoxPlacementLike,
} from "@/lib/text-box-fields";

const box = (fieldId: string, extra: Partial<TextBoxPlacementLike> = {}): TextBoxPlacementLike => ({
  kind: "freeText",
  fieldId,
  label: fieldId.toUpperCase(),
  ...extra,
});

describe("text box defaults", () => {
  it("treats legacy boxes as recipient-filled and required", () => {
    const [f] = getTextBoxFields([{ kind: "freeText", fieldId: "a", label: "Phone" }]);
    expect(f).toEqual({ fieldId: "a", label: "Phone", filledBy: "signer", required: true, value: "" });
    expect(normalizeFilledBy(undefined)).toBe("signer");
    expect(normalizeFilledBy("nonsense")).toBe("signer");
  });

  it("dedupes by fieldId and skips non-text placements", () => {
    const fields = getTextBoxFields([
      { kind: "signature" },
      box("a"),
      box("a", { label: "dup" }),
      box("b", { filledBy: "admin" }),
    ]);
    expect(fields.map((f) => f.fieldId)).toEqual(["a", "b"]);
    expect(fields[0].label).toBe("A");
  });

  it("ignores a stored value on a recipient-only box", () => {
    const [f] = getTextBoxFields([box("a", { value: "sneaky" })]);
    expect(f.value).toBe("");
  });

  it("detects HR boxes", () => {
    expect(hasAdminTextBoxes([box("a")])).toBe(false);
    expect(hasAdminTextBoxes([box("a", { filledBy: "both" })])).toBe(true);
  });
});

describe("applyAdminTextValues", () => {
  const placements = [
    box("hr", { filledBy: "admin" }),
    box("shared", { filledBy: "both" }),
    box("cand"),
    { kind: "signature" },
  ];

  it("only writes admin and both boxes, trimmed", () => {
    const next = applyAdminTextValues(placements, { hr: "  Jane HR ", shared: "Prefill", cand: "nope", other: "x" });
    expect(next[0].value).toBe("Jane HR");
    expect(next[1].value).toBe("Prefill");
    expect(next[2].value).toBeUndefined();
    expect(next[3]).toBe(placements[3]);
  });

  it("keeps values that were not sent and clears blank ones", () => {
    const filled = applyAdminTextValues(placements, { hr: "A", shared: "B" });
    const next = applyAdminTextValues(filled, { hr: "   " });
    expect(next[0].value).toBeUndefined();
    expect(next[1].value).toBe("B");
  });

  it("caps value length", () => {
    const [p] = applyAdminTextValues([box("hr", { filledBy: "admin" })], { hr: "x".repeat(TEXT_BOX_MAX_LENGTH + 50) });
    expect(p.value).toHaveLength(TEXT_BOX_MAX_LENGTH);
  });

  it("applies to every spot of a repeated field", () => {
    const next = applyAdminTextValues([box("hr", { filledBy: "admin" }), box("hr", { filledBy: "admin" })], { hr: "V" });
    expect(next.map((p) => p.value)).toEqual(["V", "V"]);
  });
});

describe("missingAdminRequiredFields", () => {
  it("lists only unfilled required HR-only boxes", () => {
    const missing = missingAdminRequiredFields([
      box("hr1", { filledBy: "admin" }),
      box("hr2", { filledBy: "admin", value: "done" }),
      box("hr3", { filledBy: "admin", required: false }),
      box("shared", { filledBy: "both" }),
      box("cand"),
    ]);
    expect(missing.map((f) => f.fieldId)).toEqual(["hr1"]);
  });
});

describe("resolveTextValuesForSigning", () => {
  it("uses HR's value for HR-only boxes even when the recipient sends one", () => {
    const res = resolveTextValuesForSigning([box("hr", { filledBy: "admin", value: "Official" })], { hr: "Changed" });
    expect(res).toEqual({ ok: true, values: { hr: "Official" } });
  });

  it("lets the recipient edit a shared box, falling back to HR's prefill", () => {
    const placements = [box("shared", { filledBy: "both", value: "Prefill" })];
    expect(resolveTextValuesForSigning(placements, { shared: "Edited" })).toEqual({ ok: true, values: { shared: "Edited" } });
    expect(resolveTextValuesForSigning(placements, {})).toEqual({ ok: true, values: { shared: "Prefill" } });
  });

  it("blocks when a required HR box is empty", () => {
    const res = resolveTextValuesForSigning([box("hr", { filledBy: "admin", label: "Manager" })], {});
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.missingAdmin).toEqual(["Manager"]);
      expect(res.error).toMatch(/HR still needs/);
    }
  });

  it("blocks when a required recipient box is empty, including a cleared shared box", () => {
    const res = resolveTextValuesForSigning(
      [box("cand", { label: "Phone" }), box("shared", { filledBy: "both", value: "x", label: "Address" })],
      { cand: " ", shared: "" }
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.missingSigner).toEqual(["Phone", "Address"]);
  });

  it("allows optional boxes to stay empty", () => {
    const res = resolveTextValuesForSigning(
      [box("cand", { required: false }), box("hr", { filledBy: "admin", required: false })],
      undefined
    );
    expect(res).toEqual({ ok: true, values: {} });
  });
});

describe("toPdfSafeText", () => {
  it("keeps Latin-1 and replaces what standard fonts cannot draw", () => {
    expect(toPdfSafeText("José Müller")).toBe("José Müller");
    expect(toPdfSafeText("a\nb")).toBe("a b");
    expect(toPdfSafeText("hi 👋")).toBe("hi ?");
  });
});
