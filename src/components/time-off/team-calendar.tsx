"use client";

import { cn, getInitials, formatDate } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { getTeamCalendar } from "@/lib/actions/time-off";
import { useRouter } from "next/navigation";

type CalendarEntry = {
  id: string;
  startDate: Date;
  endDate: Date;
  employee: { firstName: string; lastName: string };
  policy: { name: string };
};

const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500"];

export function TeamCalendar({ initialEntries, initialYear, initialMonth }: {
  initialEntries: CalendarEntry[];
  initialYear: number;
  initialMonth: number;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [loading, setLoading] = useState(false);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  async function navigate(direction: -1 | 1) {
    let newMonth = month + direction;
    let newYear = year;
    if (newMonth < 0) { newMonth = 11; newYear--; }
    if (newMonth > 11) { newMonth = 0; newYear++; }
    setLoading(true);
    const data = await getTeamCalendar(newYear, newMonth);
    setEntries(data as CalendarEntry[]);
    setMonth(newMonth);
    setYear(newYear);
    setLoading(false);
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate(-1)} disabled={loading} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-50">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{monthNames[month]} {year}</h3>
        <button onClick={() => navigate(1)} disabled={loading} className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-50">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-px mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-[var(--color-text-muted)] py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px">
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="h-8" />
        ))}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const date = new Date(year, month, day);
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          const dayEntries = entries.filter((e) => {
            const start = new Date(e.startDate);
            const end = new Date(e.endDate);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            return date >= start && date <= end;
          });

          return (
            <div
              key={day}
              className={cn(
                "h-8 flex items-center justify-center rounded text-xs relative",
                isWeekend ? "text-[var(--color-text-muted)]/50" : "text-[var(--color-text-primary)]",
                dayEntries.length > 0 && "bg-[var(--color-accent)]/10 font-medium text-[var(--color-accent)]"
              )}
              title={dayEntries.map((e) => `${e.employee.firstName} ${e.employee.lastName}`).join(", ")}
            >
              {day}
              {dayEntries.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[var(--color-accent)]" />
              )}
            </div>
          );
        })}
      </div>

      {/* Entries list below calendar */}
      {entries.length > 0 && (
        <div className="mt-4 space-y-2">
          {entries.map((entry) => {
            const initials = getInitials(entry.employee.firstName, entry.employee.lastName);
            const colorIdx = entry.employee.firstName.charCodeAt(0) % avatarColors.length;
            return (
              <div key={entry.id} className="flex items-center gap-2 text-sm">
                <div className={cn("h-6 w-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold", avatarColors[colorIdx])}>
                  {initials}
                </div>
                <span className="text-[var(--color-text-primary)]">{entry.employee.firstName} {entry.employee.lastName}</span>
                <span className="text-[var(--color-text-muted)]">·</span>
                <span className="text-[var(--color-text-muted)]">{formatDate(entry.startDate)} – {formatDate(entry.endDate)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
