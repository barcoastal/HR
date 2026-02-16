"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { updateMyProfile } from "@/lib/actions/my-profile";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

type AboutData = {
  employeeId: string;
  bio: string;
  hobbies: string;
  dietaryRestrictions: string;
};

export function EditAboutDialog({ data }: { data: AboutData }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    bio: data.bio,
    hobbies: data.hobbies,
    dietaryRestrictions: data.dietaryRestrictions,
  });
  const router = useRouter();

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    await updateMyProfile(data.employeeId, {
      bio: form.bio || null,
      hobbies: form.hobbies || null,
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
          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium",
          "text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors"
        )}
      >
        <Pencil className="h-3.5 w-3.5" />Edit
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Edit About">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Bio</label>
            <textarea value={form.bio} onChange={(e) => update("bio", e.target.value)} rows={3} placeholder="Tell us about yourself..." className={cn(inputClass, "resize-none")} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Hobbies</label>
            <input value={form.hobbies} onChange={(e) => update("hobbies", e.target.value)} placeholder="What do you enjoy?" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Dietary Restrictions</label>
            <input value={form.dietaryRestrictions} onChange={(e) => update("dietaryRestrictions", e.target.value)} placeholder="e.g. Vegetarian, Gluten-free" className={inputClass} />
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
