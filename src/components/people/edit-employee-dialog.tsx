"use client";

import { cn } from "@/lib/utils";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { updateEmployee } from "@/lib/actions/employees";
import { useRouter } from "next/navigation";

type EmployeeData = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  jobTitle: string;
  departmentId: string | null;
  startDate: string;
  birthday: string;
  location: string;
  hobbies: string;
  bio: string;
  dietaryRestrictions: string;
};

type Department = { id: string; name: string };

export function EditEmployeeDialog({ employee, departments }: { employee: EmployeeData; departments: Department[] }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    firstName: employee.firstName,
    lastName: employee.lastName,
    email: employee.email,
    phone: employee.phone || "",
    jobTitle: employee.jobTitle,
    departmentId: employee.departmentId || "",
    startDate: employee.startDate,
    birthday: employee.birthday,
    location: employee.location,
    hobbies: employee.hobbies,
    bio: employee.bio,
    dietaryRestrictions: employee.dietaryRestrictions,
  });
  const router = useRouter();

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!form.firstName || !form.lastName || !form.email || !form.jobTitle) return;
    setSaving(true);
    await updateEmployee(employee.id, {
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone || null,
      jobTitle: form.jobTitle,
      departmentId: form.departmentId || null,
      startDate: form.startDate,
      birthday: form.birthday || null,
      location: form.location || null,
      hobbies: form.hobbies || null,
      bio: form.bio || null,
      dietaryRestrictions: form.dietaryRestrictions || null,
    });
    setSaving(false);
    setOpen(false);
    router.refresh();
  }

  const inputClass = cn(
    "w-full px-3 py-2 rounded-lg text-sm",
    "bg-[var(--color-background)] border border-[var(--color-border)]",
    "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium",
          "bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]",
          "hover:bg-[var(--color-accent)]/10 hover:text-[var(--color-accent)] transition-colors"
        )}
      >
        <Pencil className="h-3.5 w-3.5" />Edit
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Edit Employee">
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">First Name *</label>
              <input value={form.firstName} onChange={(e) => update("firstName", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Last Name *</label>
              <input value={form.lastName} onChange={(e) => update("lastName", e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Email *</label>
              <input value={form.email} onChange={(e) => update("email", e.target.value)} type="email" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Phone</label>
              <input value={form.phone} onChange={(e) => update("phone", e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Job Title *</label>
              <input value={form.jobTitle} onChange={(e) => update("jobTitle", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Department</label>
              <select value={form.departmentId} onChange={(e) => update("departmentId", e.target.value)} className={inputClass}>
                <option value="">No department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Start Date</label>
              <input value={form.startDate} onChange={(e) => update("startDate", e.target.value)} type="date" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Birthday</label>
              <input value={form.birthday} onChange={(e) => update("birthday", e.target.value)} type="date" className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Location</label>
            <input value={form.location} onChange={(e) => update("location", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Hobbies</label>
            <input value={form.hobbies} onChange={(e) => update("hobbies", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Dietary Restrictions</label>
            <input value={form.dietaryRestrictions} onChange={(e) => update("dietaryRestrictions", e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Bio</label>
            <textarea value={form.bio} onChange={(e) => update("bio", e.target.value)} rows={3} className={cn(inputClass, "resize-none")} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !form.firstName || !form.lastName || !form.email || !form.jobTitle}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium", "bg-[var(--color-accent)] text-white", "hover:bg-[var(--color-accent-hover)]", "disabled:opacity-50")}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </Dialog>
    </>
  );
}
