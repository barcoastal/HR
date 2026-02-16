"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { createClub } from "@/lib/actions/clubs";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

const emojiOptions = ["🎯", "🎮", "📚", "🏃", "🎨", "🎵", "🍕", "☕", "🌱", "🐾", "🏀", "⚽", "🎸", "🧘", "🎬", "🏖️"];

export function CreateClubDialog() {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", emoji: "🎯" });
  const router = useRouter();

  async function handleCreate() {
    if (!form.name.trim()) return;
    setSaving(true);
    await createClub({
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      emoji: form.emoji,
    });
    setSaving(false);
    setOpen(false);
    setForm({ name: "", description: "", emoji: "🎯" });
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
          "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
          "bg-[var(--color-accent)] text-white",
          "hover:bg-[var(--color-accent-hover)] transition-colors"
        )}
      >
        <Plus className="h-4 w-4" />Create Club
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Create Club">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Emoji</label>
            <div className="flex flex-wrap gap-2">
              {emojiOptions.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setForm((f) => ({ ...f, emoji }))}
                  className={cn(
                    "h-9 w-9 rounded-lg flex items-center justify-center text-lg transition-colors",
                    form.emoji === emoji
                      ? "bg-[var(--color-accent)]/10 ring-2 ring-[var(--color-accent)]"
                      : "hover:bg-[var(--color-surface-hover)]"
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Club Name *</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Book Club" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} placeholder="What's this club about?" className={cn(inputClass, "resize-none")} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]">Cancel</button>
          <button
            onClick={handleCreate}
            disabled={!form.name.trim() || saving}
            className={cn("px-4 py-2 rounded-lg text-sm font-medium", "bg-[var(--color-accent)] text-white", "hover:bg-[var(--color-accent-hover)]", "disabled:opacity-50")}
          >
            {saving ? "Creating..." : "Create"}
          </button>
        </div>
      </Dialog>
    </>
  );
}
