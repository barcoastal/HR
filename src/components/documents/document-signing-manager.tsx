"use client";

import { useState, useMemo } from "react";
import { cn, formatDate } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import {
  createStandaloneSigningRequest,
  resendSigningRequest,
  voidSigningRequest,
} from "@/lib/actions/signing";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { SignaturePlacementPicker, type PickerPlacement } from "@/components/signatures/signature-placement-picker";

type SigningRequest = {
  id: string;
  employeeId: string | null;
  candidateId?: string | null;
  signerName?: string | null;
  signerEmail?: string | null;
  employee: { id: string; firstName: string; lastName: string; email: string } | null;
  candidate?: { id: string; firstName: string; lastName: string; email: string } | null;
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
  employeeTask?: { documentAction: string | null } | null;
};

type Props = {
  signingRequests: SigningRequest[];
  employees: { id: string; firstName: string; lastName: string; email: string; departmentId?: string | null }[];
  departments?: { id: string; name: string }[];
  countersigners?: { id: string; firstName: string; lastName: string; jobTitle: string }[];
  isAdmin?: boolean;
  currentEmployeeId?: string | null;
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
      icon: <Icon name="schedule" size={12} />,
      label: "Pending",
    },
    VIEWED: {
      bg: "bg-blue-500/10 border-blue-500/20",
      text: "text-blue-400",
      icon: <Icon name="visibility" size={12} />,
      label: "Viewed",
    },
    SIGNED: {
      bg: "bg-emerald-500/10 border-emerald-500/20",
      text: "text-emerald-400",
      icon: <Icon name="check_circle" size={12} />,
      label: "Signed",
    },
    VOIDED: {
      bg: "bg-red-500/10 border-red-500/20",
      text: "text-red-400",
      icon: <Icon name="cancel" size={12} />,
      label: "Voided",
    },
    EXPIRED: {
      bg: "bg-red-500/10 border-red-500/20",
      text: "text-red-400",
      icon: <Icon name="warning" size={12} />,
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

export function DocumentSigningManager({ signingRequests, employees, departments = [], countersigners = [], isAdmin = false, currentEmployeeId }: Props) {
  const [filter, setFilter] = useState<FilterTab>("all");
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [sendAction, setSendAction] = useState<"sign" | "fill">("sign");
  const [recipientMode, setRecipientMode] = useState<"single" | "everyone" | "department">("single");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [docMessage, setDocMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadedDoc, setUploadedDoc] = useState<{ url: string; name: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [requiresCountersign, setRequiresCountersign] = useState(false);
  const [countersignerId, setCountersignerId] = useState("");
  const [placements, setPlacements] = useState<PickerPlacement[]>([]);
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

  // Send for signing or filling
  async function handleSend() {
    if (!uploadedDoc) return;

    // Build the recipient list
    let recipientIds: string[] = [];
    if (recipientMode === "single") {
      if (!selectedEmployeeId) return;
      recipientIds = [selectedEmployeeId];
    } else if (recipientMode === "everyone") {
      recipientIds = employees.map((e) => e.id);
      if (recipientIds.length === 0) return;
      if (!confirm(`Send "${uploadedDoc.name}" to all ${recipientIds.length} employees?`)) return;
    } else if (recipientMode === "department") {
      if (!selectedDepartmentId) return;
      recipientIds = employees.filter((e) => e.departmentId === selectedDepartmentId).map((e) => e.id);
      if (recipientIds.length === 0) { alert("No employees in that department."); return; }
      const dept = departments.find((d) => d.id === selectedDepartmentId)?.name || "that department";
      if (!confirm(`Send "${uploadedDoc.name}" to ${recipientIds.length} employee${recipientIds.length !== 1 ? "s" : ""} in ${dept}?`)) return;
    }

    if (requiresCountersign && !countersignerId) {
      alert("Please select a countersigner.");
      return;
    }
    const hasSig = placements.some((p) => p.kind === "signature");
    if (!hasSig) {
      alert("Please place at least one signature field on the document before sending.");
      return;
    }
    if (requiresCountersign && !placements.some((p) => p.kind === "countersignature")) {
      alert("Please place at least one countersignature field (for HR/management) on the document.");
      return;
    }
    setSending(true);
    setBulkProgress(recipientIds.length > 1 ? { done: 0, total: recipientIds.length } : null);
    try {
      const effectiveCountersignerId = requiresCountersign ? countersignerId : null;
      const SIZES: Record<PickerPlacement["kind"], { w: number; h: number }> = {
        signature: { w: 0.26, h: 0.08 },
        signatureDate: { w: 0.18, h: 0.04 },
        countersignature: { w: 0.26, h: 0.08 },
        countersignatureDate: { w: 0.18, h: 0.04 },
      };
      const storedPlacements = placements.map((p) => {
        const s = SIZES[p.kind];
        return {
          page: p.page,
          xPct: Math.max(0, Math.min(1 - s.w, p.xPct - s.w / 2)),
          yPct: Math.max(0, Math.min(1 - s.h, p.yPct - s.h / 2)),
          widthPct: s.w,
          heightPct: s.h,
          kind: p.kind,
        };
      });

      const errors: string[] = [];
      // Concurrent dispatch in chunks of 5 so many employees don't crush the API
      const chunkSize = 5;
      for (let i = 0; i < recipientIds.length; i += chunkSize) {
        const chunk = recipientIds.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (employeeId) => {
          try {
            if (sendAction === "fill") {
              const { sendDocForFilling } = await import("@/lib/actions/employee-documents");
              await sendDocForFilling(employeeId, uploadedDoc.url, uploadedDoc.name, effectiveCountersignerId, storedPlacements);
            } else {
              await createStandaloneSigningRequest({
                employeeId,
                documentUrl: uploadedDoc.url,
                documentName: uploadedDoc.name,
                message: docMessage || undefined,
                countersignerId: effectiveCountersignerId,
                signaturePlacements: storedPlacements,
              });
            }
          } catch (e) {
            errors.push(`${employeeId}: ${e instanceof Error ? e.message : "failed"}`);
          }
        }));
        setBulkProgress((bp) => bp ? { done: Math.min(bp.total, i + chunk.length), total: bp.total } : null);
      }

      if (errors.length > 0) {
        alert(`Sent with ${errors.length} error${errors.length !== 1 ? "s" : ""}. First: ${errors[0]}`);
      }
      setShowSendDialog(false);
      resetForm();
      router.refresh();
    } catch {
      alert(`Failed to send ${sendAction === "fill" ? "fill" : "signing"} request. Please try again.`);
    } finally {
      setSending(false);
      setBulkProgress(null);
    }
  }

  function resetForm() {
    setSelectedEmployeeId("");
    setSelectedDepartmentId("");
    setRecipientMode("single");
    setDocMessage("");
    setUploadedDoc(null);
    setSendAction("sign");
    setRequiresCountersign(false);
    setCountersignerId("");
    setPlacements([]);
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
  function handleCopyLink(token: string, id: string, isFill: boolean) {
    const url = `${window.location.origin}/${isFill ? "fill" : "sign"}/${token}`;
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
          { label: "Total Documents", value: stats.total, icon: <Icon name="description" size={16} /> },
          { label: "Pending", value: stats.pending, icon: <Icon name="schedule" size={16} /> },
          { label: "Awaiting Signature", value: stats.viewed, icon: <Icon name="visibility" size={16} /> },
          { label: "Signed", value: stats.signed, icon: <Icon name="check_circle" size={16} /> },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-[var(--color-surface-container-lowest)] rounded-xl p-4 border border-[var(--color-border)]"
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setSendAction("sign"); setShowSendDialog(true); }}
              className={cn(accentButtonClass, "flex items-center gap-2")}
            >
              <Icon name="draw" size={16} />
              Send for Signing
            </button>
            <button
              onClick={() => { setSendAction("fill"); setShowSendDialog(true); }}
              className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 bg-teal-600 text-white hover:bg-teal-700 transition-colors"
            >
              <Icon name="edit_document" size={16} />
              Send for Filling
            </button>
          </div>
        )}
      </div>

      {/* Request List */}
      {filtered.length === 0 ? (
        <div className="bg-[var(--color-surface-container-lowest)] rounded-xl border border-[var(--color-border)] p-12 text-center">
          <Icon name="inbox" size={48} className="text-[var(--color-text-muted)] mx-auto mb-3 opacity-50" />
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
            const isFillRequest = request.employeeTask?.documentAction === "FILL";

            return (
              <div
                key={request.id}
                className="bg-[var(--color-surface-container-lowest)] rounded-xl border border-[var(--color-border)] p-4 hover:border-[var(--color-accent)]/30 transition-colors"
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
                        <Icon name="task" size={20} />
                      ) : (
                        <Icon name="description" size={20} />
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
                        {request.employee
                          ? `${request.employee.firstName} ${request.employee.lastName}`
                          : request.signerName || "Unknown"}
                        <span className="mx-1.5 opacity-40">|</span>
                        {request.employee?.email || request.signerEmail || ""}
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
                    {/* Sign/Fill Now — for employee's own pending documents */}
                    {!isSigned && canResend && currentEmployeeId === request.employeeId && (
                      <a
                        href={`/${isFillRequest ? "fill" : "sign"}/${request.token}`}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold",
                          "bg-[var(--color-accent)] text-white",
                          "hover:bg-[var(--color-accent-hover)] transition-colors",
                        )}
                      >
                        <Icon name={isFillRequest ? "edit_document" : "edit_note"} size={12} />
                        {isFillRequest ? "Fill Now" : "Sign Now"}
                      </a>
                    )}
                    {isSigned && request.signedDocUrl && (
                      <a
                        href={request.signedDocUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-emerald-400 transition-colors"
                        title="Download signed document"
                      >
                        <Icon name="download" size={16} />
                      </a>
                    )}
                    <a
                      href={request.documentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] transition-colors"
                      title="Download original document"
                    >
                      <Icon name="description" size={16} />
                    </a>
                    {isAdmin && canResend && (
                      <button
                        onClick={() => handleResend(request.id)}
                        disabled={resendingId === request.id}
                        className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-blue-400 transition-colors disabled:opacity-50"
                        title="Resend email"
                      >
                        {resendingId === request.id ? (
                          <Icon name="progress_activity" size={16} className="animate-material-spin" />
                        ) : (
                          <Icon name="undo" size={16} />
                        )}
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => handleCopyLink(request.token, request.id, isFillRequest)}
                        className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] transition-colors"
                        title={isFillRequest ? "Copy fill link" : "Copy signing link"}
                      >
                        {copiedId === request.id ? (
                          <Icon name="check_circle" size={16} className="text-emerald-400" />
                        ) : (
                          <Icon name="link" size={16} />
                        )}
                      </button>
                    )}
                    {isAdmin && canVoid && (
                      <button
                        onClick={() => setConfirmVoidId(request.id)}
                        className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-red-500/10 hover:text-red-400 transition-colors"
                        title="Void request"
                      >
                        <Icon name="block" size={16} />
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
        title={sendAction === "fill" ? "Send Document for Filling" : "Send Document for Signing"}
      >
        <div className="space-y-4">
          {/* Recipient mode */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
              Send to
            </label>
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[var(--color-background)] border border-[var(--color-border)] mb-2">
              {(
                [
                  { v: "single", l: "One employee" },
                  { v: "everyone", l: `Everyone (${employees.length})` },
                  { v: "department", l: "By department" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setRecipientMode(opt.v)}
                  className={cn(
                    "flex-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                    recipientMode === opt.v
                      ? "bg-[var(--color-accent)] text-white"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  )}
                >
                  {opt.l}
                </button>
              ))}
            </div>
            {recipientMode === "single" && (
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
            )}
            {recipientMode === "department" && (
              <select
                value={selectedDepartmentId}
                onChange={(e) => setSelectedDepartmentId(e.target.value)}
                className={inputClass}
              >
                <option value="">Select department...</option>
                {departments.map((d) => {
                  const count = employees.filter((e) => e.departmentId === d.id).length;
                  return (
                    <option key={d.id} value={d.id}>{d.name} ({count} {count === 1 ? "person" : "people"})</option>
                  );
                })}
              </select>
            )}
            {recipientMode === "everyone" && (
              <p className="text-[11px] text-[var(--color-text-muted)] px-1">
                One signing request will be created for every active employee ({employees.length} total).
              </p>
            )}
            {bulkProgress && (
              <p className="text-[11px] text-[var(--color-accent)] mt-1 px-1">
                Sending {bulkProgress.done}/{bulkProgress.total}…
              </p>
            )}
          </div>

          {/* Document Upload */}
          <div>
            <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
              Document
            </label>
            {uploadedDoc ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <Icon name="task" size={16} className="text-emerald-400 flex-shrink-0" />
                <span className="text-sm text-emerald-400 truncate flex-1">
                  {uploadedDoc.name}
                </span>
                <button
                  onClick={() => { setUploadedDoc(null); setPlacements([]); }}
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
                  <Icon name="progress_activity" className="animate-material-spin text-[var(--color-text-muted)] animate-spin" />
                ) : (
                  <Icon name="upload" className="text-[var(--color-text-muted)]" />
                )}
                <span className="text-sm text-[var(--color-text-muted)]">
                  {uploading ? "Uploading..." : "Click to upload a document"}
                </span>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            )}
          </div>

          {/* Signature placement — only shown once a PDF is uploaded */}
          {uploadedDoc && uploadedDoc.url.toLowerCase().endsWith(".pdf") && (
            <div>
              <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1.5">
                Mark where fields go
              </label>
              <SignaturePlacementPicker
                pdfUrl={uploadedDoc.url}
                showCountersign={requiresCountersign}
                value={placements}
                onChange={setPlacements}
              />
            </div>
          )}
          {uploadedDoc && !uploadedDoc.url.toLowerCase().endsWith(".pdf") && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <Icon name="warning" size={16} className="text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800">
                Placement editor requires a PDF. Please re-upload as a PDF to mark where fields go.
              </p>
            </div>
          )}

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

          {/* Countersignature */}
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={requiresCountersign}
                onChange={(e) => setRequiresCountersign(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[var(--color-accent)]"
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--color-text-primary)]">Requires our signature too</p>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                  After the recipient signs, the document goes to a countersigner to sign as well.
                </p>
              </div>
            </label>
            {requiresCountersign && (
              <div className="mt-3 pl-7">
                <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Countersigner</label>
                {countersigners.length === 0 ? (
                  <p className="text-xs text-amber-500">
                    No eligible countersigners. Add an ADMIN or SUPER_ADMIN user in Settings.
                  </p>
                ) : (
                  <select
                    value={countersignerId}
                    onChange={(e) => setCountersignerId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select a countersigner…</option>
                    {countersigners.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.firstName} {c.lastName} — {c.jobTitle}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
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
              disabled={
                !uploadedDoc || sending ||
                (recipientMode === "single" && !selectedEmployeeId) ||
                (recipientMode === "department" && !selectedDepartmentId) ||
                (recipientMode === "everyone" && employees.length === 0)
              }
              className={cn(accentButtonClass, "flex items-center gap-2")}
            >
              {sending ? (
                <Icon name="progress_activity" size={16} className="animate-material-spin" />
              ) : (
                <Icon name="send" size={16} />
              )}
              {sending ? "Sending..." : sendAction === "fill" ? "Send for Filling" : "Send for Signing"}
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
                <Icon name="progress_activity" size={16} className="animate-material-spin" />
              ) : (
                <Icon name="block" size={16} />
              )}
              {voidingId ? "Voiding..." : "Void Request"}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
