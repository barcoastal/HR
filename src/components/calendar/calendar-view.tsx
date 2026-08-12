"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { Dialog } from "@/components/ui/dialog";
import { CalendarEventDetails } from "@/components/calendar/calendar-event-details";

export type CalendarEvent = {
  id: string;
  name: string;
  date: string;
  type: "birthday" | "anniversary" | "benefits" | "interview" | "holiday-jewish" | "holiday-muslim" | "holiday-christian" | "holiday-american" | "feed-event" | "google-calendar" | "performance-review" | "one-on-one" | "training" | "out-of-office" | "working-remotely";
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
  sourceKind?: "company" | "training" | "one-on-one" | "review" | "out-of-office" | "google";
  groupName?: string;
};

type Props = { events: CalendarEvent[] };

const chipStyles: Record<string, string> = {
  birthday: "bg-[var(--color-tertiary-container)]/15 text-[var(--color-tertiary)]",
  anniversary: "bg-[var(--color-tertiary-fixed)] text-[var(--color-on-tertiary-fixed-variant)]",
  interview: "bg-[var(--color-primary)]/10 text-[var(--color-primary)]",
  benefits: "bg-[var(--color-primary-fixed)] text-[var(--color-on-primary-fixed-variant)]",
  "feed-event": "bg-blue-500/10 text-blue-700",
  "google-calendar": "bg-emerald-500/10 text-emerald-700",
  "performance-review": "bg-purple-500/10 text-purple-700",
  "one-on-one": "bg-fuchsia-500/10 text-fuchsia-700",
  training: "bg-indigo-500/10 text-indigo-700",
  "out-of-office": "bg-amber-500/15 text-amber-800",
  "working-remotely": "bg-cyan-500/15 text-cyan-800",
};

const holidayStyle = "bg-[var(--color-error-container)]/20 text-[var(--color-on-error-container)]";

function getChipStyle(type: CalendarEvent["type"]) {
  return type.startsWith("holiday-")
    ? holidayStyle
    : chipStyles[type] || "bg-[var(--color-surface-container)] text-[var(--color-on-surface-variant)]";
}

export function calendarEventTypeLabel(type: CalendarEvent["type"]) {
  if (type === "birthday") return "Birthday";
  if (type === "anniversary") return "Anniversary";
  if (type === "benefits") return "Benefits eligible";
  if (type === "interview") return "Interview";
  if (type === "feed-event") return "Company event";
  if (type === "google-calendar") return "Google Calendar";
  if (type === "performance-review") return "Review due";
  if (type === "one-on-one") return "1:1 meeting";
  if (type === "training") return "Training";
  if (type === "out-of-office") return "Out of office";
  if (type === "working-remotely") return "Working remotely";
  if (type.startsWith("holiday-")) return "Holiday";
  return "Event";
}

function clockLabel(date: Date, compact = false) {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    ...(compact && date.getMinutes() === 0 ? {} : { minute: "2-digit" }),
  });
}

export function calendarEventTimeLabel(event: CalendarEvent, includeEnd = false) {
  if (event.allDay) return "All day";
  const start = new Date(event.date);
  if (Number.isNaN(start.getTime())) return event.time || "Time not set";
  if (includeEnd && event.endDate) {
    const end = new Date(event.endDate);
    const sameDay = !Number.isNaN(end.getTime()) && start.toDateString() === end.toDateString();
    if (sameDay && end.getTime() > start.getTime()) {
      return `${clockLabel(start)} – ${clockLabel(end)}`;
    }
  }
  return event.time || clockLabel(start, true);
}

function EventChip({ event, isToday, index, onClick }: {
  event: CalendarEvent;
  isToday: boolean;
  index: number;
  onClick: () => void;
}) {
  const time = calendarEventTimeLabel(event);
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${time}, ${calendarEventTypeLabel(event.type)}: ${event.name}`}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-full px-2 py-1 text-left text-[10px] font-bold transition-opacity hover:opacity-75 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40",
        isToday && index === 0 ? "bg-[var(--color-primary)] text-white" : getChipStyle(event.type)
      )}
    >
      <span className="shrink-0 font-black">{time}</span>
      <span aria-hidden="true" className="shrink-0 opacity-45">·</span>
      <span className="truncate">{event.name}</span>
    </button>
  );
}

function DayCell({ day, isCurrentMonth, isToday, events, onEvent, onMore }: {
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
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
      {visibleEvents.map((event, index) => <EventChip key={event.id} event={event} isToday={isToday} index={index} onClick={() => onEvent(event)} />)}
      {overflow > 0 && (
        <button type="button" onClick={onMore} className="w-fit rounded px-1 text-[10px] font-bold text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container)] hover:text-[var(--color-primary)]">
          +{overflow} more
        </button>
      )}
    </div>
  );
}

function monthData(year: number, month: number) {
  return {
    days: new Date(year, month + 1, 0).getDate(),
    firstOffset: (new Date(year, month, 1).getDay() + 6) % 7,
  };
}

export function CalendarView({ events }: Props) {
  const today = useMemo(() => new Date(), []);
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [agenda, setAgenda] = useState<{ label: string; events: CalendarEvent[] } | null>(null);
  const data = monthData(currentYear, currentMonth);

  const eventsByDay = useMemo(() => {
    const map: Record<number, CalendarEvent[]> = {};
    for (const event of events) {
      const date = new Date(event.date);
      if (date.getMonth() !== currentMonth || date.getFullYear() !== currentYear) continue;
      (map[date.getDate()] ||= []).push(event);
    }
    for (const values of Object.values(map)) values.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    return map;
  }, [events, currentMonth, currentYear]);

  function changeMonth(direction: -1 | 1) {
    const next = new Date(currentYear, currentMonth + direction, 1);
    setCurrentMonth(next.getMonth());
    setCurrentYear(next.getFullYear());
  }

  type Cell = { key: string; day: number; current: boolean; today: boolean; events: CalendarEvent[] };
  const cells: Cell[] = [];
  const previous = new Date(currentYear, currentMonth, 0).getDate();
  for (let index = data.firstOffset - 1; index >= 0; index--) cells.push({ key: `prev-${index}`, day: previous - index, current: false, today: false, events: [] });
  for (let day = 1; day <= data.days; day++) cells.push({
    key: `day-${day}`,
    day,
    current: true,
    today: day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear(),
    events: eventsByDay[day] || [],
  });
  let nextDay = 1;
  while (cells.length % 7) cells.push({ key: `next-${nextDay}`, day: nextDay++, current: false, today: false, events: [] });

  const weekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7);
  const weekCount = events.filter((event) => {
    const date = new Date(event.date);
    return date >= weekStart && date < weekEnd;
  }).length;
  const upcoming = useMemo(() => {
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    return [...events].filter((event) => new Date(event.date).getTime() >= start).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 4);
  }, [events, today]);

  function openAgenda(day: number, dayEvents: CalendarEvent[]) {
    const label = new Date(currentYear, currentMonth, day).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    setAgenda({ label, events: dayEvents });
  }

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="flex items-center gap-2 md:gap-4">
          <button type="button" aria-label="Previous month" onClick={() => changeMonth(-1)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-container-low)] text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container)]"><Icon name="chevron_left" size={20} /></button>
          <div className="min-w-0">
            <h2 className="text-2xl font-black tracking-tight text-[var(--color-on-surface)] md:text-4xl">{new Date(currentYear, currentMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</h2>
            <p className="mt-0.5 text-sm text-[var(--color-on-surface-variant)]">{weekCount} calendar item{weekCount === 1 ? "" : "s"} this week</p>
          </div>
          <button type="button" aria-label="Next month" onClick={() => changeMonth(1)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-container-low)] text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container)]"><Icon name="chevron_right" size={20} /></button>
          <button type="button" onClick={() => { setCurrentMonth(today.getMonth()); setCurrentYear(today.getFullYear()); }} className="rounded-lg bg-[var(--color-primary-fixed)] px-3 py-1.5 text-sm font-bold text-[var(--color-on-primary-fixed-variant)]">Today</button>
        </div>
        <span className="text-xs text-[var(--color-text-muted)]">Click any calendar item to see its details</span>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-xl)] bg-[var(--color-surface-container-low)] p-3 md:p-4">
        <div className="min-w-[760px]">
          <div className="mb-3 grid grid-cols-7">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <div key={day} className="py-2 text-center text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)]">{day}</div>)}</div>
          <div className="grid grid-cols-7 gap-2 md:gap-3">{cells.map((cell) => <DayCell key={cell.key} day={cell.day} isCurrentMonth={cell.current} isToday={cell.today} events={cell.events} onEvent={setSelectedEvent} onMore={() => openAgenda(cell.day, cell.events)} />)}</div>
        </div>
      </div>

      <section className="mt-8 rounded-[var(--radius-xl)] bg-[var(--color-surface-container-lowest)] p-5 md:p-6">
        <div className="mb-4 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)]"><Icon name="upcoming" size={20} /></span><div><h3 className="font-bold text-[var(--color-on-surface)]">Coming up</h3><p className="text-xs text-[var(--color-text-muted)]">Your next calendar items</p></div></div>
        {upcoming.length === 0 ? <p className="text-sm text-[var(--color-on-surface-variant)]">No upcoming events</p> : <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{upcoming.map((event) => <button type="button" key={event.id} onClick={() => setSelectedEvent(event)} className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] p-3 text-left hover:bg-[var(--color-surface-hover)]"><span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-[var(--color-primary-fixed)] text-[var(--color-on-primary-fixed-variant)]"><span className="text-[8px] font-bold uppercase">{new Date(event.date).toLocaleString("en-US", { month: "short" })}</span><span className="text-lg font-black leading-none">{new Date(event.date).getDate()}</span></span><span className="min-w-0"><span className="block truncate text-sm font-bold text-[var(--color-on-surface)]">{event.name}</span><span className="block truncate text-xs text-[var(--color-on-surface-variant)]">{calendarEventTimeLabel(event, true)} · {calendarEventTypeLabel(event.type)}</span></span></button>)}</div>}
      </section>

      <Dialog open={!!agenda} onClose={() => setAgenda(null)} title={agenda?.label || "Day agenda"}>
        <div className="space-y-2">{agenda?.events.map((event) => <button type="button" key={event.id} onClick={() => { setAgenda(null); setSelectedEvent(event); }} className="flex w-full items-center gap-3 rounded-2xl border border-[var(--color-border)] p-3 text-left hover:bg-[var(--color-surface-hover)]"><span className={cn("h-3 w-3 shrink-0 rounded-full", getChipStyle(event.type))} /><span className="min-w-0"><span className="block truncate text-sm font-bold text-[var(--color-text-primary)]">{event.name}</span><span className="block text-xs text-[var(--color-text-muted)]">{calendarEventTimeLabel(event, true)} · {calendarEventTypeLabel(event.type)}</span></span><Icon name="chevron_right" size={18} className="ml-auto text-[var(--color-text-muted)]" /></button>)}</div>
      </Dialog>
      <CalendarEventDetails event={selectedEvent} open={!!selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
}
