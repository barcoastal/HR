"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { createOutOfOffice, deleteOutOfOffice } from "@/lib/actions/out-of-office";

type Department = { id: string; name: string; employeeCount: number };
type Employee = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  departmentId: string | null;
};
type MyEntry = {
  id: string;
  startDate: Date | string;
  endDate: Date | string;
  type: string;
  note: string | null;
  audienceType: string;
};

function fmt(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function audienceLabel(t: string) {
  if (t === "departments") return "Specific departments";
  if (t === "employees") return "Specific people";
  return "Everyone";
}

export function OutOfOfficeDialog({
  departments,
  employees,
  myEntries = [],
  companySize,
  myDepartment = null,
}: {
  departments: Department[];
  employees: Employee[];
  myEntries?: MyEntry[];
  companySize: number;
  /** Set for viewers who can't browse the directory — lets them target their own team without seeing a roster. */
  myDepartment?: { id: string; name: string } | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const today = () => new Date().toISOString().slice(0, 10);

  // Regular employees can't browse the company directory, so they get
  // "Everyone" / "My department" instead of a picker that would leak the roster.
  const canTargetIndividuals = employees.length > 0;
  const canPickDepartments = departments.length > 0;

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [type, setType] = useState<"OUT_OF_OFFICE" | "WORKING_REMOTELY">("OUT_OF_OFFICE");
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<"everyone" | "departments" | "people">("everyone");
  const [deptIds, setDeptIds] = useState<Set<string>>(new Set());
  const [empIds, setEmpIds] = useState<Set<string>>(new Set());
  const [peopleSearch, setPeopleSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const input = cn(
    "w-full px-3 py-2 rounded-lg text-sm",
    "bg-[var(--color-background)] border border-[var(--color-border)]",
    "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]"
  );

  function reset() {
    setStartDate(today());
    setEndDate(today());
    setType("OUT_OF_OFFICE");
    setNote("");
    setMode("everyone");
    setDeptIds(new Set());
    setEmpIds(new Set());
    setPeopleSearch("");
    setError(null);
  }

  function toggle(set: Set<string>, id: string, apply: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    apply(next);
  }

  const viewerCount = (() => {
    if (mode === "everyone") return companySize;
    if (mode === "departments") {
      if (canTargetIndividuals) {
        const s = new Set<string>();
        for (const e of employees) if (e.departmentId && deptIds.has(e.departmentId)) s.add(e.id);
        return s.size;
      }
      return departments
        .filter((d) => deptIds.has(d.id))
        .reduce((sum, d) => sum + d.employeeCount, 0);
    }
    return empIds.size;
  })();

  const filteredEmployees = peopleSearch.trim()
    ? employees.filter((e) => {
        const q = peopleSearch.toLowerCase();
        return (
          `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q)
        );
      })
    : employees;

  async function submit() {
    setSaving(true);
    setError(null);
    const res = await createOutOfOffice({
      startDate,
      endDate,
      type,
      note,
      audience: {
        type: mode === "people" ? "employees" : mode === "departments" ? "departments" : "all",
        departmentIds: Array.from(deptIds),
        employeeIds: Array.from(empIds),
      },
    });
    setSaving(false);
    if (!res.success) {
      setError(res.error || "Something went wrong.");
      return;
    }
    setOpen(false);
    reset();
    router.refresh();
  }

  async function remove(id: string) {
    await deleteOutOfOffice(id);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
      >
        <Icon name="beach_access" size={16} />
        Set out of office
      </button>

      <Dialog
        open={open}
        onClose={() => {
          if (!saving) {
            setOpen(false);
            reset();
          }
        }}
        title="Set out of office"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {myEntries.length > 0 && (
            <div className="rounded-lg border border-[var(--color-border)] p-2 space-y-1">
              <p className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider px-1">
                Your upcoming entries
              </p>
              {myEntries.map((e) => (
                <div key={e.id} className="flex items-center gap-2 px-1 py-1 text-xs">
                  <Icon
                    name={e.type === "WORKING_REMOTELY" ? "home_work" : "beach_access"}
                    size={14}
                    className="text-[var(--color-accent)]"
                  />
                  <span className="text-[var(--color-text-primary)]">
                    {fmt(e.startDate)} – {fmt(e.endDate)}
                  </span>
                  {e.note && <span className="text-[var(--color-text-muted)] truncate">{e.note}</span>}
                  <span className="ml-auto text-[10px] text-[var(--color-text-muted)]">
                    {audienceLabel(e.audienceType)}
                  </span>
                  <button
                    onClick={() => remove(e.id)}
                    className="text-[var(--color-text-muted)] hover:text-red-500"
                    aria-label="Remove"
                  >
                    <Icon name="close" size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (endDate < e.target.value) setEndDate(e.target.value);
                }}
                className={input}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">To</label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={input}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Type</label>
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)]">
              {(
                [
                  { v: "OUT_OF_OFFICE", l: "Out of office" },
                  { v: "WORKING_REMOTELY", l: "Working remotely" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setType(opt.v)}
                  className={cn(
                    "flex-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                    type === opt.v
                      ? "bg-[var(--color-accent)] text-white"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  )}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
              Note (optional)
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Conference, appointment, offline after 2pm…"
              className={input}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">
              Who can see this?
            </label>
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)] mb-2">
              {(
                [
                  { v: "everyone", l: `Everyone (${companySize})` },
                  ...(canPickDepartments
                    ? [{ v: "departments" as const, l: myDepartment && !canTargetIndividuals ? "My department" : "By department" }]
                    : []),
                  ...(canTargetIndividuals ? [{ v: "people" as const, l: "Pick people" }] : []),
                ] as { v: "everyone" | "departments" | "people"; l: string }[]
              ).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setMode(opt.v)}
                  className={cn(
                    "flex-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                    mode === opt.v
                      ? "bg-[var(--color-accent)] text-white"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  )}
                >
                  {opt.l}
                </button>
              ))}
            </div>

            {mode === "departments" && (
              <div className="space-y-1.5 max-h-[180px] overflow-y-auto rounded-lg border border-[var(--color-border)] p-2">
                {departments.length === 0 && (
                  <p className="text-[11px] text-[var(--color-text-muted)] italic">
                    No departments configured.
                  </p>
                )}
                {departments.map((d) => (
                  <label
                    key={d.id}
                    className="flex items-center gap-2 cursor-pointer hover:bg-[var(--color-surface-hover)] rounded px-2 py-1 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={deptIds.has(d.id)}
                      onChange={() => toggle(deptIds, d.id, setDeptIds)}
                      className="h-3.5 w-3.5 rounded border-gray-300"
                    />
                    <span className="text-[var(--color-text-primary)]">{d.name}</span>
                    <span className="text-[10px] text-[var(--color-text-muted)] ml-auto">
                      {d.employeeCount} {d.employeeCount === 1 ? "person" : "people"}
                    </span>
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
                <div className="space-y-0.5 max-h-[200px] overflow-y-auto rounded-lg border border-[var(--color-border)] p-1">
                  {filteredEmployees.map((e) => (
                    <label
                      key={e.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-[var(--color-surface-hover)] rounded px-2 py-1 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={empIds.has(e.id)}
                        onChange={() => toggle(empIds, e.id, setEmpIds)}
                        className="h-3.5 w-3.5 rounded border-gray-300"
                      />
                      <span className="text-[var(--color-text-primary)]">{`${e.firstName} ${e.lastName}`}</span>
                      <span className="text-[10px] text-[var(--color-text-muted)] ml-auto truncate">
                        {e.email}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
              {mode === "everyone"
                ? "Everyone in the company will see this on the calendar."
                : `${viewerCount} ${viewerCount === 1 ? "person" : "people"} will see this, plus HR and admins.`}
            </p>
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => {
                setOpen(false);
                reset();
              }}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-primary)]"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={saving || (mode === "departments" && deptIds.size === 0) || (mode === "people" && empIds.size === 0)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Set out of office"}
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
