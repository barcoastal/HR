"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { updateMyProfile } from "@/lib/actions/my-profile";
import { useRouter } from "next/navigation";
import { Phone } from "lucide-react";

type EmergencyContactData = {
  employeeId: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
};

export function EditEmergencyContactDialog({ data }: { data: EmergencyContactData }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    emergencyContactName: data.emergencyContactName,
    emergencyContactPhone: data.emergencyContactPhone,
    emergencyContactRelation: data.emergencyContactRelation,
  });
  const router = useRouter();

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    await updateMyProfile(data.employeeId, {
      emergencyContactName: form.emergencyContactName || null,
      emergencyContactPhone: form.emergencyContactPhone || null,
      emergencyContactRelation: form.emergencyContactRelation || null,
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
          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium",
          "text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors"
        )}
      >
        <Phone className="h-3.5 w-3.5" />Edit
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Edit Emergency Contact">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Contact Name</label>
            <input value={form.emergencyContactName} onChange={(e) => update("emergencyContactName", e.target.value)} placeholder="Full name" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Phone Number</label>
            <input value={form.emergencyContactPhone} onChange={(e) => update("emergencyContactPhone", e.target.value)} placeholder="+1 (555) 123-4567" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Relationship</label>
            <input value={form.emergencyContactRelation} onChange={(e) => update("emergencyContactRelation", e.target.value)} placeholder="e.g. Spouse, Parent, Sibling" className={inputClass} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium", "bg-[var(--color-accent)] text-white", "hover:bg-[var(--color-accent-hover)]", "disabled:opacity-50")}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </Dialog>
    </>
  );
}
