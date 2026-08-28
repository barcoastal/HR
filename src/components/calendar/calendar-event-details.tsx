"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { cancelCompanyEvent, updateCompanyEvent } from "@/lib/actions/company-events";
import { cancelTrainingClass } from "@/lib/actions/training-calendar";
import type { CalendarEvent } from "@/components/calendar/calendar-view";
import { dateKey, formatDateTime, zonedDateFromInput, zonedParts } from "@/lib/time-zone";

const inputClass = cn(
  "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm",
  "text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
);

function typeLabel(type: CalendarEvent["type"]) {
  const labels: Partial<Record<CalendarEvent["type"], string>> = {
    birthday: "Birthday",
    anniversary: "Anniversary",
    benefits: "Benefits eligibility",
    interview: "Interview",
    "feed-event": "Company event",
    "google-calendar": "Google Calendar",
    "performance-review": "Performance review",
    "one-on-one": "1:1 meeting",
    training: "Training",
    "out-of-office": "Out of office",
    "working-remotely": "Working remotely",
  };
  return labels[type] || (type.startsWith("holiday-") ? "Holiday" : "Calendar event");
}

export function CalendarEventDetails({ event, open, onClose }: {
  event: CalendarEvent | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const defaults = useMemo(() => {
    if (!event) return null;
    const start = new Date(event.date);
    const end = event.endDate ? new Date(event.endDate) : new Date(start.getTime() + 60 * 60_000);
    // Pre-fill the pickers with the company-zone wall clock, not the browser's.
    const startParts = zonedParts(start);
    return {
      title: event.name,
      description: event.description || "",
      location: event.location || "",
      date: dateKey(start),
      time: `${String(startParts.hour).padStart(2, "0")}:${String(startParts.minute).padStart(2, "0")}`,
      duration: String(Math.max(5, Math.round((end.getTime() - start.getTime()) / 60_000))),
    };
  }, [event]);
  const [form, setForm] = useState(defaults);

  if (!event || !defaults) return null;
  const eventSourceId = event.sourceId;
  const eventSourceKind = event.sourceKind;

  function close() {
    setEditing(false);
    setConfirmCancel(false);
    setError(null);
    onClose();
  }

  function beginEditing() {
    setForm(defaults);
    setError(null);
    setEditing(true);
  }

  async function save() {
    if (!form || !eventSourceId) return;
    const startAt = zonedDateFromInput(form.date, form.time);
    if (!startAt) {
      setError("Pick a valid date and time");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await updateCompanyEvent({
      eventId: eventSourceId,
      title: form.title,
      description: form.description,
      location: form.location,
      startTime: startAt.toISOString(),
      durationMinutes: Number(form.duration),
    });
    setSaving(false);
    if (!result.success) {
      setError(result.error || "Could not update the event");
      return;
    }
    setEditing(false);
    router.refresh();
    close();
  }

  async function cancel() {
    if (!eventSourceId) return;
    setSaving(true);
    setError(null);
    const result = eventSourceKind === "training"
      ? await cancelTrainingClass(eventSourceId)
      : await cancelCompanyEvent(eventSourceId);
    setSaving(false);
    if (!result.success) {
      setError(result.error || "Could not cancel the event");
      return;
    }
    router.refresh();
    close();
  }

  return (
    <Dialog open={open} onClose={close} title={editing ? "Edit company event" : event.name}>
      {editing && form ? (
        <div className="space-y-4">
          <label className="block text-xs font-semibold text-[var(--color-text-primary)]">
            Title
            <input className={cn(inputClass, "mt-1")} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="col-span-2 text-xs font-semibold text-[var(--color-text-primary)]">
              Date
              <input type="date" className={cn(inputClass, "mt-1")} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </label>
            <label className="text-xs font-semibold text-[var(--color-text-primary)]">
              Time
              <input type="time" className={cn(inputClass, "mt-1")} value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            </label>
          </div>
          <label className="block text-xs font-semibold text-[var(--color-text-primary)]">
            Duration (minutes)
            <input type="number" min={5} step={5} className={cn(inputClass, "mt-1")} value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
          </label>
          <label className="block text-xs font-semibold text-[var(--color-text-primary)]">
            Location
            <input className={cn(inputClass, "mt-1")} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </label>
          <label className="block text-xs font-semibold text-[var(--color-text-primary)]">
            Description
            <textarea rows={3} className={cn(inputClass, "mt-1")} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          {error && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-[var(--color-border)] pt-4">
            <button type="button" onClick={() => setEditing(false)} className="rounded-xl px-4 py-2 text-sm font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]">Back</button>
            <button type="button" onClick={save} disabled={saving || !form.title.trim()} className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {saving && <Icon name="progress_activity" size={16} className="animate-material-spin" />}
              Save changes
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[var(--color-primary-fixed)] px-2.5 py-1 text-xs font-bold text-[var(--color-on-primary-fixed-variant)]">{typeLabel(event.type)}</span>
            {event.groupName && <span className="text-xs text-[var(--color-text-muted)]">{event.groupName}</span>}
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex gap-3"><Icon name="schedule" size={19} className="text-[var(--color-accent)]" /><div><p className="font-semibold text-[var(--color-text-primary)]">{formatDateTime(new Date(event.date), { allDay: event.allDay })}</p>{event.endDate && !event.allDay && <p className="text-[var(--color-text-muted)]">Ends {formatDateTime(new Date(event.endDate))}</p>}</div></div>
            {event.organizer && <div className="flex gap-3"><Icon name="person" size={19} className="text-[var(--color-accent)]" /><div><p className="text-[var(--color-text-muted)]">Organizer</p><p className="font-semibold text-[var(--color-text-primary)]">{event.organizer}</p></div></div>}
            {event.location && <div className="flex gap-3"><Icon name="location_on" size={19} className="text-[var(--color-accent)]" /><p className="text-[var(--color-text-primary)]">{event.location}</p></div>}
            {event.description && <div className="flex gap-3"><Icon name="notes" size={19} className="text-[var(--color-accent)]" /><p className="whitespace-pre-wrap text-[var(--color-text-primary)]">{event.description}</p></div>}
            {event.audience && <div className="flex gap-3"><Icon name="visibility" size={19} className="text-[var(--color-accent)]" /><p className="text-[var(--color-text-primary)]">Visible to {event.audience}</p></div>}
            {!!event.attendees?.length && <div className="flex gap-3"><Icon name="group" size={19} className="text-[var(--color-accent)]" /><div><p className="text-[var(--color-text-muted)]">Attendees</p><p className="text-[var(--color-text-primary)]">{event.attendees.join(", ")}</p></div></div>}
          </div>
          {(event.meetLink || event.htmlLink) && <div className="flex flex-wrap gap-2">{event.meetLink && <a href={event.meetLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white"><Icon name="videocam" size={17} />Join meeting</a>}{event.htmlLink && <a href={event.htmlLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text-primary)]"><Icon name="open_in_new" size={17} />Open in Google</a>}</div>}
          {error && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-700">{error}</p>}
          {event.canManage && (event.sourceKind === "company" || event.sourceKind === "training") && (
            <div className="border-t border-[var(--color-border)] pt-4">
              {confirmCancel ? (
                <div className="rounded-xl bg-red-500/10 p-3">
                  <p className="text-sm font-semibold text-red-800">Cancel this {event.sourceKind === "training" ? "training class and all sessions" : "event"}?</p>
                  <p className="mt-1 text-xs text-red-700">It will be removed from the HR calendar and connected Google calendars.</p>
                  <div className="mt-3 flex gap-2"><button onClick={() => setConfirmCancel(false)} className="rounded-lg px-3 py-2 text-xs font-semibold text-red-800">Keep it</button><button onClick={cancel} disabled={saving} className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Yes, cancel</button></div>
                </div>
              ) : (
                <div className="flex justify-between gap-2">
                  <button onClick={() => setConfirmCancel(true)} className="rounded-xl px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-500/10">Cancel {event.sourceKind === "training" ? "class" : "event"}</button>
                  {event.sourceKind === "company" && <button onClick={beginEditing} className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"><Icon name="edit" size={17} />Edit event</button>}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
