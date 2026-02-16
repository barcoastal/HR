"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { updateMyProfile } from "@/lib/actions/my-profile";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";

type PersonalInfo = {
  employeeId: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  pronouns: string;
  tShirtSize: string;
};

export function EditPersonalInfoDialog({ data }: { data: PersonalInfo }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    address: data.address,
    city: data.city,
    state: data.state,
    zipCode: data.zipCode,
    country: data.country,
    pronouns: data.pronouns,
    tShirtSize: data.tShirtSize,
  });
  const router = useRouter();

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    await updateMyProfile(data.employeeId, {
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      zipCode: form.zipCode || null,
      country: form.country || null,
      pronouns: form.pronouns || null,
      tShirtSize: form.tShirtSize || null,
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
        <MapPin className="h-3.5 w-3.5" />Edit
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Edit Personal Info">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Pronouns</label>
            <input value={form.pronouns} onChange={(e) => update("pronouns", e.target.value)} placeholder="e.g. she/her, he/him, they/them" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">T-Shirt Size</label>
            <select value={form.tShirtSize} onChange={(e) => update("tShirtSize", e.target.value)} className={inputClass}>
              <option value="">Select size</option>
              <option value="XS">XS</option>
              <option value="S">S</option>
              <option value="M">M</option>
              <option value="L">L</option>
              <option value="XL">XL</option>
              <option value="XXL">XXL</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Address</label>
            <input value={form.address} onChange={(e) => update("address", e.target.value)} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">City</label>
              <input value={form.city} onChange={(e) => update("city", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">State</label>
              <input value={form.state} onChange={(e) => update("state", e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Zip Code</label>
              <input value={form.zipCode} onChange={(e) => update("zipCode", e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Country</label>
              <input value={form.country} onChange={(e) => update("country", e.target.value)} className={inputClass} />
            </div>
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
