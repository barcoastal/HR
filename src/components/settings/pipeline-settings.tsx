"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import {
  savePipelineStages,
  saveCandidateCustomFields,
  type PipelineStage,
  type CandidateCustomField,
} from "@/lib/actions/company-settings";
import { useRouter } from "next/navigation";

const COLORS = [
  { label: "Blue", text: "text-blue-400", bg: "bg-blue-500" },
  { label: "Amber", text: "text-amber-400", bg: "bg-amber-500" },
  { label: "Purple", text: "text-purple-400", bg: "bg-purple-500" },
  { label: "Emerald", text: "text-emerald-400", bg: "bg-emerald-500" },
  { label: "Orange", text: "text-orange-400", bg: "bg-orange-500" },
  { label: "Green", text: "text-green-400", bg: "bg-green-500" },
  { label: "Red", text: "text-red-400", bg: "bg-red-500" },
  { label: "Cyan", text: "text-cyan-400", bg: "bg-cyan-500" },
  { label: "Pink", text: "text-pink-400", bg: "bg-pink-500" },
  { label: "Indigo", text: "text-indigo-400", bg: "bg-indigo-500" },
];

const ENUM_VALUES = ["NEW", "SCREENING", "INTERVIEW", "OFFER", "BACKGROUND_CHECK", "HIRED", "REJECTED"];

export function PipelineSettings({
  initialStages,
  initialCustomFields,
}: {
  initialStages: PipelineStage[];
  initialCustomFields: CandidateCustomField[];
}) {
  const [stages, setStages] = useState<PipelineStage[]>(initialStages);
  const [customFields, setCustomFields] = useState<CandidateCustomField[]>(initialCustomFields);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  const inputClass = cn(
    "w-full px-3 py-2 rounded-lg text-sm",
    "bg-[var(--color-background)] border border-[var(--color-border)]",
    "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
  );

  function updateStage(index: number, updates: Partial<PipelineStage>) {
    setStages((s) => s.map((stage, i) => (i === index ? { ...stage, ...updates } : stage)));
    setSaved(false);
  }

  function addStage() {
    const order = stages.length;
    // Find an unused enum value or reuse SCREENING for custom sub-stages
    const usedEnums = stages.map((s) => s.enumValue);
    const availableEnum = ENUM_VALUES.find((e) => !usedEnums.includes(e)) || "SCREENING";
    setStages([
      ...stages.slice(0, -2), // before Hired and Rejected
      {
        id: `custom_${Date.now()}`,
        label: "New Stage",
        color: "text-cyan-400",
        bgColor: "bg-cyan-500",
        enumValue: availableEnum,
        visible: true,
        order,
      },
      ...stages.slice(-2), // Hired and Rejected stay at end
    ]);
    setSaved(false);
  }

  function removeStage(index: number) {
    const stage = stages[index];
    // Don't allow removing NEW, HIRED, or REJECTED
    if (["NEW", "HIRED", "REJECTED"].includes(stage.enumValue) && stages.filter(s => s.enumValue === stage.enumValue).length <= 1) {
      return;
    }
    setStages((s) => s.filter((_, i) => i !== index));
    setSaved(false);
  }

  function moveStage(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= stages.length) return;
    const newStages = [...stages];
    [newStages[index], newStages[newIndex]] = [newStages[newIndex], newStages[index]];
    setStages(newStages.map((s, i) => ({ ...s, order: i })));
    setSaved(false);
  }

  function addCustomField() {
    setCustomFields([
      ...customFields,
      {
        id: `field_${Date.now()}`,
        label: "New Field",
        type: "text",
        required: false,
        order: customFields.length,
      },
    ]);
    setSaved(false);
  }

  function updateField(index: number, updates: Partial<CandidateCustomField>) {
    setCustomFields((f) => f.map((field, i) => (i === index ? { ...field, ...updates } : field)));
    setSaved(false);
  }

  function removeField(index: number) {
    setCustomFields((f) => f.filter((_, i) => i !== index));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    await savePipelineStages(stages);
    await saveCandidateCustomFields(customFields);
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="space-y-6 rounded-2xl bg-[var(--color-surface-container-lowest)] border border-[var(--color-border)] p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Recruitment Pipeline</h2>
          <p className="text-sm text-[var(--color-text-muted)]">Customize stages and candidate fields</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            saved
              ? "bg-emerald-500/10 text-emerald-500"
              : "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]",
            "disabled:opacity-50"
          )}
        >
          <Icon name={saving ? "progress_activity" : saved ? "check" : "save"} size={16} className={saving ? "animate-material-spin" : ""} />
          {saving ? "Saving..." : saved ? "Saved" : "Save Changes"}
        </button>
      </div>

      {/* Pipeline Stages */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Pipeline Stages</h3>
          <button
            onClick={addStage}
            className="flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
          >
            <Icon name="add" size={14} />
            Add Stage
          </button>
        </div>

        {/* Visual pipeline preview */}
        <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-2">
          {stages.filter(s => s.visible).map((stage, i) => (
            <div key={stage.id} className="flex items-center gap-1">
              <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-medium text-white whitespace-nowrap", stage.bgColor)}>
                {stage.label}
              </span>
              {i < stages.filter(s => s.visible).length - 1 && (
                <Icon name="arrow_forward" size={12} className="text-[var(--color-text-muted)] shrink-0" />
              )}
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {stages.map((stage, index) => (
            <div
              key={stage.id}
              className={cn(
                "flex items-center gap-2 p-2.5 rounded-lg border transition-colors",
                stage.visible
                  ? "border-[var(--color-border)] bg-[var(--color-background)]"
                  : "border-dashed border-[var(--color-border)] bg-[var(--color-background)] opacity-50"
              )}
            >
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moveStage(index, -1)} disabled={index === 0} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-20">
                  <Icon name="keyboard_arrow_up" size={14} />
                </button>
                <button onClick={() => moveStage(index, 1)} disabled={index === stages.length - 1} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-20">
                  <Icon name="keyboard_arrow_down" size={14} />
                </button>
              </div>

              <span className={cn("w-3 h-3 rounded-full shrink-0", stage.bgColor)} />

              <input
                value={stage.label}
                onChange={(e) => updateStage(index, { label: e.target.value })}
                className={cn(inputClass, "flex-1 py-1.5")}
              />

              <select
                value={stage.bgColor}
                onChange={(e) => {
                  const c = COLORS.find((c) => c.bg === e.target.value);
                  if (c) updateStage(index, { bgColor: c.bg, color: c.text });
                }}
                className={cn(inputClass, "w-28 py-1.5")}
              >
                {COLORS.map((c) => (
                  <option key={c.bg} value={c.bg}>{c.label}</option>
                ))}
              </select>

              <select
                value={stage.enumValue}
                onChange={(e) => updateStage(index, { enumValue: e.target.value })}
                className={cn(inputClass, "w-36 py-1.5")}
              >
                {ENUM_VALUES.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>

              <button
                onClick={() => updateStage(index, { visible: !stage.visible })}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                title={stage.visible ? "Hide" : "Show"}
              >
                <Icon name={stage.visible ? "visibility" : "visibility_off"} size={16} />
              </button>

              <button
                onClick={() => removeStage(index)}
                className="text-[var(--color-text-muted)] hover:text-red-500"
                title="Remove"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Candidate Fields */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Custom Candidate Fields</h3>
          <button
            onClick={addCustomField}
            className="flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
          >
            <Icon name="add" size={14} />
            Add Field
          </button>
        </div>

        {customFields.length === 0 && (
          <p className="text-xs text-[var(--color-text-muted)] py-4 text-center">
            No custom fields yet. Add fields to collect additional info on candidates.
          </p>
        )}

        <div className="space-y-2">
          {customFields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)]">
              <input
                value={field.label}
                onChange={(e) => updateField(index, { label: e.target.value })}
                placeholder="Field name"
                className={cn(inputClass, "flex-1 py-1.5")}
              />

              <select
                value={field.type}
                onChange={(e) => updateField(index, { type: e.target.value as any })}
                className={cn(inputClass, "w-28 py-1.5")}
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="url">URL</option>
                <option value="select">Dropdown</option>
              </select>

              {field.type === "select" && (
                <input
                  value={(field.options || []).join(", ")}
                  onChange={(e) => updateField(index, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                  placeholder="Option 1, Option 2, ..."
                  className={cn(inputClass, "flex-1 py-1.5")}
                />
              )}

              <label className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] shrink-0">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) => updateField(index, { required: e.target.checked })}
                  className="rounded border-[var(--color-border)]"
                />
                Required
              </label>

              <button
                onClick={() => removeField(index)}
                className="text-[var(--color-text-muted)] hover:text-red-500"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
