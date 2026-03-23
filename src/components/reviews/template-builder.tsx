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
