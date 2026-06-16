"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { saveHiringPlan, snapshotCurrentOrg, type HiringBox, type HiringPlanData, type HiringSlot } from "@/lib/actions/hiring-plan";

type EmployeeOption = { id: string; firstName: string; lastName: string; jobTitle: string };

const COLOR_PALETTE = [
  { id: "green",  header: "bg-emerald-600 text-white", body: "bg-emerald-100 text-emerald-900" },
  { id: "blue",   header: "bg-blue-600 text-white",    body: "bg-blue-100 text-blue-900" },
  { id: "amber",  header: "bg-amber-600 text-white",   body: "bg-amber-100 text-amber-900" },
  { id: "purple", header: "bg-purple-600 text-white",  body: "bg-purple-100 text-purple-900" },
  { id: "rose",   header: "bg-rose-600 text-white",    body: "bg-rose-100 text-rose-900" },
  { id: "slate",  header: "bg-slate-600 text-white",   body: "bg-slate-100 text-slate-900" },
  { id: "cyan",   header: "bg-cyan-600 text-white",    body: "bg-cyan-100 text-cyan-900" },
];

function colorStyles(id: string) {
  return COLOR_PALETTE.find((c) => c.id === id) ?? COLOR_PALETTE[0];
}

function newSlotId() {
  return `slot-${Math.random().toString(36).slice(2, 10)}`;
}
function newBoxId() {
  return `box-${Math.random().toString(36).slice(2, 10)}`;
}

export function HiringPlanEditor({
  initialData,
  employees,
}: {
  initialData: HiringPlanData;
  employees: EmployeeOption[];
}) {
  const [boxes, setBoxes] = useState<HiringBox[]>(initialData.boxes ?? []);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // Track which slot is being edited (open picker / text input).
  const [editingSlot, setEditingSlot] = useState<{ boxId: string; slotId: string } | null>(null);

  const employeeById = useMemo(() => {
    const m = new Map<string, EmployeeOption>();
    for (const e of employees) m.set(e.id, e);
    return m;
  }, [employees]);

  // Count filled vs TBH for the stats strip.
  const stats = useMemo(() => {
    let total = 0;
    let filled = 0;
    for (const b of boxes) {
      for (const s of b.slots) {
        total += 1;
        if (s.employeeId || (s.label && s.label.trim() !== "" && s.label.trim().toUpperCase() !== "TBH")) {
          filled += 1;
        }
      }
    }
    return { total, filled, open: total - filled };
  }, [boxes]);

  function markDirty(next: HiringBox[]) {
    setBoxes(next);
    setDirty(true);
  }

  function addBox() {
    markDirty([
      ...boxes,
      {
        id: newBoxId(),
        title: "New role",
        color: COLOR_PALETTE[boxes.length % COLOR_PALETTE.length].id,
        slots: [{ id: newSlotId(), label: "TBH", employeeId: null }],
      },
    ]);
  }
  function removeBox(boxId: string) {
    if (!confirm("Delete this column?")) return;
    markDirty(boxes.filter((b) => b.id !== boxId));
  }
  function updateBox(boxId: string, patch: Partial<HiringBox>) {
    markDirty(boxes.map((b) => (b.id === boxId ? { ...b, ...patch } : b)));
  }
  function moveBox(boxId: string, direction: -1 | 1) {
    const idx = boxes.findIndex((b) => b.id === boxId);
    if (idx === -1) return;
    const next = [...boxes];
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= next.length) return;
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    markDirty(next);
  }
  function addSlot(boxId: string) {
    markDirty(
      boxes.map((b) =>
        b.id === boxId
          ? { ...b, slots: [...b.slots, { id: newSlotId(), label: "TBH", employeeId: null }] }
          : b,
      ),
    );
  }
  function removeSlot(boxId: string, slotId: string) {
    markDirty(
      boxes.map((b) =>
        b.id === boxId ? { ...b, slots: b.slots.filter((s) => s.id !== slotId) } : b,
      ),
    );
  }
  function updateSlot(boxId: string, slotId: string, patch: Partial<HiringSlot>) {
    markDirty(
      boxes.map((b) =>
        b.id === boxId
          ? { ...b, slots: b.slots.map((s) => (s.id === slotId ? { ...s, ...patch } : s)) }
          : b,
      ),
    );
  }

  function handleSave() {
    setSavedAt(null);
    startTransition(async () => {
      try {
        await saveHiringPlan({ boxes });
        setDirty(false);
        setSavedAt(new Date());
      } catch (err) {
        alert(err instanceof Error ? err.message : "Could not save");
      }
    });
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
          <span><strong className="text-[var(--color-text-primary)]">{stats.total}</strong> slots</span>
          <span><strong className="text-emerald-600">{stats.filled}</strong> filled</span>
          <span><strong className="text-rose-600">{stats.open}</strong> open</span>
          {savedAt && !dirty && (
            <span className="text-emerald-600 inline-flex items-center gap-1">
              <Icon name="check_circle" size={12} />
              Saved
            </span>
          )}
          {dirty && (
            <span className="text-amber-600 inline-flex items-center gap-1">
              <Icon name="edit" size={12} />
              Unsaved changes
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              if (
                boxes.length > 0 &&
                !confirm("Replace the current plan with a fresh snapshot of every Team + employee + open Position from the system?")
              ) return;
              startTransition(async () => {
                try {
                  const snap = await snapshotCurrentOrg();
                  setBoxes(snap.boxes);
                  setDirty(true);
                } catch (err) {
                  alert(err instanceof Error ? err.message : "Could not snapshot org");
                }
              });
            }}
            disabled={pending}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-[var(--color-text-primary)] bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50"
            title="Pre-populate columns from current Teams + active Employees + open Positions"
          >
            <Icon name="sync" size={14} />
            Snapshot current org
          </button>
          <button
            onClick={addBox}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-[var(--color-text-primary)] bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
          >
            <Icon name="add" size={14} />
            Add column
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty || pending}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium",
              dirty
                ? "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]"
                : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)]",
              "disabled:opacity-50",
            )}
          >
            <Icon name={pending ? "progress_activity" : "save"} size={14} className={pending ? "animate-material-spin" : ""} />
            {pending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* Boxes — flex-wrap layout so they tile horizontally and wrap to new
          rows as the screen narrows */}
      <div className="flex flex-wrap gap-3 items-start" onClick={() => setEditingSlot(null)}>
        {boxes.map((box, boxIdx) => {
          const styles = colorStyles(box.color);
          return (
            <div
              key={box.id}
              onClick={(e) => e.stopPropagation()}
              className="rounded-lg overflow-hidden border border-[var(--color-border)] bg-white shadow-sm min-w-[230px]"
            >
              {/* Header */}
              <div className={cn("flex items-center gap-1 px-2 py-1.5 group", styles.header)}>
                <input
                  value={box.title}
                  onChange={(e) => updateBox(box.id, { title: e.target.value })}
                  className="flex-1 bg-transparent text-sm font-semibold text-center outline-none placeholder:text-white/50"
                  placeholder="Title"
                />
                <select
                  value={box.color}
                  onChange={(e) => updateBox(box.id, { color: e.target.value })}
                  className="text-[10px] rounded bg-white/20 px-1 py-0.5 cursor-pointer hover:bg-white/30"
                  title="Color"
                >
                  {COLOR_PALETTE.map((c) => (
                    <option key={c.id} value={c.id} className="text-black">{c.id}</option>
                  ))}
                </select>
                <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => moveBox(box.id, -1)} disabled={boxIdx === 0} className="px-0.5 disabled:opacity-30" title="Move left">
                    <Icon name="chevron_left" size={12} />
                  </button>
                  <button onClick={() => moveBox(box.id, 1)} disabled={boxIdx === boxes.length - 1} className="px-0.5 disabled:opacity-30" title="Move right">
                    <Icon name="chevron_right" size={12} />
                  </button>
                </div>
                <button onClick={() => removeBox(box.id)} className="opacity-0 group-hover:opacity-100 px-1" title="Delete column">
                  <Icon name="close" size={12} />
                </button>
              </div>

              {/* Slots — 2-column grid */}
              <div className={cn("grid grid-cols-2 gap-px", styles.body)}>
                {box.slots.map((slot) => {
                  const isEditing =
                    editingSlot?.boxId === box.id && editingSlot.slotId === slot.id;
                  const emp = slot.employeeId ? employeeById.get(slot.employeeId) : null;
                  const displayLabel = emp
                    ? `${emp.firstName} ${emp.lastName}`
                    : slot.label || "";
                  const isTbh = !emp && (!slot.label || slot.label.trim().toUpperCase() === "TBH");
                  return (
                    <div
                      key={slot.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingSlot({ boxId: box.id, slotId: slot.id });
                      }}
                      className={cn(
                        "relative px-2 py-1.5 text-center text-sm cursor-pointer border border-white/40 min-h-[32px]",
                        isTbh && "italic text-current/60",
                      )}
                      title="Click to edit"
                    >
                      {isEditing ? (
                        <SlotEditor
                          slot={slot}
                          employees={employees}
                          onChange={(patch) => updateSlot(box.id, slot.id, patch)}
                          onDelete={() => {
                            removeSlot(box.id, slot.id);
                            setEditingSlot(null);
                          }}
                          onClose={() => setEditingSlot(null)}
                        />
                      ) : (
                        displayLabel || "—"
                      )}
                    </div>
                  );
                })}
                {/* Add-slot tile spans both columns at the bottom */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addSlot(box.id);
                  }}
                  className="col-span-2 flex items-center justify-center gap-1 py-1.5 text-[11px] bg-white/30 hover:bg-white/50 border border-dashed border-current/30 text-current/70"
                >
                  <Icon name="add" size={12} />
                  Add slot
                </button>
              </div>
            </div>
          );
        })}

        {boxes.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-12 text-center w-full">
            <Icon name="dashboard" size={36} className="text-[var(--color-text-muted)] mx-auto mb-2" />
            <p className="text-sm text-[var(--color-text-primary)] font-medium">No columns yet</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Click <strong>Add column</strong> to create your first role / team.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SlotEditor({
  slot,
  employees,
  onChange,
  onDelete,
  onClose,
}: {
  slot: HiringSlot;
  employees: EmployeeOption[];
  onChange: (patch: Partial<HiringSlot>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(() =>
    slot.employeeId
      ? employees.find((e) => e.id === slot.employeeId)
        ? ""
        : slot.label
      : slot.label || ""
  );
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees.slice(0, 6);
    return employees
      .filter((e) =>
        `${e.firstName} ${e.lastName} ${e.jobTitle}`.toLowerCase().includes(q),
      )
      .slice(0, 6);
  }, [query, employees]);

  function pickEmployee(e: EmployeeOption) {
    onChange({ employeeId: e.id, label: `${e.firstName} ${e.lastName}` });
    onClose();
  }
  function setText(text: string) {
    onChange({ employeeId: null, label: text });
  }

  return (
    <div className="absolute left-0 right-0 top-0 z-20 bg-white border border-[var(--color-border)] rounded shadow-lg p-1.5 text-left">
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setText(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (matches.length > 0) pickEmployee(matches[0]);
            else onClose();
          } else if (e.key === "Escape") {
            onClose();
          }
        }}
        placeholder="Name or TBH"
        className="w-full px-2 py-1 rounded text-sm border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 text-[var(--color-text-primary)]"
      />
      {matches.length > 0 && (
        <div className="mt-1 max-h-40 overflow-y-auto">
          {matches.map((e) => (
            <button
              key={e.id}
              onClick={() => pickEmployee(e)}
              className="w-full text-left px-2 py-1 rounded text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-accent)]/10"
            >
              <span className="font-medium">{e.firstName} {e.lastName}</span>
              <span className="text-[var(--color-text-muted)] ml-1.5">{e.jobTitle}</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1 mt-1 pt-1 border-t border-[var(--color-border)]">
        <button
          onClick={() => {
            setQuery("TBH");
            setText("TBH");
            onClose();
          }}
          className="flex-1 text-[10px] px-2 py-0.5 rounded bg-rose-100 text-rose-700 hover:bg-rose-200"
        >
          Mark TBH
        </button>
        <button
          onClick={onDelete}
          className="text-[10px] px-2 py-0.5 rounded text-rose-500 hover:bg-rose-50"
          title="Remove slot"
        >
          <Icon name="delete" size={11} />
        </button>
      </div>
    </div>
  );
}
