"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { Dialog } from "@/components/ui/dialog";
import { CalendarEventDetails } from "@/components/calendar/calendar-event-details";
import { CalendarLegend } from "@/components/calendar/calendar-legend";
import { dateKey, formatInZone, formatTime, zonedDate, zonedParts } from "@/lib/time-zone";
import { calendarCategoryOf, calendarChipClass, type CalendarCategory, type CategoryColors } from "@/lib/calendar-colors";
import { MILESTONE_STATUS_LABEL, type MilestoneKind, type MilestoneStatus } from "@/lib/review-milestones";

export type CalendarEvent = {
  id: string;
  name: string;
  /** ISO instant. */
  date: string;
  /** `YYYY-MM-DD` in the company zone — the day this event is filed under. */
  dateKey: string;
  type: "birthday" | "anniversary" | "benefits" | "interview" | "holiday-jewish" | "holiday-muslim" | "holiday-christian" | "holiday-american" | "feed-event" | "google-calendar" | "performance-review" | "review-milestone" | "one-on-one" | "training" | "out-of-office" | "working-remotely";
  department?: string;
  years?: number;
  meetLink?: string | null;
  htmlLink?: string | null;
  time?: string;
  endDate?: string;
  location?: string;
  description?: string;
  organizer?: string;
  attendees?: string[];
  audience?: string;
  allDay?: boolean;
  canManage?: boolean;
  sourceId?: string;
  sourceKind?: "company" | "training" | "one-on-one" | "review" | "out-of-office" | "google" | "milestone";
  groupName?: string;
  /** Palette colour chosen for this event (company events). */
  color?: string | null;
  /** Company-event partition: everyone | managers | admins | invited. */
  visibility?: string;
  milestone?: {
    key: string;
    employeeId: string;
    employeeName: string;
    kind: MilestoneKind;
    label: string;
    status: MilestoneStatus;
    dueKey: string;
    meetingId?: string;
    meetingKey?: string;
    canSchedule: boolean;
  };
};

type Props = {
  events: CalendarEvent[];
  categoryColors?: CategoryColors;
  canCustomizeColors?: boolean;
  /** Open this event's details on load (e.g. from a reminder email link). */
  initialEventId?: string;
};

const HIDDEN_LAYERS_KEY = "calendar.hiddenLayers";

export function calendarEventTypeLabel(type: CalendarEvent["type"]) {
  if (type === "birthday") return "Birthday";
  if (type === "anniversary") return "Anniversary";
  if (type === "benefits") return "Benefits eligible";
  if (type === "interview") return "Interview";
  if (type === "feed-event") return "Company event";
  if (type === "google-calendar") return "Google Calendar";
  if (type === "performance-review") return "Review due";
  if (type === "review-milestone") return "Review milestone";
  if (type === "one-on-one") return "1:1 meeting";
  if (type === "training") return "Training";
  if (type === "out-of-office") return "Out of office";
  if (type === "working-remotely") return "Working remotely";
  if (type.startsWith("holiday-")) return "Holiday";
  return "Event";
}

export function calendarEventTimeLabel(event: CalendarEvent, includeEnd = false) {
  if (event.allDay) return "All day";
  const start = new Date(event.date);
  if (Number.isNaN(start.getTime())) return event.time || "Time not set";
  if (includeEnd && event.endDate) {
    const end = new Date(event.endDate);
    const sameDay = !Number.isNaN(end.getTime()) && dateKey(start) === dateKey(end);
    if (sameDay && end.getTime() > start.getTime()) {
      return `${formatTime(start)} – ${formatTime(end)}`;
    }
  }
  return event.time || formatTime(start, { compact: true });
}

const MILESTONE_ICON: Record<MilestoneStatus, string> = {
  due: "pending_actions",
  overdue: "warning",
  scheduled: "event_available",
  completed: "task_alt",
};

function EventChip({ event, isToday, index, colors, onClick }: {
  event: CalendarEvent;
  isToday: boolean;
  index: number;
  colors: CategoryColors;
  onClick: () => void;
}) {
  const time = event.milestone ? MILESTONE_STATUS_LABEL[event.milestone.status] : calendarEventTimeLabel(event);
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${time}, ${calendarEventTypeLabel(event.type)}: ${event.name}`}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-full px-2 py-1 text-left text-[10px] font-bold transition-opacity hover:opacity-75 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40",
        isToday && index === 0 ? "bg-[var(--color-primary)] text-white" : calendarChipClass(event.type, colors, event.color)
      )}
    >
      {event.milestone
        ? <Icon name={MILESTONE_ICON[event.milestone.status]} size={12} className="shrink-0" />
        : <span className="shrink-0 font-black">{time}</span>}
      <span aria-hidden="true" className="shrink-0 opacity-45">·</span>
      <span className="truncate">{event.name}</span>
    </button>
  );
}

function DayCell({ day, isCurrentMonth, isToday, events, colors, onEvent, onMore }: {
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
  colors: CategoryColors;
  onEvent: (event: CalendarEvent) => void;
  onMore: () => void;
}) {
  const visibleEvents = events.slice(0, 2);
  const overflow = events.length - visibleEvents.length;
  return (
    <div className={cn(
      "flex min-h-[104px] flex-col gap-1.5 rounded-2xl p-2.5 md:min-h-[120px] md:p-3",
      !isCurrentMonth && "opacity-40",
      isToday
        ? "border-2 border-[var(--color-primary)]/20 bg-[var(--color-primary-fixed)]"
        : "bg-[var(--color-surface-container-lowest)]"
    )}>
      <div className="flex items-start justify-between">
        <span className={cn("text-sm font-bold", isToday ? "font-black text-[var(--color-primary)]" : "text-[var(--color-on-surface)]")}>{day}</span>
        {isToday && <span className="hidden rounded-full bg-[var(--color-primary)] px-1.5 py-0.5 text-[8px] font-bold uppercase text-white md:inline">Today</span>}
      </div>
      {visibleEvents.map((event, index) => <EventChip key={event.id} event={event} isToday={isToday} index={index} colors={colors} onClick={() => onEvent(event)} />)}
      {overflow > 0 && (
        <button type="button" onClick={onMore} className="w-fit rounded px-1 text-[10px] font-bold text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container)] hover:text-[var(--color-primary)]">
          +{overflow} more
        </button>
      )}
    </div>
  );
}

// Pure calendar arithmetic on a proleptic UTC grid — no zone involved.
function monthData(year: number, month: number) {
  return {
    days: new Date(Date.UTC(year, month + 1, 0)).getUTCDate(),
    firstOffset: (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7,
  };
}

function monthPrefix(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-`;
}

export function CalendarView({ events: allEvents, categoryColors = {}, canCustomizeColors = false, initialEventId }: Props) {
  // Layer toggles, remembered per browser. Storage can be unavailable.
  const [hiddenLayers, setHiddenLayers] = useState<Set<CalendarCategory>>(() => new Set());
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(HIDDEN_LAYERS_KEY) || "[]");
      if (Array.isArray(saved)) setHiddenLayers(new Set(saved as CalendarCategory[]));
    } catch {
      // ignore
    }
  }, []);
  function toggleLayer(category: CalendarCategory) {
    setHiddenLayers((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category); else next.add(category);
      try { window.localStorage.setItem(HIDDEN_LAYERS_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }
  const presentLayers = useMemo(() => new Set(allEvents.map((event) => calendarCategoryOf(event.type))), [allEvents]);
  const events = useMemo(
    () => hiddenLayers.size ? allEvents.filter((event) => !hiddenLayers.has(calendarCategoryOf(event.type))) : allEvents,
    [allEvents, hiddenLayers]
  );
  // "Today" is the company-zone day, wherever the browser is.
  const today = useMemo(() => zonedParts(new Date()), []);
  const todayKey = `${monthPrefix(today.year, today.month)}${String(today.day).padStart(2, "0")}`;
  const [currentMonth, setCurrentMonth] = useState(today.month);
  const [currentYear, setCurrentYear] = useState(today.year);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(() => initialEventId ? allEvents.find((event) => event.id === initialEventId) || null : null);
  // Jump to the month of an event opened from a link.
  useEffect(() => {
    if (!initialEventId) return;
    const target = allEvents.find((event) => event.id === initialEventId);
    if (!target) return;
    setCurrentYear(Number(target.dateKey.slice(0, 4)));
    setCurrentMonth(Number(target.dateKey.slice(5, 7)) - 1);
    // Only on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [agenda, setAgenda] = useState<{ label: string; events: CalendarEvent[] } | null>(null);
  const data = monthData(currentYear, currentMonth);

  const eventsByDay = useMemo(() => {
    const map: Record<number, CalendarEvent[]> = {};
    const prefix = monthPrefix(currentYear, currentMonth);
    for (const event of events) {
      if (!event.dateKey.startsWith(prefix)) continue;
      (map[Number(event.dateKey.slice(8, 10))] ||= []).push(event);
    }
    for (const values of Object.values(map)) values.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return map;
  }, [events, currentMonth, currentYear]);

  function changeMonth(direction: -1 | 1) {
    const next = new Date(Date.UTC(currentYear, currentMonth + direction, 1));
    setCurrentMonth(next.getUTCMonth());
    setCurrentYear(next.getUTCFullYear());
  }

  type Cell = { key: string; day: number; current: boolean; today: boolean; events: CalendarEvent[] };
  const cells: Cell[] = [];
  const previous = new Date(Date.UTC(currentYear, currentMonth, 0)).getUTCDate();
  for (let index = data.firstOffset - 1; index >= 0; index--) cells.push({ key: `prev-${index}`, day: previous - index, current: false, today: false, events: [] });
  for (let day = 1; day <= data.days; day++) cells.push({
    key: `day-${day}`,
    day,
    current: true,
    today: day === today.day && currentMonth === today.month && currentYear === today.year,
    events: eventsByDay[day] || [],
  });
  let nextDay = 1;
  while (cells.length % 7) cells.push({ key: `next-${nextDay}`, day: nextDay++, current: false, today: false, events: [] });

  // Monday-start week containing today, compared as company-zone day keys.
  const mondayOffset = (today.weekday + 6) % 7;
  const weekStartKey = dateKey(zonedDate(today.year, today.month, today.day - mondayOffset));
  const weekEndKey = dateKey(zonedDate(today.year, today.month, today.day - mondayOffset + 7));
  const weekCount = events.filter((event) => event.dateKey >= weekStartKey && event.dateKey < weekEndKey).length;
  const upcoming = useMemo(() => {
    return [...events].filter((event) => event.dateKey >= todayKey).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 4);
  }, [events, todayKey]);

  function openAgenda(day: number, dayEvents: CalendarEvent[]) {
    const label = formatInZone(zonedDate(currentYear, currentMonth, day), { weekday: "long", month: "long", day: "numeric" });
    setAgenda({ label, events: dayEvents });
  }

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="flex items-center gap-2 md:gap-4">
          <button type="button" aria-label="Previous month" onClick={() => changeMonth(-1)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-container-low)] text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container)]"><Icon name="chevron_left" size={20} /></button>
          <div className="min-w-0">
            <h2 className="text-2xl font-black tracking-tight text-[var(--color-on-surface)] md:text-4xl">{formatInZone(zonedDate(currentYear, currentMonth, 1), { month: "long", year: "numeric" })}</h2>
            <p className="mt-0.5 text-sm text-[var(--color-on-surface-variant)]">{weekCount} calendar item{weekCount === 1 ? "" : "s"} this week</p>
          </div>
          <button type="button" aria-label="Next month" onClick={() => changeMonth(1)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-container-low)] text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container)]"><Icon name="chevron_right" size={20} /></button>
          <button type="button" onClick={() => { setCurrentMonth(today.month); setCurrentYear(today.year); }} className="rounded-lg bg-[var(--color-primary-fixed)] px-3 py-1.5 text-sm font-bold text-[var(--color-on-primary-fixed-variant)]">Today</button>
        </div>
        <span className="text-xs text-[var(--color-text-muted)]">Click any calendar item to see its details</span>
      </div>

      <CalendarLegend
        colors={categoryColors}
        hidden={hiddenLayers}
        present={presentLayers}
        onToggle={toggleLayer}
        canCustomize={canCustomizeColors}
      />

      <div className="overflow-x-auto rounded-[var(--radius-xl)] bg-[var(--color-surface-container-low)] p-3 md:p-4">
        <div className="min-w-[760px]">
          <div className="mb-3 grid grid-cols-7">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <div key={day} className="py-2 text-center text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]">{day}</div>)}</div>
          <div className="grid grid-cols-7 gap-2 md:gap-3">{cells.map((cell) => <DayCell key={cell.key} day={cell.day} isCurrentMonth={cell.current} isToday={cell.today} events={cell.events} colors={categoryColors} onEvent={setSelectedEvent} onMore={() => openAgenda(cell.day, cell.events)} />)}</div>
        </div>
      </div>

      <section className="mt-8 rounded-[var(--radius-xl)] bg-[var(--color-surface-container-lowest)] p-5 md:p-6">
        <div className="mb-4 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)]"><Icon name="upcoming" size={20} /></span><div><h3 className="font-bold text-[var(--color-on-surface)]">Coming up</h3><p className="text-xs text-[var(--color-text-muted)]">Your next calendar items</p></div></div>
        {upcoming.length === 0 ? <p className="text-sm text-[var(--color-on-surface-variant)]">No upcoming events</p> : <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{upcoming.map((event) => <button type="button" key={event.id} onClick={() => setSelectedEvent(event)} className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] p-3 text-left hover:bg-[var(--color-surface-hover)]"><span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-[var(--color-primary-fixed)] text-[var(--color-on-primary-fixed-variant)]"><span className="text-[8px] font-bold uppercase">{formatInZone(new Date(event.date), { month: "short" })}</span><span className="text-lg font-black leading-none">{Number(event.dateKey.slice(8, 10))}</span></span><span className="min-w-0"><span className="block truncate text-sm font-bold text-[var(--color-on-surface)]">{event.name}</span><span className="block truncate text-xs text-[var(--color-on-surface-variant)]">{calendarEventTimeLabel(event, true)} · {calendarEventTypeLabel(event.type)}</span></span></button>)}</div>}
      </section>

      <Dialog open={!!agenda} onClose={() => setAgenda(null)} title={agenda?.label || "Day agenda"}>
        <div className="space-y-2">{agenda?.events.map((event) => <button type="button" key={event.id} onClick={() => { setAgenda(null); setSelectedEvent(event); }} className="flex w-full items-center gap-3 rounded-2xl border border-[var(--color-border)] p-3 text-left hover:bg-[var(--color-surface-hover)]"><span className={cn("h-3 w-3 shrink-0 rounded-full", calendarChipClass(event.type, categoryColors, event.color))} /><span className="min-w-0"><span className="block truncate text-sm font-bold text-[var(--color-text-primary)]">{event.name}</span><span className="block text-xs text-[var(--color-text-muted)]">{calendarEventTimeLabel(event, true)} · {calendarEventTypeLabel(event.type)}</span></span><Icon name="chevron_right" size={18} className="ml-auto text-[var(--color-text-muted)]" /></button>)}</div>
      </Dialog>
      <CalendarEventDetails event={selectedEvent} open={!!selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
}
