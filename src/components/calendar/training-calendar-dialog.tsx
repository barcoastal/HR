"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { cn, displayName } from "@/lib/utils";
import {
  cancelTrainingClass,
  createTrainingClass,
  deleteTrainingGroup,
  saveTrainingGroup,
  updateTrainingClass,
} from "@/lib/actions/training-calendar";

type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  email: string;
  calendarConnected: boolean;
};

type TrainingGroup = {
  id: string;
  name: string;
  description: string | null;
  members: { employeeId: string; role: "TRAINER" | "TRAINEE" | "VIEWER" }[];
};

type TrainingClass = {
  id: string;
  title: string;
  agenda: string | null;
  location: string | null;
  organizerId: string;
  groupId: string | null;
  attendeeEmployeeIds: string;
  viewerEmployeeIds: string | null;
  rangeStart: string;
  rangeEnd: string;
  startTime: string;
  endTime: string;
  weekdays: string;
  withMeetLink: boolean;
  status: "ACTIVE" | "CANCELLED";
  sessions: { id: string; startAt: string; endAt: string; status: "SCHEDULED" | "CANCELLED" }[];
  organizer: { firstName: string; lastName: string; preferredName?: string | null };
  group: { id: string; name: string } | null;
};

const fieldClass = cn(
  "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm",
  "text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
);

const WEEKDAYS = [
  { value: 1, label: "Mon" }, { value: 2, label: "Tue" }, { value: 3, label: "Wed" },
  { value: 4, label: "Thu" }, { value: 5, label: "Fri" }, { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

function localDate(value = new Date()) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function parseIds(value: string | null) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function parseWeekdays(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
      : [];
  } catch {
    return [];
  }
}

function durationMinutes(start: string, end: string) {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  return Math.max(15, (endHour * 60 + endMinute) - (startHour * 60 + startMinute));
}

function buildSessions(startDate: string, endDate: string, startTime: string, weekdays: Set<number>) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
  const values: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end && values.length <= 60) {
    if (weekdays.has(cursor.getDay())) {
      values.push(new Date(`${localDate(cursor)}T${startTime}:00`).toISOString());
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return values;
}

function Picker({ title, employees, selected, onChange, connectedOnly = false }: {
  title: string;
  employees: Employee[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  connectedOnly?: boolean;
}) {
  const [search, setSearch] = useState("");
  const filtered = employees.filter((employee) => {
    if (connectedOnly && !employee.calendarConnected) return false;
    const query = search.toLowerCase();
    return !query || `${displayName(employee)} ${employee.email}`.toLowerCase().includes(query);
  });
  return (
    <div>
      <div className="mb-1 flex items-center justify-between"><label className="text-xs font-semibold text-[var(--color-text-primary)]">{title}</label><span className="text-[10px] text-[var(--color-text-muted)]">{selected.size} selected</span></div>
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people" className={cn(fieldClass, "mb-1.5 py-1.5 text-xs")} />
      <div className="max-h-32 space-y-0.5 overflow-y-auto rounded-xl border border-[var(--color-border)] p-1">
        {filtered.map((employee) => <label key={employee.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-[var(--color-surface-hover)]"><input type="checkbox" checked={selected.has(employee.id)} onChange={() => { const next = new Set(selected); if (next.has(employee.id)) next.delete(employee.id); else next.add(employee.id); onChange(next); }} /><span className="truncate text-[var(--color-text-primary)]">{displayName(employee)}</span>{employee.calendarConnected && <Icon name="event_available" size={14} className="ml-auto text-emerald-600" />}</label>)}
        {filtered.length === 0 && <p className="px-2 py-3 text-center text-xs text-[var(--color-text-muted)]">No matching employees</p>}
      </div>
    </div>
  );
}

export function TrainingCalendarDialog({ employees, groups, classes }: {
  employees: Employee[];
  groups: TrainingGroup[];
  classes: TrainingClass[];
}) {
  const router = useRouter();
  const today = localDate();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"schedule" | "groups" | "manage">("schedule");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [agenda, setAgenda] = useState("");
  const [location, setLocation] = useState("");
  const [groupId, setGroupId] = useState("");
  const [trainerId, setTrainerId] = useState("");
  const [traineeIds, setTraineeIds] = useState<Set<string>>(new Set());
  const [viewerIds, setViewerIds] = useState<Set<string>>(new Set());
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [weekdays, setWeekdays] = useState<Set<number>>(new Set([new Date(`${today}T00:00:00`).getDay()]));
  const [withMeet, setWithMeet] = useState(true);
  const [visibleManagers, setVisibleManagers] = useState(true);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupTrainers, setGroupTrainers] = useState<Set<string>>(new Set());
  const [groupTrainees, setGroupTrainees] = useState<Set<string>>(new Set());
  const [groupViewers, setGroupViewers] = useState<Set<string>>(new Set());

  const sessionStarts = useMemo(() => buildSessions(startDate, endDate, startTime, weekdays), [startDate, endDate, startTime, weekdays]);

  function clearMessages() { setError(null); setSuccess(null); }
  function resetSchedule() {
    const date = localDate();
    setEditingClassId(null); setTitle(""); setAgenda(""); setLocation(""); setGroupId(""); setTrainerId("");
    setTraineeIds(new Set()); setViewerIds(new Set()); setStartDate(date); setEndDate(date); setStartTime("09:00"); setEndTime("10:00");
    setWeekdays(new Set([new Date(`${date}T00:00:00`).getDay()])); setWithMeet(true); setVisibleManagers(true); clearMessages();
  }

  function selectGroup(id: string) {
    setGroupId(id);
    const group = groups.find((item) => item.id === id);
    if (!group) return;
    const trainers = group.members.filter((member) => member.role === "TRAINER").map((member) => member.employeeId);
    setTrainerId(trainers.find((id) => employees.find((employee) => employee.id === id)?.calendarConnected) || trainers[0] || "");
    setTraineeIds(new Set(group.members.filter((member) => member.role === "TRAINEE").map((member) => member.employeeId)));
    setViewerIds(new Set(group.members.filter((member) => member.role === "VIEWER").map((member) => member.employeeId)));
  }

  async function submitClass() {
    clearMessages();
    if (!title.trim() || !trainerId || traineeIds.size === 0 || sessionStarts.length === 0) {
      setError("Add a title, connected trainer, trainee, and at least one session.");
      return;
    }
    setSaving(true);
    const payload = {
      title, agenda, location, groupId: groupId || null, trainerId,
      traineeIds: [...traineeIds], viewerIds: [...viewerIds], visibleToManagers: visibleManagers,
      sessionStarts, durationMinutes: durationMinutes(startTime, endTime), startTime, endTime,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York", withMeetLink: withMeet,
    };
    const result = editingClassId
      ? await updateTrainingClass({ ...payload, trainingClassId: editingClassId })
      : await createTrainingClass(payload);
    setSaving(false);
    if (!result.success) { setError(result.error || "Could not save the training class"); return; }
    setSuccess(result.warning || `${editingClassId ? "Training class updated" : "Training class created"}. ${sessionStarts.length} session${sessionStarts.length === 1 ? "" : "s"} scheduled.`);
    router.refresh();
    if (!editingClassId) resetSchedule();
  }

  function editClass(item: TrainingClass) {
    clearMessages(); setEditingClassId(item.id); setTitle(item.title); setAgenda(item.agenda || ""); setLocation(item.location || "");
    setGroupId(item.groupId || ""); setTrainerId(item.organizerId);
    const attendeeIds = parseIds(item.attendeeEmployeeIds).filter((id) => id !== item.organizerId);
    setTraineeIds(new Set(attendeeIds)); setViewerIds(new Set(parseIds(item.viewerEmployeeIds)));
    const sessions = item.sessions.filter((session) => session.status === "SCHEDULED");
    const first = sessions[0] ? new Date(sessions[0].startAt) : new Date(item.rangeStart);
    const last = sessions.at(-1) ? new Date(sessions.at(-1)!.startAt) : new Date(item.rangeEnd);
    setStartDate(localDate(first)); setEndDate(localDate(last)); setStartTime(item.startTime); setEndTime(item.endTime);
    setWeekdays(new Set(parseWeekdays(item.weekdays))); setWithMeet(item.withMeetLink); setTab("schedule");
  }

  async function removeClass(id: string) {
    setSaving(true); clearMessages();
    const result = await cancelTrainingClass(id);
    setSaving(false);
    if (!result.success) setError(result.error || "Could not cancel the class"); else { setSuccess("Training class cancelled."); router.refresh(); }
  }

  function resetGroup() { setEditingGroupId(null); setGroupName(""); setGroupDescription(""); setGroupTrainers(new Set()); setGroupTrainees(new Set()); setGroupViewers(new Set()); clearMessages(); }
  function editGroup(group: TrainingGroup) {
    setEditingGroupId(group.id); setGroupName(group.name); setGroupDescription(group.description || "");
    setGroupTrainers(new Set(group.members.filter((member) => member.role === "TRAINER").map((member) => member.employeeId)));
    setGroupTrainees(new Set(group.members.filter((member) => member.role === "TRAINEE").map((member) => member.employeeId)));
    setGroupViewers(new Set(group.members.filter((member) => member.role === "VIEWER").map((member) => member.employeeId))); clearMessages();
  }
  async function submitGroup() {
    setSaving(true); clearMessages();
    const members = [
      ...[...groupTrainers].map((employeeId) => ({ employeeId, role: "TRAINER" as const })),
      ...[...groupTrainees].map((employeeId) => ({ employeeId, role: "TRAINEE" as const })),
      ...[...groupViewers].map((employeeId) => ({ employeeId, role: "VIEWER" as const })),
    ];
    const result = await saveTrainingGroup({ id: editingGroupId || undefined, name: groupName, description: groupDescription, members });
    setSaving(false);
    if (!result.success) setError(result.error || "Could not save the group"); else { setSuccess("Training group saved."); resetGroup(); router.refresh(); }
  }
  async function removeGroup(id: string) {
    setSaving(true); clearMessages(); const result = await deleteTrainingGroup(id); setSaving(false);
    if (!result.success) setError(result.error || "Could not delete the group"); else { setSuccess("Training group deleted."); router.refresh(); }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"><Icon name="school" size={16} />Training</button>
      <Dialog open={open} onClose={() => { if (!saving) setOpen(false); }} title="Training calendar">
        <div className="mb-5 grid grid-cols-3 rounded-xl bg-[var(--color-surface-container-low)] p-1">
          {(["schedule", "groups", "manage"] as const).map((value) => <button type="button" key={value} onClick={() => { setTab(value); clearMessages(); }} className={cn("rounded-lg px-2 py-2 text-xs font-bold capitalize", tab === value ? "bg-[var(--color-surface-container-lowest)] text-[var(--color-accent)] shadow-sm" : "text-[var(--color-text-muted)]")}>{value}</button>)}
        </div>

        {tab === "schedule" && <div className="space-y-4">
          {editingClassId && <div className="flex items-center justify-between rounded-xl bg-indigo-500/10 px-3 py-2 text-xs text-indigo-800"><span>Editing an existing class</span><button type="button" className="font-bold" onClick={resetSchedule}>Start a new class</button></div>}
          <div><label className="mb-1 block text-xs font-semibold text-[var(--color-text-primary)]">Saved group (optional)</label><select value={groupId} onChange={(event) => selectGroup(event.target.value)} className={fieldClass}><option value="">Choose people manually</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></div>
          <div><label className="mb-1 block text-xs font-semibold text-[var(--color-text-primary)]">Class title</label><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Leadership fundamentals" className={fieldClass} /></div>
          <div><label className="mb-1 block text-xs font-semibold text-[var(--color-text-primary)]">Trainer and Google organizer</label><select value={trainerId} onChange={(event) => setTrainerId(event.target.value)} className={fieldClass}><option value="">Select a connected trainer</option>{employees.filter((employee) => employee.calendarConnected).map((employee) => <option value={employee.id} key={employee.id}>{displayName(employee)}</option>)}</select><p className="mt-1 text-[10px] text-[var(--color-text-muted)]">Only people with Google Calendar connected can organize a class.</p></div>
          <Picker title="Trainees" employees={employees.filter((employee) => employee.id !== trainerId)} selected={traineeIds} onChange={setTraineeIds} />
          <Picker title="Additional viewers or managers" employees={employees} selected={viewerIds} onChange={setViewerIds} />
          <div className="grid grid-cols-2 gap-2"><label className="text-xs font-semibold text-[var(--color-text-primary)]">First date<input type="date" min={today} value={startDate} onChange={(event) => { setStartDate(event.target.value); if (endDate < event.target.value) setEndDate(event.target.value); }} className={cn(fieldClass, "mt-1")} /></label><label className="text-xs font-semibold text-[var(--color-text-primary)]">Last date<input type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} className={cn(fieldClass, "mt-1")} /></label></div>
          <div><label className="mb-1 block text-xs font-semibold text-[var(--color-text-primary)]">Repeat on</label><div className="grid grid-cols-7 gap-1">{WEEKDAYS.map((day) => <button type="button" key={day.value} onClick={() => { const next = new Set(weekdays); if (next.has(day.value)) next.delete(day.value); else next.add(day.value); setWeekdays(next); }} className={cn("rounded-lg py-2 text-[10px] font-bold", weekdays.has(day.value) ? "bg-[var(--color-accent)] text-white" : "bg-[var(--color-surface-container-low)] text-[var(--color-text-muted)]")}>{day.label}</button>)}</div></div>
          <div className="grid grid-cols-2 gap-2"><label className="text-xs font-semibold text-[var(--color-text-primary)]">Starts<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className={cn(fieldClass, "mt-1")} /></label><label className="text-xs font-semibold text-[var(--color-text-primary)]">Ends<input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className={cn(fieldClass, "mt-1")} /></label></div>
          <div><label className="mb-1 block text-xs font-semibold text-[var(--color-text-primary)]">Location (optional)</label><input value={location} onChange={(event) => setLocation(event.target.value)} className={fieldClass} /></div>
          <div><label className="mb-1 block text-xs font-semibold text-[var(--color-text-primary)]">Agenda (optional)</label><textarea rows={3} value={agenda} onChange={(event) => setAgenda(event.target.value)} className={fieldClass} /></div>
          <div className="space-y-2 rounded-xl bg-[var(--color-surface-container-low)] p-3"><label className="flex items-center gap-2 text-xs text-[var(--color-text-primary)]"><input type="checkbox" checked={withMeet} onChange={(event) => setWithMeet(event.target.checked)} />Add a Google Meet link</label><label className="flex items-center gap-2 text-xs text-[var(--color-text-primary)]"><input type="checkbox" checked={visibleManagers} onChange={(event) => setVisibleManagers(event.target.checked)} />Show this class to managers</label><p className="text-[10px] text-[var(--color-text-muted)]">{sessionStarts.length} session{sessionStarts.length === 1 ? "" : "s"} will be created. Trainees receive Google invites.</p></div>
          {error && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-700">{error}</p>}{success && <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700">{success}</p>}
          <button type="button" onClick={submitClass} disabled={saving || !title.trim()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving && <Icon name="progress_activity" size={16} className="animate-material-spin" />}{editingClassId ? "Save class changes" : "Create class and send invites"}</button>
        </div>}

        {tab === "groups" && <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--color-border)] p-3 space-y-3"><div className="flex items-center justify-between"><h3 className="text-sm font-bold text-[var(--color-text-primary)]">{editingGroupId ? "Edit group" : "New reusable group"}</h3>{editingGroupId && <button type="button" onClick={resetGroup} className="text-xs font-bold text-[var(--color-accent)]">New group</button>}</div><input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="New manager training" className={fieldClass} /><input value={groupDescription} onChange={(event) => setGroupDescription(event.target.value)} placeholder="Description (optional)" className={fieldClass} /><Picker title="Trainers" employees={employees} selected={groupTrainers} onChange={setGroupTrainers} /><Picker title="Trainees" employees={employees} selected={groupTrainees} onChange={setGroupTrainees} /><Picker title="Viewers or managers" employees={employees} selected={groupViewers} onChange={setGroupViewers} /><button type="button" onClick={submitGroup} disabled={saving || !groupName.trim()} className="w-full rounded-xl bg-[var(--color-accent)] py-2 text-sm font-bold text-white disabled:opacity-50">Save group</button></div>
          {error && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-700">{error}</p>}{success && <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700">{success}</p>}
          <div className="space-y-2">{groups.map((group) => <div key={group.id} className="flex items-center gap-3 rounded-xl bg-[var(--color-surface-container-low)] p-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-[var(--color-text-primary)]">{group.name}</p><p className="text-[10px] text-[var(--color-text-muted)]">{group.members.length} member roles</p></div><button type="button" onClick={() => editGroup(group)} className="ml-auto rounded-lg p-2 text-[var(--color-accent)] hover:bg-white"><Icon name="edit" size={17} /></button><button type="button" onClick={() => removeGroup(group.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-500/10"><Icon name="delete" size={17} /></button></div>)}</div>
        </div>}

        {tab === "manage" && <div className="space-y-3">
          {error && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-700">{error}</p>}{success && <p className="rounded-xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700">{success}</p>}
          {classes.filter((item) => item.status === "ACTIVE").length === 0 && <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">No upcoming training classes.</p>}
          {classes.filter((item) => item.status === "ACTIVE").map((item) => <div key={item.id} className="rounded-2xl border border-[var(--color-border)] p-4"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-700"><Icon name="school" size={20} /></span><div className="min-w-0"><p className="truncate text-sm font-bold text-[var(--color-text-primary)]">{item.title}</p><p className="text-xs text-[var(--color-text-muted)]">{item.sessions.filter((session) => session.status === "SCHEDULED").length} sessions · {displayName(item.organizer)}</p>{item.group && <p className="mt-1 text-[10px] text-indigo-700">{item.group.name}</p>}</div></div><div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => removeClass(item.id)} disabled={saving} className="rounded-lg px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-500/10">Cancel class</button><button type="button" onClick={() => editClass(item)} className="rounded-lg bg-[var(--color-surface-container-low)] px-3 py-1.5 text-xs font-bold text-[var(--color-text-primary)]">Edit schedule</button></div></div>)}
        </div>}
      </Dialog>
    </>
  );
}
