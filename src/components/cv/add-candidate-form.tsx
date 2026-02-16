"use client";

import { cn } from "@/lib/utils";
import { Plus, Upload, Loader2, FileText, Linkedin } from "lucide-react";
import { useState, useRef } from "react";
import { Dialog } from "@/components/ui/dialog";
import { createCandidate } from "@/lib/actions/candidates";
import { parseResume } from "@/lib/actions/parse-resume";
import { parseLinkedIn } from "@/lib/actions/parse-linkedin";
import { useRouter } from "next/navigation";

type Position = { id: string; title: string };

export function AddCandidateForm({ positions }: { positions: Position[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [fetchingLinkedIn, setFetchingLinkedIn] = useState(false);
  const [parseError, setParseError] = useState("");
  const [fileName, setFileName] = useState("");
  const [linkedinInput, setLinkedinInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    skills: "",
    experience: "",
    source: "",
    positionId: "",
    linkedinUrl: "",
    resumeText: "",
    notes: "",
    costOfHire: "",
  });
  const router = useRouter();

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleFileUpload(file: File) {
    if (file.type !== "application/pdf") {
      setParseError("Please upload a PDF file");
      return;
    }

    setParsing(true);
    setParseError("");
    setFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data, resumeText } = await parseResume(formData);

      setForm((f) => ({
        ...f,
        firstName: data.firstName || f.firstName,
        lastName: data.lastName || f.lastName,
        email: data.email || f.email,
        phone: data.phone || f.phone,
        skills: data.skills?.length ? data.skills.join(", ") : f.skills,
        experience: data.experience || f.experience,
        linkedinUrl: data.linkedinUrl || f.linkedinUrl,
        resumeText: resumeText || f.resumeText,
      }));
    } catch {
      setParseError("Failed to parse resume. Please fill in fields manually.");
    } finally {
      setParsing(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }

  async function handleLinkedInFetch() {
    if (!linkedinInput.includes("linkedin.com/in/")) {
      setParseError("Please enter a valid LinkedIn profile URL");
      return;
    }

    setFetchingLinkedIn(true);
    setParseError("");

    try {
      const { data } = await parseLinkedIn(linkedinInput);

      setForm((f) => ({
        ...f,
        firstName: data.firstName || f.firstName,
        lastName: data.lastName || f.lastName,
        email: data.email || f.email,
        phone: data.phone || f.phone,
        skills: data.skills?.length ? data.skills.join(", ") : f.skills,
        experience: data.experience || f.experience,
        linkedinUrl: data.linkedinUrl || linkedinInput,
        source: f.source || "LinkedIn",
      }));
    } catch {
      setParseError("Failed to fetch LinkedIn profile. The profile may be private.");
    } finally {
      setFetchingLinkedIn(false);
    }
  }

  async function handleSubmit() {
    if (!form.firstName || !form.lastName || !form.email) return;
    setLoading(true);
    await createCandidate({
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email,
      phone: form.phone || undefined,
      skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
      experience: form.experience || undefined,
      source: form.source || undefined,
      positionId: form.positionId || undefined,
      linkedinUrl: form.linkedinUrl || undefined,
      resumeText: form.resumeText || undefined,
      notes: form.notes || undefined,
      costOfHire: form.costOfHire ? parseFloat(form.costOfHire) : undefined,
    });
    setForm({ firstName: "", lastName: "", email: "", phone: "", skills: "", experience: "", source: "", positionId: "", linkedinUrl: "", resumeText: "", notes: "", costOfHire: "" });
    setFileName("");
    setLinkedinInput("");
    setParseError("");
    setLoading(false);
    setOpen(false);
    router.refresh();
  }

  const inputClass = cn("w-full px-3 py-2 rounded-lg text-sm", "bg-[var(--color-background)] border border-[var(--color-border)]", "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]", "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40");

  return (
    <>
      <button onClick={() => setOpen(true)} className={cn("flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium", "bg-[var(--color-accent)] text-white", "hover:bg-[var(--color-accent-hover)] transition-colors", "shadow-[0_0_12px_var(--color-accent-glow)]")}>
        <Plus className="h-4 w-4" />Add Candidate
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Add Candidate">
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {/* PDF Upload Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center gap-2 p-4 rounded-lg cursor-pointer transition-colors",
              "border-2 border-dashed border-[var(--color-border)]",
              "hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-hover)]",
              parsing && "pointer-events-none opacity-70"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />
            {parsing ? (
              <>
                <Loader2 className="h-6 w-6 text-[var(--color-accent)] animate-spin" />
                <span className="text-sm text-[var(--color-text-muted)]">Parsing resume...</span>
              </>
            ) : fileName ? (
              <>
                <FileText className="h-6 w-6 text-[var(--color-accent)]" />
                <span className="text-sm text-[var(--color-text-primary)]">{fileName}</span>
                <span className="text-xs text-[var(--color-text-muted)]">Click or drop to replace</span>
              </>
            ) : (
              <>
                <Upload className="h-6 w-6 text-[var(--color-text-muted)]" />
                <span className="text-sm text-[var(--color-text-muted)]">Upload PDF resume to auto-fill fields</span>
                <span className="text-xs text-[var(--color-text-muted)]">Drop file here or click to browse</span>
              </>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[var(--color-border)]" />
            <span className="text-xs text-[var(--color-text-muted)]">or</span>
            <div className="flex-1 h-px bg-[var(--color-border)]" />
          </div>

          {/* LinkedIn URL Fetch */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
              <input
                value={linkedinInput}
                onChange={(e) => setLinkedinInput(e.target.value)}
                className={cn(inputClass, "pl-9")}
                placeholder="https://linkedin.com/in/johndoe"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleLinkedInFetch(); } }}
              />
            </div>
            <button
              onClick={handleLinkedInFetch}
              disabled={fetchingLinkedIn || !linkedinInput}
              className={cn(
                "px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap",
                "bg-[var(--color-accent)] text-white",
                "hover:bg-[var(--color-accent-hover)]",
                "disabled:opacity-50"
              )}
            >
              {fetchingLinkedIn ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fetch"}
            </button>
          </div>

          {parseError && (
            <p className="text-xs text-red-500">{parseError}</p>
          )}

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
            <input value={form.email} onChange={(e) => update("email", e.target.value)} type="email" className={inputClass} placeholder="john@email.com" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Phone</label>
            <input value={form.phone} onChange={(e) => update("phone", e.target.value)} className={inputClass} placeholder="+1 (555) 000-0000" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">LinkedIn URL</label>
            <input value={form.linkedinUrl} onChange={(e) => update("linkedinUrl", e.target.value)} className={inputClass} placeholder="https://linkedin.com/in/..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Position</label>
            <select value={form.positionId} onChange={(e) => update("positionId", e.target.value)} className={inputClass}>
              <option value="">Select position...</option>
              {positions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Source</label>
              <select value={form.source} onChange={(e) => update("source", e.target.value)} className={inputClass}>
                <option value="">Select...</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="Indeed">Indeed</option>
                <option value="Referral">Referral</option>
                <option value="Company Website">Company Website</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Experience</label>
              <input value={form.experience} onChange={(e) => update("experience", e.target.value)} className={inputClass} placeholder="5 years" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Skills (comma separated)</label>
            <input value={form.skills} onChange={(e) => update("skills", e.target.value)} className={inputClass} placeholder="React, TypeScript, Node.js" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Cost of Hire ($)</label>
            <input value={form.costOfHire} onChange={(e) => update("costOfHire", e.target.value)} type="number" className={inputClass} placeholder="0" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Resume / Notes</label>
            <textarea value={form.resumeText} onChange={(e) => update("resumeText", e.target.value)} rows={3} className={cn(inputClass, "resize-none")} placeholder="Paste resume text or notes about the candidate..." />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]">Cancel</button>
          <button onClick={handleSubmit} disabled={!form.firstName || !form.lastName || !form.email || loading} className={cn("px-4 py-2 rounded-lg text-sm font-medium", "bg-[var(--color-accent)] text-white", "hover:bg-[var(--color-accent-hover)]", "disabled:opacity-50")}>
            {loading ? "Adding..." : "Add Candidate"}
          </button>
        </div>
      </Dialog>
    </>
  );
}
