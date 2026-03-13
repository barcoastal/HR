"use client";

import { cn } from "@/lib/utils";
import { FileText, Upload, Trash2, ChevronRight, Eye, EyeOff, Lock } from "lucide-react";
import { useState, useRef } from "react";
import { addEmployeeDocument, deleteEmployeeDocument } from "@/lib/actions/employee-documents";
import { Dialog } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import type { DocumentCategory, DocumentVisibility } from "@/generated/prisma/client";

type Doc = {
  id: string;
  name: string;
  url: string;
  category: string;
  visibility: string;
  uploadedAt: string;
};

export function EmployeeDocumentsSection({
  employeeId,
  documents,
  isAdmin,
}: {
  employeeId: string;
  documents: Doc[];
  isAdmin: boolean;
}) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState<DocumentCategory>("GENERAL");
  const [visibility, setVisibility] = useState<DocumentVisibility>("EVERYONE");
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/onboarding-docs/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      await addEmployeeDocument({
        employeeId,
        name: file.name,
        url: data.url,
        category,
        visibility,
      });

      setUploadOpen(false);
      setCategory("GENERAL");
      setVisibility("EVERYONE");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    }
    setUploading(false);
  }

  async function handleDelete(docId: string) {
    if (!confirm("Delete this document?")) return;
    await deleteEmployeeDocument(docId);
    router.refresh();
  }

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <section className={cn("rounded-2xl gradient-border p-6", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-red-500/15 flex items-center justify-center">
            <FileText className="h-4 w-4 text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Documents</h2>
        </div>
        {isAdmin && (
          <button
            onClick={() => setUploadOpen(true)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium",
              "bg-[var(--color-accent)] text-white",
              "hover:bg-[var(--color-accent-hover)] transition-colors"
            )}
          >
            <Upload className="h-3.5 w-3.5" />
            Upload
          </button>
        )}
      </div>

      {documents.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)] text-center py-4">No documents yet.</p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <a
              key={doc.id}
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg group",
                "hover:bg-[var(--color-surface-hover)] transition-colors"
              )}
            >
              <div className="h-9 w-9 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{doc.name}</p>
                  {doc.visibility === "HR_ONLY" && (
                    <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 font-medium shrink-0">
                      <Lock className="h-2.5 w-2.5" />
                      HR Only
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">{doc.category} &middot; {formatDate(doc.uploadedAt)}</p>
              </div>
              <div className="flex items-center gap-1">
                {isAdmin && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleDelete(doc.id);
                    }}
                    className="p-1.5 rounded-lg text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 hover:bg-red-500/15 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <ChevronRight className="h-4 w-4 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </a>
          ))}
        </div>
      )}

      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload Document">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">File</label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"
              className={cn(
                "w-full px-3 py-2 rounded-lg text-sm",
                "bg-[var(--color-background)] border border-[var(--color-border)]",
                "text-[var(--color-text-primary)]",
                "file:mr-3 file:px-3 file:py-1 file:rounded-lg file:border-0",
                "file:text-sm file:font-medium file:bg-[var(--color-accent)]/10 file:text-[var(--color-accent)]"
              )}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as DocumentCategory)}
              className={cn(
                "w-full px-3 py-2 rounded-lg text-sm",
                "bg-[var(--color-background)] border border-[var(--color-border)]",
                "text-[var(--color-text-primary)]"
              )}
            >
              <option value="GENERAL">General</option>
              <option value="ONBOARDING">Onboarding</option>
              <option value="OFFBOARDING">Offboarding</option>
              <option value="REVIEW">Review</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">Visibility</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setVisibility("EVERYONE")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors",
                  visibility === "EVERYONE"
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                    : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
                )}
              >
                <Eye className="h-4 w-4" />
                Visible to Employee
              </button>
              <button
                type="button"
                onClick={() => setVisibility("HR_ONLY")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors",
                  visibility === "HR_ONLY"
                    ? "border-red-400 bg-red-500/10 text-red-400"
                    : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
                )}
              >
                <EyeOff className="h-4 w-4" />
                HR Only
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setUploadOpen(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium",
                "bg-[var(--color-accent)] text-white",
                "hover:bg-[var(--color-accent-hover)]",
                "disabled:opacity-50"
              )}
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </div>
      </Dialog>
    </section>
  );
}
