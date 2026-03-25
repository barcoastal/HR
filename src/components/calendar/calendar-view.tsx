"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { FAB } from "@/components/ui/fab";

export type CalendarEvent = {
  id: string;
  name: string;
  date: string; // ISO string
  type: "birthday" | "anniversary" | "benefits" | "interview" | "holiday-jewish" | "holiday-muslim" | "holiday-christian" | "holiday-american" | "feed-event" | "google-calendar" | "performance-review";
  department?: string;
  years?: number;
  meetLink?: string | null;
  time?: string;
  endDate?: string;
  location?: string;
};

type Props = {
  events: CalendarEvent[];
};

type DayCellProps = {
  key: string;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const chipStyles: Record<string, string> = {
  birthday: "bg-[var(--color-tertiary-container)]/10 text-[var(--color-tertiary)]",
  anniversary: "bg-[var(--color-tertiary-fixed)] text-[var(--color-on-tertiary-fixed-variant)]",
  interview: "bg-[var(--color-primary)]/10 text-[var(--color-primary)]",
  benefits: "bg-[var(--color-primary-fixed)] text-[var(--color-on-primary-fixed-variant)]",
  "feed-event": "bg-blue-500/10 text-blue-600",
  "google-calendar": "bg-emerald-500/10 text-emerald-600",
  "performance-review": "bg-purple-500/10 text-purple-600",
};

const holidayStyle = "bg-[var(--color-error-container)]/20 text-[var(--color-on-error-container)]";

function getChipStyle(type: CalendarEvent["type"]): string {
  if (type.startsWith("holiday-")) return holidayStyle;
  return chipStyles[type] ?? "bg-[var(--color-surface-container)] text-[var(--color-on-surface-variant)]";
}

function chipIconForType(type: CalendarEvent["type"]): string {
  if (type === "birthday") return "Birthday";
  if (type === "anniversary") return "Anniversary";
  if (type === "benefits") return "Benefits Eligible";
  if (type === "interview") return "Interview";
  if (type.startsWith("holiday-")) {
    const sub = type.replace("holiday-", "");
    return sub.charAt(0).toUpperCase() + sub.slice(1) + " Holiday";
  }
  if (type === "feed-event") return "Event";
  if (type === "google-calendar") return "Google Calendar";
  if (type === "performance-review") return "Review Due";
  return type;
}

function EventChip({ event, isToday, index }: { event: CalendarEvent; isToday: boolean; index: number }) {
  const baseClass = cn(
    "text-[10px] font-bold px-2 py-0.5 rounded-full truncate max-w-full",
    isToday
      ? index === 0
        ? "bg-[var(--color-primary)] text-white"
        : "bg-white/50 text-[var(--color-primary)]"
      : getChipStyle(event.type)
  );

  const label = event.time ? `${event.time} ${event.name}` : event.name;

  if (event.type === "interview" && event.meetLink) {
    return (
      <a
        href={event.meetLink}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(baseClass, "cursor-pointer hover:opacity-80 transition-opacity")}
        onClick={(e) => e.stopPropagation()}
      >
        {label}
      </a>
    );
  }

  return <span className={baseClass}>{label}</span>;
}

function DayCell({ day, isCurrentMonth, isToday, events }: Omit<DayCellProps, "key">) {
  const maxChips = 2;
  const visibleEvents = events.slice(0, maxChips);
  const overflow = events.length - maxChips;

  return (
    <div
      className={cn(
        "min-h-[120px] rounded-2xl p-4 flex flex-col gap-2",
        !isCurrentMonth && "opacity-40",
        isToday
          ? "bg-[var(--color-primary-fixed)] border-2 border-[var(--color-primary)]/20"
          : "bg-[var(--color-surface-container-lowest)]"
      )}
    >
      <div className="flex justify-between items-start">
        <span
          className={cn(
            "text-sm font-bold",
            isToday ? "font-black text-[var(--color-primary)]" : "text-[var(--color-on-surface)]"
          )}
        >
          {day}
        </span>
        {isToday && (
          <span className="bg-[var(--color-primary)] text-white text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase">
            Today
          </span>
        )}
      </div>
      {visibleEvents.map((evt, i) => (
        <EventChip key={evt.id} event={evt} isToday={isToday} index={i} />
      ))}
      {overflow > 0 && (
        <span className="text-[10px] font-bold text-[var(--color-on-surface-variant)]">
          +{overflow} more
        </span>
      )}
    </div>
  );
}

export function CalendarView({ events }: Props) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);

  const monthNameOnly = new Date(currentYear, currentMonth).toLocaleDateString("en-US", {
    month: "long",
  });

  // Map events by day-of-month for the current view
  const eventsByDay = useMemo(() => {
    const map: Record<number, CalendarEvent[]> = {};
    for (const event of events) {
      const d = new Date(event.date);
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(event);
      }
    }
    return map;
  }, [events, currentMonth, currentYear]);

  function goToPrevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  }

  function goToNextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  }

  function goToToday() {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
  }

  const isTodayCheck = (day: number) =>
    day === today.getDate() &&
    currentMonth === today.getMonth() &&
    currentYear === today.getFullYear();

  // Monday start: adjust first day offset
  // getDay() returns 0=Sun, 1=Mon ... 6=Sat
  // We want Mon=0, so: (getDay() + 6) % 7
  const adjustedFirstDay = (getFirstDayOfMonth(currentYear, currentMonth) + 6) % 7;

  // Days from previous month to fill padding
  const prevMonthDays = getDaysInMonth(
    currentMonth === 0 ? currentYear - 1 : currentYear,
    currentMonth === 0 ? 11 : currentMonth - 1
  );

  // Build the calendar cells
  type Cell = {
    key: string;
    day: number;
    isCurrentMonth: boolean;
    isToday: boolean;
    events: CalendarEvent[];
  };

  const cells: Cell[] = [];

  // Padding cells from previous month
  for (let i = adjustedFirstDay - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    cells.push({
      key: `prev-${day}`,
      day,
      isCurrentMonth: false,
      isToday: false,
      events: [],
    });
  }

  // Current month cells
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      key: `cur-${d}`,
      day: d,
      isCurrentMonth: true,
      isToday: isTodayCheck(d),
      events: eventsByDay[d] || [],
    });
  }

  // Padding cells from next month to fill last row
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    cells.push({
      key: `next-${nextDay}`,
      day: nextDay,
      isCurrentMonth: false,
      isToday: false,
      events: [],
    });
    nextDay++;
  }

  // Current week milestone count subtitle
  const weekStart = new Date(today);
  const dayOfWeek = (today.getDay() + 6) % 7; // Monday = 0
  weekStart.setDate(today.getDate() - dayOfWeek);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const weekMilestoneCount = events.filter((e) => {
    const d = new Date(e.date);
    return d >= weekStart && d <= weekEnd;
  }).length;

  // Upcoming events from today
  const upcomingEvents = useMemo(() => {
    const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    return events
      .filter((e) => new Date(e.date).getTime() >= todayMs)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 3);
  }, [events]);

  return (
    <div>
      {/* Editorial header with month navigation */}
      <div className="flex justify-between items-end mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={goToPrevMonth}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-surface-container-low)] text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container)] transition-colors"
          >
            <Icon name="chevron_left" size={20} />
          </button>
          <div>
            <h2 className="text-4xl font-black tracking-tight text-[var(--color-on-surface)]">
              {monthNameOnly} {currentYear}
            </h2>
            {weekMilestoneCount > 0 && (
              <p className="text-sm text-[var(--color-on-surface-variant)] mt-0.5">
                {weekMilestoneCount} milestone{weekMilestoneCount !== 1 ? "s" : ""} this week
              </p>
            )}
          </div>
          <button
            onClick={goToNextMonth}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-surface-container-low)] text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container)] transition-colors"
          >
            <Icon name="chevron_right" size={20} />
          </button>
          <button
            onClick={goToToday}
            className="ml-2 px-3 py-1 bg-[var(--color-primary-fixed)] text-[var(--color-on-primary-fixed-variant)] rounded-lg text-sm font-bold hover:opacity-90 transition-opacity"
          >
            Today
          </button>
        </div>
        <div className="flex items-center bg-[var(--color-surface-container-low)] p-1 rounded-xl">
          <button className="px-4 py-2 rounded-lg bg-[var(--color-surface-container-lowest)] text-[var(--color-primary)] font-bold shadow-sm">
            Month
          </button>
          <button className="px-4 py-2 rounded-lg text-[var(--color-on-surface-variant)] font-semibold opacity-50 cursor-not-allowed">
            Week
          </button>
          <button className="px-4 py-2 rounded-lg text-[var(--color-on-surface-variant)] font-semibold opacity-50 cursor-not-allowed">
            Day
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-[var(--color-surface-container-low)] rounded-[var(--radius-xl)] p-4 mt-8">
        {/* Day headers — Monday start */}
        <div className="grid grid-cols-7 mb-4">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div
              key={d}
              className="text-center text-[10px] font-black uppercase tracking-widest text-[var(--color-outline)] py-2"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-3">
          {cells.map((cell) => (
            <DayCell
              key={cell.key}
              day={cell.day}
              isCurrentMonth={cell.isCurrentMonth}
              isToday={cell.isToday}
              events={cell.events}
            />
          ))}
        </div>
      </div>

      {/* Contextual Insights section */}
      <div className="grid grid-cols-3 gap-6 mt-8">
        {/* Upcoming Highlights panel */}
        <div className="glass rounded-[var(--radius-xl)] p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)]">
              <Icon name="auto_awesome" size={20} />
            </div>
            <h3 className="font-bold text-lg text-[var(--color-on-surface)]">Upcoming Highlights</h3>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="text-sm text-[var(--color-on-surface-variant)]">No upcoming events</p>
          ) : (
            upcomingEvents.map((evt) => (
              <div key={evt.id} className="flex items-center gap-4">
                <div className="w-12 h-14 rounded-xl bg-[var(--color-primary-fixed)] flex flex-col items-center justify-center overflow-hidden shrink-0">
                  <div className="w-full bg-[var(--color-primary)] text-white text-[8px] font-bold text-center py-0.5">
                    {new Date(evt.date).toLocaleString("default", { month: "short" }).toUpperCase()}
                  </div>
                  <span className="text-lg font-black text-[var(--color-on-primary-fixed-variant)]">
                    {new Date(evt.date).getDate()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm text-[var(--color-on-surface)] truncate">{evt.name}</p>
                  <p className="text-xs text-[var(--color-on-surface-variant)]">{chipIconForType(evt.type)}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Promo card */}
        <div className="col-span-2 bg-[var(--color-inverse-surface)] rounded-[var(--radius-xl)] p-8 relative overflow-hidden flex items-center">
          <div className="relative z-10 space-y-4 max-w-md">
            <span className="bg-[var(--color-primary)]/20 text-[var(--color-primary-fixed-dim)] text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full inline-block">
              Pro Tip
            </span>
            <h3 className="text-2xl font-black text-white leading-tight">
              Sync your calendar with Google or Outlook.
            </h3>
            <p className="text-[var(--color-surface-variant)]/70 text-sm">
              Keep your professional and personal life in perfect harmony.
            </p>
            <button className="bg-[var(--color-surface)] text-[var(--color-on-surface)] px-6 py-2.5 rounded-xl font-bold text-sm hover:scale-105 transition-transform">
              Enable Sync Now
            </button>
          </div>
          <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-[var(--color-primary)]/30 to-transparent" />
          <Icon
            name="calendar_month"
            size={200}
            className="absolute -right-10 -bottom-10 text-white/5 rotate-12"
          />
        </div>
      </div>

      <FAB icon="event" variant="solid" />
    </div>
  );
}
