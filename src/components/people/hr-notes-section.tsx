"use client";

import { cn } from "@/lib/utils";
import { StickyNote, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { addHRNote, deleteHRNote } from "@/lib/actions/hr-notes";
import { useRouter } from "next/navigation";

type Note = {
  id: string;
  content: string;
  createdAt: string;
  author: { firstName: string; lastName: string };
};

export function HRNotesSection({ employeeId, notes }: { employeeId: string; notes: Note[] }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleAdd() {
    if (!content.trim()) return;
    setLoading(true);
    try {
      await addHRNote(employeeId, content);
      setContent("");
      router.refresh();
    } catch {
      // silently fail
    }
    setLoading(false);
  }

  async function handleDelete(noteId: string) {
    if (!confirm("Delete this note?")) return;
    await deleteHRNote(noteId);
    router.refresh();
  }

  return (
    <section className={cn("rounded-2xl gradient-border p-6", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
          <StickyNote className="h-4 w-4 text-amber-400" />
        </div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">HR Notes</h2>
        <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 font-medium">Admin Only</span>
      </div>

      <div className="mb-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add a private note about this employee..."
          rows={3}
          className={cn(
            "w-full px-3 py-2 rounded-lg text-sm resize-none",
            "bg-[var(--color-background)] border border-[var(--color-border)]",
            "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
            "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
          )}
        />
        <div className="flex justify-end mt-2">
          <button
            onClick={handleAdd}
            disabled={!content.trim() || loading}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium",
              "bg-[var(--color-accent)] text-white",
              "hover:bg-[var(--color-accent-hover)] transition-colors",
              "disabled:opacity-50"
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            {loading ? "Adding..." : "Add Note"}
          </button>
        </div>
      </div>

      {notes.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-4">No HR notes yet.</p>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.id}
              className={cn("p-3 rounded-lg group", "bg-[var(--color-background)] border border-[var(--color-border)]")}
            >
              <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap">{note.content}</p>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-[var(--color-text-muted)]">
                  {note.author.firstName} {note.author.lastName} &middot;{" "}
                  {new Date(note.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
                <button
                  onClick={() => handleDelete(note.id)}
                  className="p-1 rounded-lg text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 hover:bg-red-500/15 hover:text-red-400 transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
