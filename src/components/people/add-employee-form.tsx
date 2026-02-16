"use client";

import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { createEmployee } from "@/lib/actions/employees";
import { useRouter } from "next/navigation";

type Department = { id: string; name: string };

export function AddEmployeeForm({ departments }: { departments: Department[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    jobTitle: "",
    departmentId: "",
    phone: "",
    startDate: "",
    birthday: "",
    location: "",
    dietaryRestrictions: "",
    bio: "",
    hobbies: "",
    status: "ACTIVE",
  });
  const router = useRouter();

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit() {
    if (!form.firstName || !form.lastName || !form.email || !form.jobTitle || !form.startDate) return;
    setLoading(true);
    await createEmployee({
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      jobTitle: form.jobTitle,
      departmentId: form.departmentId || undefined,
      phone: form.phone || undefined,
      startDate: form.startDate,
      birthday: form.birthday || undefined,
      location: form.location || undefined,
      dietaryRestrictions: form.dietaryRestrictions || undefined,
      bio: form.bio || undefined,
      hobbies: form.hobbies || undefined,
      status: form.status as "ACTIVE" | "ONBOARDING",
    });
    setForm({ firstName: "", lastName: "", email: "", jobTitle: "", departmentId: "", phone: "", startDate: "", birthday: "", location: "", dietaryRestrictions: "", bio: "", hobbies: "", status: "ACTIVE" });
    setLoading(false);
    setOpen(false);
    router.refresh();
  }

  const inputClass = cn("w-full px-3 py-2 rounded-lg text-sm", "bg-[var(--color-background)] border border-[var(--color-border)]", "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]", "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40");

  return (
    <>
      <button onClick={() => setOpen(true)} className={cn("flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium", "bg-[var(--color-accent)] text-white", "hover:bg-[var(--color-accent-hover)] transition-colors", "shadow-[0_0_12px_var(--color-accent-glow)]")}>
        <Plus className="h-4 w-4" />Add Employee
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Add Employee">
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">First Name *</label>
              <input value={form.firstName} onChange={(e) => update("firstName", e.target.value)} className={inputClass} placeholder="John" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Last Name *</label>
              <input value={form.lastName} onChange={(e) => update("lastName", e.target.value)} className={inputClass} placeholder="Doe" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Email *</label>
            <input value={form.email} onChange={(e) => update("email", e.target.value)} type="email" className={inputClass} placeholder="john@company.com" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Job Title *</label>
            <input value={form.jobTitle} onChange={(e) => update("jobTitle", e.target.value)} className={inputClass} placeholder="Software Engineer" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Department</label>
              <select value={form.departmentId} onChange={(e) => update("departmentId", e.target.value)} className={inputClass}>
                <option value="">Select department...</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Status</label>
              <select value={form.status} onChange={(e) => update("status", e.target.value)} className={inputClass}>
                <option value="ACTIVE">Active</option>
                <option value="ONBOARDING">Onboarding</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Start Date *</label>
              <input value={form.startDate} onChange={(e) => update("startDate", e.target.value)} type="date" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Birthday</label>
              <input value={form.birthday} onChange={(e) => update("birthday", e.target.value)} type="date" className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Phone</label>
              <input value={form.phone} onChange={(e) => update("phone", e.target.value)} type="tel" className={inputClass} placeholder="+1 (555) 123-4567" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Location</label>
              <input value={form.location} onChange={(e) => update("location", e.target.value)} className={inputClass} placeholder="New York, NY" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Dietary Restrictions</label>
            <input value={form.dietaryRestrictions} onChange={(e) => update("dietaryRestrictions", e.target.value)} className={inputClass} placeholder="Vegetarian, Gluten-free, etc." />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Hobbies</label>
            <input value={form.hobbies} onChange={(e) => update("hobbies", e.target.value)} className={inputClass} placeholder="Reading, hiking, photography..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Bio</label>
            <textarea value={form.bio} onChange={(e) => update("bio", e.target.value)} rows={3} className={cn(inputClass, "resize-none")} placeholder="A short bio about the employee..." />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]">Cancel</button>
          <button onClick={handleSubmit} disabled={!form.firstName || !form.lastName || !form.email || !form.jobTitle || !form.startDate || loading} className={cn("px-4 py-2 rounded-lg text-sm font-medium", "bg-[var(--color-accent)] text-white", "hover:bg-[var(--color-accent-hover)]", "disabled:opacity-50")}>
            {loading ? "Adding..." : "Add Employee"}
          </button>
        </div>
      </Dialog>
    </>
  );
}
