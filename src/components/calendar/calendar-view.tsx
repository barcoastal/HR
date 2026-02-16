"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type CalendarEvent = {
  id: string;
  name: string;
  date: string; // ISO string
  type: "birthday" | "anniversary" | "benefits";
  department?: string;
  years?: number; // for anniversaries
};

type Props = {
  events: CalendarEvent[];
};

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const eventColors: Record<CalendarEvent["type"], { dot: string; bg: string; text: string; label: string }> = {
  birthday: { dot: "bg-amber-400", bg: "bg-amber-500/15", text: "text-amber-400", label: "Birthday" },
  anniversary: { dot: "bg-rose-400", bg: "bg-rose-500/15", text: "text-rose-400", label: "Anniversary" },
  benefits: { dot: "bg-emerald-400", bg: "bg-emerald-500/15", text: "text-emerald-400", label: "Benefits Eligible" },
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export function CalendarView({ events }: Props) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const monthName = new Date(currentYear, currentMonth).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
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

  // Events for the selected day
  const selectedDayEvents = selectedDay ? (eventsByDay[selectedDay] || []) : [];

  // This month's birthdays and anniversaries for the lists below
  const monthBirthdays = useMemo(
    () => events.filter((e) => {
      const d = new Date(e.date);
      return e.type === "birthday" && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).sort((a, b) => new Date(a.date).getDate() - new Date(b.date).getDate()),
    [events, currentMonth, currentYear]
  );

  const monthAnniversaries = useMemo(
    () => events.filter((e) => {
      const d = new Date(e.date);
      return e.type === "anniversary" && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).sort((a, b) => new Date(a.date).getDate() - new Date(b.date).getDate()),
    [events, currentMonth, currentYear]
  );

  const monthBenefits = useMemo(
    () => events.filter((e) => {
      const d = new Date(e.date);
      return e.type === "benefits" && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).sort((a, b) => new Date(a.date).getDate() - new Date(b.date).getDate()),
    [events, currentMonth, currentYear]
  );

  function goToPrevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
    setSelectedDay(null);
  }

  function goToNextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
    setSelectedDay(null);
  }

  function goToToday() {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
    setSelectedDay(null);
  }

  const isToday = (day: number) =>
    day === today.getDate() &&
    currentMonth === today.getMonth() &&
    currentYear === today.getFullYear();

  const isCurrentMonth =
    currentMonth === today.getMonth() && currentYear === today.getFullYear();

  // Build the calendar grid cells
  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);
  // Pad remaining cells to fill last row
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={goToPrevMonth}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              "border border-[var(--color-border)] bg-[var(--color-surface)]",
              "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]",
              "transition-colors duration-200"
            )}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] min-w-[180px] text-center">
            {monthName}
          </h2>
          <button
            onClick={goToNextMonth}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              "border border-[var(--color-border)] bg-[var(--color-surface)]",
              "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]",
              "transition-colors duration-200"
            )}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {!isCurrentMonth && (
          <button
            onClick={goToToday}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium",
              "border border-[var(--color-border)] bg-[var(--color-surface)]",
              "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]",
              "transition-colors duration-200"
            )}
          >
            Today
          </button>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4">
        {Object.entries(eventColors).map(([type, config]) => (
          <div key={type} className="flex items-center gap-1.5">
            <div className={cn("h-2.5 w-2.5 rounded-full", config.dot)} />
            <span className="text-xs text-[var(--color-text-muted)]">{config.label}</span>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className={cn("rounded-xl overflow-hidden", "border border-[var(--color-border)]")}>
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-[var(--color-surface)]">
          {DAYS_OF_WEEK.map((day) => (
            <div
              key={day}
              className="px-2 py-2.5 text-center text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {calendarCells.map((day, idx) => {
            const dayEvents = day ? (eventsByDay[day] || []) : [];
            const todayHighlight = day !== null && isToday(day);
            const isSelected = day !== null && day === selectedDay;

            return (
              <button
                key={idx}
                disabled={day === null}
                onClick={() => day !== null && setSelectedDay(day === selectedDay ? null : day)}
                className={cn(
                  "relative flex flex-col items-center min-h-[72px] p-1.5 border-t border-r border-[var(--color-border)]",
                  "transition-colors duration-150",
                  day === null
                    ? "bg-[var(--color-background)] cursor-default"
                    : "bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] cursor-pointer",
                  isSelected && "bg-[var(--color-accent)]/5",
                  // Remove right border on last column
                  idx % 7 === 6 && "border-r-0"
                )}
              >
                {day !== null && (
                  <>
                    <span
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium",
                        todayHighlight
                          ? "bg-[var(--color-accent)] text-white ring-2 ring-[var(--color-accent)]/30"
                          : "text-[var(--color-text-primary)]"
                      )}
                    >
                      {day}
                    </span>
                    {dayEvents.length > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        {/* Deduplicate event types for dots */}
                        {Array.from(new Set(dayEvents.map((e) => e.type))).map((type) => (
                          <div
                            key={type}
                            className={cn("h-1.5 w-1.5 rounded-full", eventColors[type].dot)}
                          />
                        ))}
                      </div>
                    )}
                    {dayEvents.length > 0 && (
                      <span className="text-[9px] text-[var(--color-text-muted)] mt-0.5">
                        {dayEvents.length}
                      </span>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Events */}
      {selectedDay !== null && selectedDayEvents.length > 0 && (
        <div className={cn("mt-4 rounded-xl p-4", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
            Events on {new Date(currentYear, currentMonth, selectedDay).toLocaleDateString("en-US", { month: "long", day: "numeric" })}
          </h3>
          <div className="space-y-2">
            {selectedDayEvents.map((event) => {
              const config = eventColors[event.type];
              return (
                <div
                  key={event.id}
                  className={cn("flex items-center justify-between rounded-lg px-3 py-2", config.bg)}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn("h-2 w-2 rounded-full", config.dot)} />
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">{event.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {event.department && (
                      <span className="text-xs text-[var(--color-text-muted)]">{event.department}</span>
                    )}
                    <span className={cn("text-xs font-medium", config.text)}>
                      {event.type === "anniversary" && event.years !== undefined
                        ? `${event.years} yr${event.years !== 1 ? "s" : ""}`
                        : config.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly Summary Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Birthdays */}
        <div className={cn("rounded-xl p-5", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
          <div className="flex items-center gap-2 mb-4">
            <div className={cn("h-2.5 w-2.5 rounded-full", eventColors.birthday.dot)} />
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Birthdays This Month
            </h3>
            <span className="ml-auto text-xs text-[var(--color-text-muted)]">{monthBirthdays.length}</span>
          </div>
          {monthBirthdays.length > 0 ? (
            <div className="space-y-2.5">
              {monthBirthdays.map((b) => (
                <div key={b.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{b.name}</p>
                    {b.department && (
                      <p className="text-xs text-[var(--color-text-muted)]">{b.department}</p>
                    )}
                  </div>
                  <span className="text-xs text-amber-400 font-medium">
                    {new Date(b.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">No birthdays this month</p>
          )}
        </div>

        {/* Anniversaries */}
        <div className={cn("rounded-xl p-5", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
          <div className="flex items-center gap-2 mb-4">
            <div className={cn("h-2.5 w-2.5 rounded-full", eventColors.anniversary.dot)} />
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Anniversaries This Month
            </h3>
            <span className="ml-auto text-xs text-[var(--color-text-muted)]">{monthAnniversaries.length}</span>
          </div>
          {monthAnniversaries.length > 0 ? (
            <div className="space-y-2.5">
              {monthAnniversaries.map((a) => (
                <div key={a.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{a.name}</p>
                    {a.department && (
                      <p className="text-xs text-[var(--color-text-muted)]">{a.department}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-rose-400 font-medium">
                      {a.years !== undefined ? `${a.years} yr${a.years !== 1 ? "s" : ""}` : ""}
                    </span>
                    <p className="text-[10px] text-[var(--color-text-muted)]">
                      {new Date(a.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">No anniversaries this month</p>
          )}
        </div>

        {/* Benefits Eligibility */}
        <div className={cn("rounded-xl p-5", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
          <div className="flex items-center gap-2 mb-4">
            <div className={cn("h-2.5 w-2.5 rounded-full", eventColors.benefits.dot)} />
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Benefits Eligible This Month
            </h3>
            <span className="ml-auto text-xs text-[var(--color-text-muted)]">{monthBenefits.length}</span>
          </div>
          {monthBenefits.length > 0 ? (
            <div className="space-y-2.5">
              {monthBenefits.map((b) => (
                <div key={b.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{b.name}</p>
                    {b.department && (
                      <p className="text-xs text-[var(--color-text-muted)]">{b.department}</p>
                    )}
                  </div>
                  <span className="text-xs text-emerald-400 font-medium">
                    {new Date(b.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">No benefits dates this month</p>
          )}
        </div>
      </div>
    </div>
  );
}
