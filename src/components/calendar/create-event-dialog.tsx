"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { createCompanyEvent } from "@/lib/actions/company-events";

type Department = { id: string; name: string; employeeCount: number };
type Employee = { id: string; firstName: string; lastName: string; email: string; departmentId: string | null };

export function CreateEventDialog({
  departments,
  employees,
  connected,
}: {
  departments: Department[];
  employees: Employee[];
  connected: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"departments" | "people" | "everyone">("departments");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState("60");
  const [withMeet, setWithMeet] = useState(true);
  const [deptIds, setDeptIds] = useState<Set<string>>(new Set());
  const [empIds, setEmpIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; attendeeCount?: number; meetLink?: string | null; error?: string } | null>(null);
  const [peopleSearch, setPeopleSearch] = useState("");

  const attendeeCount = (() => {
    if (mode === "everyone") return employees.length;
    if (mode === "departments") {
      const set = new Set<string>();
      for (const e of employees) if (e.departmentId && deptIds.has(e.departmentId)) set.add(e.id);
      return set.size;
    }
    return empIds.size;
  })();

  function toggleDept(id: string) {
    const next = new Set(deptIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setDeptIds(next);
  }
  function toggleEmp(id: string) {
    const next = new Set(empIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setEmpIds(next);
  }

  async function handleSubmit() {
    if (!title.trim()) return;
    if (attendeeCount === 0) { alert("Select at least one attendee"); return; }
    setSending(true);
    setResult(null);
    const startTime = new Date(`${date}T${time}`).toISOString();
    const res = await createCompanyEvent({
      title: title.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      startTime,
      durationMinutes: parseInt(duration, 10) || 60,
      departmentIds: mode === "departments" ? Array.from(deptIds) : [],
      employeeIds: mode === "people" ? Array.from(empIds) : [],
      includeEveryone: mode === "everyone",
      withMeetLink: withMeet,
    });
    setSending(false);
    setResult(res);
    if (res.success) {
      router.refresh();
    }
  }

  function reset() {
    setTitle("");
    setDescription("");
    setLocation("");
    setDeptIds(new Set());
    setEmpIds(new Set());
    setResult(null);
    setMode("departments");
  }

  const input = cn(
    "w-full px-3 py-2 rounded-lg text-sm",
    "bg-[var(--color-background)] border border-[var(--color-border)]",
    "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]"
  );

  const filteredEmployees = peopleSearch.trim()
    ? employees.filter((e) => {
        const q = peopleSearch.toLowerCase();
        return `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) || e.email.toLowerCase().includes(q);
      })
    : employees;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={!connected}
        title={connected ? undefined : "Connect Google Calendar first"}
        className={cn(
          "inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium",
          connected
            ? "bg-[var(--color-accent)] text-white hover:opacity-90"
            : "bg-gray-200 text-gray-400 cursor-not-allowed"
        )}
      >
        <Icon name="event" size={16} />
        Create event
      </button>

      <Dialog open={open} onClose={() => { if (!sending) { setOpen(false); reset(); } }} title="Create calendar event">
        {result?.success ? (
          <div className="text-center py-6 space-y-3">
            <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
              <Icon name="check_circle" size={28} className="text-emerald-500" />
            </div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">Event created & invites sent</p>
            <p className="text-xs text-[var(--color-text-muted)]">
              {result.attendeeCount} attendee{result.attendeeCount !== 1 ? "s" : ""} — Google will email everyone automatically.
            </p>
            {result.meetLink && (
              <a href={result.meetLink} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--color-accent)] hover:underline break-all">
                {result.meetLink}
              </a>
            )}
            <div className="flex justify-center gap-2 pt-2">
              <button onClick={() => { setResult(null); reset(); }} className="px-4 py-2 rounded-lg text-sm bg-[var(--color-background)] border border-[var(--color-border)]">Create another</button>
              <button onClick={() => { setOpen(false); reset(); }} className="px-4 py-2 rounded-lg text-sm bg-[var(--color-accent)] text-white">Done</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="All-hands, team standup…" className={input} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Time</label>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={input} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Duration (min)</label>
                <input type="number" min={15} step={15} value={duration} onChange={(e) => setDuration(e.target.value)} className={input} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Location (optional)</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Conference room, address…" className={input} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Description (optional)</label>
              <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={input} />
            </div>

            <label className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
              <input type="checkbox" checked={withMeet} onChange={(e) => setWithMeet(e.target.checked)} className="h-3.5 w-3.5 rounded border-gray-300" />
              Add a Google Meet link
            </label>

            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Invite</label>
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)] mb-2">
                {(
                  [
                    { v: "departments", l: "By department" },
                    { v: "people", l: "Pick people" },
                    { v: "everyone", l: `Everyone (${employees.length})` },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setMode(opt.v)}
                    className={cn(
                      "flex-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                      mode === opt.v ? "bg-[var(--color-accent)] text-white" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                    )}
                  >{opt.l}</button>
                ))}
              </div>

              {mode === "departments" && (
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto rounded-lg border border-[var(--color-border)] p-2">
                  {departments.length === 0 && <p className="text-[11px] text-[var(--color-text-muted)] italic">No departments configured.</p>}
                  {departments.map((d) => (
                    <label key={d.id} className="flex items-center gap-2 cursor-pointer hover:bg-[var(--color-surface-hover)] rounded px-2 py-1 text-sm">
                      <input type="checkbox" checked={deptIds.has(d.id)} onChange={() => toggleDept(d.id)} className="h-3.5 w-3.5 rounded border-gray-300" />
                      <span className="text-[var(--color-text-primary)]">{d.name}</span>
                      <span className="text-[10px] text-[var(--color-text-muted)] ml-auto">{d.employeeCount} {d.employeeCount === 1 ? "person" : "people"}</span>
                    </label>
                  ))}
                </div>
              )}

              {mode === "people" && (
                <div>
                  <input
                    value={peopleSearch}
                    onChange={(e) => setPeopleSearch(e.target.value)}
                    placeholder="Search by name or email…"
                    className={cn(input, "mb-2 text-xs py-1.5")}
                  />
                  <div className="space-y-0.5 max-h-[220px] overflow-y-auto rounded-lg border border-[var(--color-border)] p-1">
                    {filteredEmployees.map((e) => (
                      <label key={e.id} className="flex items-center gap-2 cursor-pointer hover:bg-[var(--color-surface-hover)] rounded px-2 py-1 text-xs">
                        <input type="checkbox" checked={empIds.has(e.id)} onChange={() => toggleEmp(e.id)} className="h-3.5 w-3.5 rounded border-gray-300" />
                        <span className="text-[var(--color-text-primary)] truncate">{e.firstName} {e.lastName}</span>
                        <span className="text-[10px] text-[var(--color-text-muted)] ml-auto truncate">{e.email}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <p className="text-[11px] text-[var(--color-text-muted)]">
              {attendeeCount} attendee{attendeeCount !== 1 ? "s" : ""} selected
            </p>

            {result && !result.success && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-700">{result.error}</div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
              <button onClick={() => { setOpen(false); reset(); }} disabled={sending} className="px-4 py-2 rounded-lg text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] disabled:opacity-50">Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={sending || !title.trim() || attendeeCount === 0}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                {sending && <Icon name="progress_activity" size={14} className="animate-material-spin" />}
                Create & send invites
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
