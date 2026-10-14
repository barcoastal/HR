"use client";

import { cn } from "@/lib/utils";
import { CALENDAR_COLOR_IDS, CALENDAR_COLORS, isCalendarColor } from "@/lib/calendar-colors";
import { EVENT_VISIBILITIES, EVENT_VISIBILITY_LABEL, type EventVisibility } from "@/lib/event-audience";

const VISIBILITY_HINT: Record<EventVisibility, string> = {
  everyone: "Shown to the people it is shared with, as today.",
  managers: "Only invitees, managers and admins see it. \"Everyone\" invites managers and admins only.",
  admins: "Only invitees, admins and HR see it. \"Everyone\" invites admins and HR only.",
  invited: "Only the people invited (and you) see it.",
};

/** Colour + "Visible to" controls shared by the create and edit event forms. */
export function EventAppearanceFields({ color, onColor, visibility, onVisibility, inputClass }: {
  color: string;
  onColor: (value: string) => void;
  visibility: EventVisibility;
  onVisibility: (value: EventVisibility) => void;
  inputClass: string;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="block text-xs font-medium text-[var(--color-text-primary)]">
        Color
        <span className="mt-1 flex items-center gap-2">
          <span aria-hidden="true" className={cn("h-4 w-4 shrink-0 rounded-full border border-[var(--color-border)]", isCalendarColor(color) ? CALENDAR_COLORS[color].dot : "bg-[var(--color-surface-container)]")} />
          <select value={color} onChange={(e) => onColor(e.target.value)} className={inputClass}>
            <option value="">Category default</option>
            {CALENDAR_COLOR_IDS.map((id) => <option key={id} value={id}>{CALENDAR_COLORS[id].label}</option>)}
          </select>
        </span>
      </label>
      <label className="block text-xs font-medium text-[var(--color-text-primary)]">
        Visible to
        <select value={visibility} onChange={(e) => onVisibility(e.target.value as EventVisibility)} className={cn(inputClass, "mt-1")}>
          {EVENT_VISIBILITIES.map((value) => <option key={value} value={value}>{EVENT_VISIBILITY_LABEL[value]}</option>)}
        </select>
      </label>
      <p className="text-[11px] text-[var(--color-text-muted)] sm:col-span-2">{VISIBILITY_HINT[visibility]}</p>
    </div>
  );
}
