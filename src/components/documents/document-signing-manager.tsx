"use client";

import { useState, useMemo } from "react";
import { cn, formatDate } from "@/lib/utils";
import {
  FileText,
  Send,
  Plus,
  Download,
  Copy,
  RotateCcw,
  Ban,
  Clock,
  Eye,
  CheckCircle2,
  XCircle,
  Upload,
  Loader2,
  AlertTriangle,
  FileCheck,
  Inbox,
  Link2,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import {
  createStandaloneSigningRequest,
  resendSigningRequest,
  voidSigningRequest,
} from "@/lib/actions/signing";
import { useRouter } from "next/navigation";

type SigningRequest = {
  id: string;
  employeeId: string;
  employee: { id: string; firstName: string; lastName: string; email: string };
  token: string;
  documentUrl: string;
  documentName: string;
  status: string;
  signedDocUrl: string | null;
  signedAt: Date | null;
  viewedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  message: string | null;
  employeeTaskId: string | null;
};

type Props = {
  signingRequests: SigningRequest[];
  employees: { id: string; firstName: string; lastName: string; email: string }[];
  isAdmin?: boolean;
};

type FilterTab = "all" | "pending" | "signed" | "voided";

function getEffectiveStatus(request: SigningRequest): string {
  if (request.status === "SIGNED") return "SIGNED";
  if (request.status === "VOIDED") return "VOIDED";
  if (new Date(request.expiresAt) < new Date()) return "EXPIRED";
  return request.status;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
    PENDING: {
      bg: "bg-amber-500/10 border-amber-500/20",
      text: "text-amber-400",
      icon: <Clock className="h-3 w-3" />,
      label: "Pending",
    },
    VIEWED: {
      bg: "bg-blue-500/10 border-blue-500/20",
      text: "text-blue-400",
      icon: <Eye className="h-3 w-3" />,
      label: "Viewed",
    },
    SIGNED: {
      bg: "bg-emerald-500/10 border-emerald-500/20",
      text: "text-emerald-400",
      icon: <CheckCircle2 className="h-3 w-3" />,
      label: "Signed",
    },
    VOIDED: {
      bg: "bg-red-500/10 border-red-500/20",
      text: "text-red-400",
      icon: <XCircle className="h-3 w-3" />,
      label: "Voided",
    },
    EXPIRED: {
      bg: "bg-red-500/10 border-red-500/20",
      text: "text-red-400",
      icon: <AlertTriangle className="h-3 w-3" />,
      label: "Expired",
    },
  };

  const c = config[status] || config.PENDING;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border",
        c.bg,
        c.text
      )}
    >
      {c.icon}
      {c.label}
    </span>
  );
}

function SourceBadge({ isOnboarding }: { isOnboarding: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border",
        isOnboarding
          ? "bg-purple-500/10 border-purple-500/20 text-purple-400"
          : "bg-[var(--color-surface-hover)] border-[var(--color-border)] text-[var(--color-text-muted)]"
      )}
    >
      {isOnboarding ? "Onboarding" : "Manual"}
    </span>
  );
}

export function DocumentSigningManager({ signingRequests, employees, isAdmin = false }: Props) {
  const [filter, setFilter] = useState<FilterTab>("all");
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [docMessage, setDocMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadedDoc, setUploadedDoc] = useState<{ url: string; name: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [confirmVoidId, setConfirmVoidId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const router = useRouter();

  // Stats
  const stats = useMemo(() => {
    let total = 0;
    let pending = 0;
    let viewed = 0;
    let signed = 0;
    for (const r of signingRequests) {
      total++;
      const s = getEffectiveStatus(r);
      if (s === "PENDING") pending++;
      if (s === "VIEWED") viewed++;
      if (s === "SIGNED") signed++;
    }
    return { total, pending, viewed, signed };
  }, [signingRequests]);

  // Filtered requests
  const filtered = useMemo(() => {
    return signingRequests.filter((r) => {
      const s = getEffectiveStatus(r);
      if (filter === "pending") return s === "PENDING" || s === "VIEWED";
      if (filter === "signed") return s === "SIGNED";
      if (filter === "voided") return s === "VOIDED" || s === "EXPIRED";
      return true;
    });
  }, [signingRequests, filter]);

  // File upload handler
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/onboarding-docs/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setUploadedDoc({ url: data.url, name: data.name });
    } catch {
      alert("Failed to upload document. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  // Send for signing
  async function handleSend() {
    if (!selectedEmployeeId || !uploadedDoc) return;
    setSending(true);
    try {
      await createStandaloneSigningRequest({
        employeeId: selectedEmployeeId,
        documentUrl: uploadedDoc.url,
        documentName: uploadedDoc.name,
        message: docMessage || undefined,
      });
      setShowSendDialog(false);
      resetForm();
      router.refresh();
    } catch {
      alert("Failed to send signing request. Please try again.");
    } finally {
      setSending(false);
    }
  }

  function resetForm() {
    setSelectedEmployeeId("");
    setDocMessage("");
    setUploadedDoc(null);
  }

  // Resend
  async function handleResend(id: string) {
    setResendingId(id);
    try {
      await resendSigningRequest(id);
      router.refresh();
    } catch {
      alert("Failed to resend. Please try again.");
    } finally {
      setResendingId(null);
    }
  }

  // Void
  async function handleVoid(id: string) {
    setVoidingId(id);
    try {
      await voidSigningRequest(id);
      setConfirmVoidId(null);
      router.refresh();
    } catch {
      alert("Failed to void request. Please try again.");
    } finally {
      setVoidingId(null);
    }
  }

  // Copy link
  function handleCopyLink(token: string, id: string) {
    const url = `${window.location.origin}/sign/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const inputClass = cn(
    "w-full px-3 py-2 rounded-lg text-sm",
    "bg-[var(--color-background)] border border-[var(--color-border)]",
    "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
  );

  const accentButtonClass = cn(
    "px-4 py-2 rounded-lg text-sm font-medium",
    "bg-[var(--color-accent)] text-white",
    "hover:bg-[var(--color-accent-hover)]",
    "disabled:opacity-50"
  );

  const tabClass = (active: boolean) =>
    cn(
      "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
      active
        ? "bg-[var(--color-accent)] text-white"
        : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
    );

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Documents", value: stats.total, icon: <FileText className="h-4 w-4" /> },
          { label: "Pending", value: stats.pending, icon: <Clock className="h-4 w-4" /> },
          { label: "Awaiting Signature", value: stats.viewed, icon: <Eye className="h-4 w-4" /> },
          { label: "Signed", value: stats.signed, icon: <CheckCircle2 className="h-4 w-4" /> },
        ].map((stat) => (
          <div
            key={stat.label}
            className="glass-card rounded-xl p-4 border border-[var(--color-border)]"
          >
            <div className="flex items-center gap-2 text-[var(--color-text-muted)] mb-1">
              {stat.icon}
              <span className="text-xs font-medium">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Actions + Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)]">
          {(
            [
              { key: "all", label: "All" },
              { key: "pending", label: "Pending" },
              { key: "signed", label: "Signed" },
              { key: "voided", label: "Voided" },
            ] as { key: FilterTab; label: string }[]
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={tabClass(filter === tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowSendDialog(true)}
            className={cn(accentButtonClass, "flex items-center gap-2")}
          >
            <Plus className="h-4 w-4" />
            Send for Signing
          </button>
        )}
      </div>

      {/* Request List */}
      {filtered.length === 0 ? (
        <div className="glass-card rounded-xl border border-[var(--color-border)] p-12 text-center">
          <Inbox className="h-12 w-12 text-[var(--color-text-muted)] mx-auto mb-3 opacity-50" />
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
            No documents found
          </h3>
          <p className="text-sm text-[var(--color-text-muted)] max-w-sm mx-auto">
            {filter === "all"
              ? "Send your first document for signing to get started."
              : `No ${filter} documents at the moment.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((request) => {
            const effectiveStatus = getEffectiveStatus(request);
            const canResend = effectiveStatus === "PENDING" || effectiveStatus === "VIEWED";
            const canVoid = effectiveStatus !== "SIGNED";
            const isSigned = effectiveStatus === "SIGNED";

            return (
              <div
                key={request.id}
                className="glass-card rounded-xl border border-[var(--color-border)] p-4 hover:border-[var(--color-accent)]/30 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Document Info */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div
                      className={cn(
                        "flex-shrink-0 h-10 w-10 rounded-lg flex items-center justify-center",
                        isSigned
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                      )}
                    >
                      {isSigned ? (
                        <FileCheck className="h-5 w-5" />
                      ) : (
                        <FileText className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                          {request.documentName}
                        </h3>
                        <StatusBadge status={effectiveStatus} />
                        <SourceBadge isOnboarding={!!request.employeeTaskId} />
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        {request.employee.firstName} {request.employee.lastName}
                        <span className="mx-1.5 opacity-40">|</span>
                        {request.employee.email}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-[var(--color-text-muted)]">
                        <span>Sent {formatDate(request.createdAt)}</span>
                        {request.signedAt && (
                          <span>
                            <span className="mx-1 opacity-40">|</span>
                            Signed {formatDate(request.signedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {isSigned && request.signedDocUrl && (
                      <a
                        href={request.signedDocUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-emerald-400 transition-colors"
                        title="Download signed document"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    )}
                    <a
                      href={request.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] transition-colors"
                      title="Download original document"
                    >
                      <FileText className="h-4 w-4" />
                    </a>
                    {isAdmin && canResend && (
                      <button
                        onClick={() => handleResend(request.id)}
                        disabled={resendingId === request.id}
                        className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-blue-400 transition-colors disabled:opacity-50"
                        title="Resend email"
                      >
                        {resendingId === request.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCcw className="h-4 w-4" />
                        )}
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => handleCopyLink(request.token, request.id)}
                        className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] transition-colors"
                        title="Copy signing link"
                      >
                        {copiedId === request.id ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <Link2 className="h-4 w-4" />
                        )}
                      </button>
                    )}
                    {isAdmin && canVoid && (
                      <button
                        onClick={() => setConfirmVoidId(request.id)}
                        className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-red-500/10 hover:text-red-400 transition-colors"
                        title="Void request"
                      >
                        <Ban className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Send for Signing Dialog */}
      <Dialog
        open={showSendDialog}
        onClose={() => {
          setShowSendDialog(false);
          resetForm();
        }}
        title="Send Document for Signing"
      >
        <div className="space-y-4">
          {/* Employee Selector */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
              Recipient
            </label>
            <select
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              className={inputClass}
            >
              <option value="">Select an employee...</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.firstName} {emp.lastName} ({emp.email})
                </option>
              ))}
            </select>
          </div>

          {/* Document Upload */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
              Document
            </label>
            {uploadedDoc ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <FileCheck className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                <span className="text-sm text-emerald-400 truncate flex-1">
                  {uploadedDoc.name}
                </span>
                <button
                  onClick={() => setUploadedDoc(null)}
                  className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                >
                  Change
                </button>
              </div>
            ) : (
              <label
                className={cn(
                  "flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed cursor-pointer transition-colors",
                  "border-[var(--color-border)] hover:border-[var(--color-accent)]/50",
                  "bg-[var(--color-background)]",
                  uploading && "pointer-events-none opacity-60"
                )}
              >
                {uploading ? (
                  <Loader2 className="h-6 w-6 text-[var(--color-text-muted)] animate-spin" />
                ) : (
                  <Upload className="h-6 w-6 text-[var(--color-text-muted)]" />
                )}
                <span className="text-sm text-[var(--color-text-muted)]">
                  {uploading ? "Uploading..." : "Click to upload a document"}
                </span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            )}
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
              Message <span className="text-[var(--color-text-muted)] font-normal">(optional)</span>
            </label>
            <textarea
              value={docMessage}
              onChange={(e) => setDocMessage(e.target.value)}
              placeholder="Add a message for the recipient..."
              rows={3}
              className={inputClass}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={() => {
                setShowSendDialog(false);
                resetForm();
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={!selectedEmployeeId || !uploadedDoc || sending}
              className={cn(accentButtonClass, "flex items-center gap-2")}
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {sending ? "Sending..." : "Send for Signing"}
            </button>
          </div>
        </div>
      </Dialog>

      {/* Void Confirmation Dialog */}
      <Dialog
        open={!!confirmVoidId}
        onClose={() => setConfirmVoidId(null)}
        title="Void Signing Request"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-muted)]">
            Are you sure you want to void this signing request? The recipient will no longer be able
            to sign this document. This action cannot be undone.
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setConfirmVoidId(null)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => confirmVoidId && handleVoid(confirmVoidId)}
              disabled={!!voidingId}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {voidingId ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Ban className="h-4 w-4" />
              )}
              {voidingId ? "Voiding..." : "Void Request"}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
