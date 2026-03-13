"use client";

import { cn } from "@/lib/utils";
import { Plus, Trash2, Palmtree, Upload, FileText, X } from "lucide-react";
import { useState, useRef } from "react";
import { createTimeOffPolicy, deleteTimeOffPolicy, updateTimeOffPolicy } from "@/lib/actions/time-off";
import { useRouter } from "next/navigation";

type Policy = {
  id: string;
  name: string;
  daysPerYear: number;
  isUnlimited: boolean;
  documentUrl: string | null;
  documentName: string | null;
};

export function PtoPolicyManager({ policies: initialPolicies }: { policies: Policy[] }) {
  const [policies, setPolicies] = useState(initialPolicies);
  const [name, setName] = useState("");
  const [daysPerYear, setDaysPerYear] = useState(20);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [adding, setAdding] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const router = useRouter();

  async function uploadDocument(file: File): Promise<{ url: string; name: string } | null> {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/onboarding-docs/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  }

  async function handleAdd() {
    if (!name.trim()) return;
    setAdding(true);

    let documentUrl: string | undefined;
    let documentName: string | undefined;

    if (docFile) {
      const result = await uploadDocument(docFile);
      if (result) {
        documentUrl = result.url;
        documentName = result.name;
      }
    }

    const policy = await createTimeOffPolicy({
      name: name.trim(),
      daysPerYear: isUnlimited ? 0 : daysPerYear,
      isUnlimited,
      documentUrl,
      documentName,
    });
    setPolicies((p) => [...p, policy]);
    setName("");
    setDaysPerYear(20);
    setIsUnlimited(false);
    setDocFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setAdding(false);
    router.refresh();
  }

  async function handleDelete(id: string) {
    await deleteTimeOffPolicy(id);
    setPolicies((p) => p.filter((x) => x.id !== id));
    router.refresh();
  }

  async function handleUploadDoc(policyId: string, file: File) {
    setUploadingId(policyId);
    const result = await uploadDocument(file);
    if (result) {
      await updateTimeOffPolicy(policyId, {
        documentUrl: result.url,
        documentName: result.name,
      });
      setPolicies((p) =>
        p.map((x) =>
          x.id === policyId ? { ...x, documentUrl: result.url, documentName: result.name } : x
        )
      );
    }
    setUploadingId(null);
    router.refresh();
  }

  async function handleRemoveDoc(policyId: string) {
    await updateTimeOffPolicy(policyId, { documentUrl: null, documentName: null });
    setPolicies((p) =>
      p.map((x) => (x.id === policyId ? { ...x, documentUrl: null, documentName: null } : x))
    );
    router.refresh();
  }

  const inputClass = cn(
    "w-full px-3 py-2 rounded-lg text-sm",
    "bg-[var(--color-background)] border border-[var(--color-border)]",
    "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
  );

  return (
    <section className={cn("rounded-xl p-6", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
      <div className="flex items-center gap-2 mb-4">
        <Palmtree className="h-5 w-5 text-emerald-500" />
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">PTO Policies</h2>
      </div>

      {policies.length > 0 && (
        <div className="space-y-2 mb-4">
          {policies.map((p) => (
            <div key={p.id} className={cn("p-3 rounded-lg", "bg-[var(--color-background)] border border-[var(--color-border)]")}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">{p.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{p.isUnlimited ? "Unlimited" : `${p.daysPerYear} days/year`}</p>
                </div>
                <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Document section */}
              <div className="mt-2 pt-2 border-t border-[var(--color-border)]">
                {p.documentUrl ? (
                  <div className="flex items-center gap-2">
                    <a
                      href={p.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-[var(--color-accent)] hover:underline"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {p.documentName || "Policy Document"}
                    </a>
                    <button
                      onClick={() => handleRemoveDoc(p.id)}
                      className="p-1 rounded text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
                      title="Remove document"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      ref={(el) => { uploadInputRefs.current[p.id] = el; }}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadDoc(p.id, file);
                      }}
                    />
                    <button
                      onClick={() => uploadInputRefs.current[p.id]?.click()}
                      disabled={uploadingId === p.id}
                      className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {uploadingId === p.id ? "Uploading..." : "Upload policy document"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Policy Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Vacation" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Days Per Year</label>
            <input type="number" value={daysPerYear} onChange={(e) => setDaysPerYear(Number(e.target.value))} disabled={isUnlimited} min={0} className={cn(inputClass, isUnlimited && "opacity-50")} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--color-text-primary)]">
          <input type="checkbox" checked={isUnlimited} onChange={(e) => setIsUnlimited(e.target.checked)} className="rounded" />
          Unlimited PTO
        </label>
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Policy Document (optional)</label>
          <input
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            ref={fileInputRef}
            onChange={(e) => setDocFile(e.target.files?.[0] || null)}
            className={cn(inputClass, "file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-[var(--color-accent)]/10 file:text-[var(--color-accent)]")}
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={!name.trim() || adding}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
            "bg-[var(--color-accent)] text-white",
            "hover:bg-[var(--color-accent-hover)] transition-colors",
            "disabled:opacity-50"
          )}
        >
          <Plus className="h-4 w-4" />{adding ? "Adding..." : "Add Policy"}
        </button>
      </div>
    </section>
  );
}
