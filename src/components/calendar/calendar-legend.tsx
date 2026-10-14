"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { Dialog } from "@/components/ui/dialog";
import { saveCalendarCategoryColors } from "@/lib/actions/calendar-settings";
import {
  CALENDAR_CATEGORIES,
  CALENDAR_COLOR_IDS,
  CALENDAR_COLORS,
  categoryChipClass,
  type CalendarCategory,
  type CategoryColors,
} from "@/lib/calendar-colors";

/** Legend that doubles as layer toggles; admins/HR can set each category's colour. */
export function CalendarLegend({ colors, hidden, present, onToggle, canCustomize }: {
  colors: CategoryColors;
  hidden: ReadonlySet<CalendarCategory>;
  present: ReadonlySet<CalendarCategory>;
  onToggle: (category: CalendarCategory) => void;
  canCustomize: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const categories = CALENDAR_CATEGORIES.filter((category) => present.has(category.id) || hidden.has(category.id));

  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]">Show</span>
      {categories.map((category) => {
        const on = !hidden.has(category.id);
        return (
          <button
            key={category.id}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(category.id)}
            title={on ? `Hide ${category.label}` : `Show ${category.label}`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold transition-opacity",
              categoryChipClass(category.id, colors),
              !on && "opacity-40 line-through"
            )}
          >
            <Icon name={on ? "check" : "visibility_off"} size={12} />
            {category.label}
          </button>
        );
      })}
      {canCustomize && (
        <button type="button" onClick={() => setEditing(true)} className="ml-1 inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
          <Icon name="palette" size={12} />
          Colors
        </button>
      )}
      {canCustomize && <CategoryColorDialog open={editing} onClose={() => setEditing(false)} colors={colors} />}
    </div>
  );
}

function CategoryColorDialog({ open, onClose, colors }: { open: boolean; onClose: () => void; colors: CategoryColors }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<string, string>>(() => ({ ...colors }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const result = await saveCalendarCategoryColors(draft);
    setSaving(false);
    if (!result.success) {
      setError(result.error || "Could not save colors");
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Calendar colors">
      <p className="mb-4 text-xs text-[var(--color-text-muted)]">
        Give each kind of calendar item one color for everyone. A color picked on a single company event still wins for that event.
      </p>
      <div className="space-y-2">
        {CALENDAR_CATEGORIES.map((category) => (
          <label key={category.id} className="flex items-center justify-between gap-3 text-sm">
            <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", categoryChipClass(category.id, draft as CategoryColors))}>{category.label}</span>
            <select
              value={draft[category.id] || ""}
              onChange={(e) => setDraft((prev) => ({ ...prev, [category.id]: e.target.value }))}
              className="w-40 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1.5 text-sm text-[var(--color-text-primary)]"
            >
              <option value="">Default</option>
              {CALENDAR_COLOR_IDS.map((id) => <option key={id} value={id}>{CALENDAR_COLORS[id].label}</option>)}
            </select>
          </label>
        ))}
      </div>
      {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-700">{error}</p>}
      <div className="mt-5 flex justify-end gap-2 border-t border-[var(--color-border)] pt-4">
        <button type="button" onClick={() => setDraft({})} className="mr-auto rounded-lg px-3 py-2 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]">Reset all</button>
        <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]">Cancel</button>
        <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? "Saving..." : "Save colors"}</button>
      </div>
    </Dialog>
  );
}
