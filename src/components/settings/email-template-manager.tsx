"use client";

import { cn } from "@/lib/utils";
import { Mail, ChevronDown, ChevronUp, Save, Check, RotateCcw, Eye, Code, Copy } from "lucide-react";
import { useState } from "react";
import { upsertEmailTemplate, resetEmailTemplate } from "@/lib/actions/email-templates";
import { useRouter } from "next/navigation";

type TemplateData = {
  type: string;
  subject: string;
  body: string;
  variables: string[];
  description: string;
  isCustomized: boolean;
  id: string | null;
};

function TemplateEditor({ template }: { template: TemplateData }) {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();

  const hasChanges = subject !== template.subject || body !== template.body;

  async function handleSave() {
    setSaving(true);
    await upsertEmailTemplate({ type: template.type, subject, body });
    setSaved(true);
    setSaving(false);
    router.refresh();
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleReset() {
    if (!confirm("Reset this template to default? Your customizations will be lost.")) return;
    await resetEmailTemplate(template.type);
    router.refresh();
  }

  function getPreviewHtml() {
    const sampleVars: Record<string, string> = {
      firstName: "John",
      role: "Employee",
      loginUrl: "https://hr.example.com/login",
      documentName: "Employee Handbook",
      signingUrl: "https://hr.example.com/sign/abc123",
      assigneeName: "Sarah Smith",
      newHireName: "John Doe",
      taskTitle: "Complete I-9 Form",
      taskDescription: "Please complete the I-9 employment eligibility form.",
      body: "Welcome to the team! We're excited to have you.",
      documentUrl: "https://hr.example.com/docs/handbook.pdf",
      subject: "Welcome to Coastal HR",
    };

    let html = body;
    for (const [key, value] of Object.entries(sampleVars)) {
      html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }
    // Remove mustache-style conditionals for preview
    html = html.replace(/\{\{#\w+\}\}/g, "").replace(/\{\{\/\w+\}\}/g, "");
    return html;
  }

  const typeLabel = template.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className={cn("rounded-lg border", "border-[var(--color-border)] bg-[var(--color-background)]")}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full p-4 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">{typeLabel}</p>
            {template.isCustomized && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                Customized
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{template.description}</p>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-[var(--color-text-muted)] shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[var(--color-text-muted)] shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-[var(--color-border)] pt-4">
          {/* Variables */}
          <div>
            <p className="text-xs font-medium text-[var(--color-text-muted)] mb-2">Available variables (click to copy)</p>
            <div className="flex flex-wrap gap-1.5">
              {template.variables.map((v) => (
                <button
                  key={v}
                  onClick={() => navigator.clipboard.writeText(`{{${v}}}`)}
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono",
                    "bg-[var(--color-surface)] border border-[var(--color-border)]",
                    "text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors cursor-pointer"
                  )}
                >
                  <Copy className="h-3 w-3" />
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1.5">Subject Line</label>
            <input
              value={subject}
              onChange={(e) => { setSubject(e.target.value); setSaved(false); }}
              className={cn(
                "w-full px-3 py-2 rounded-lg text-sm font-mono",
                "bg-[var(--color-surface)] border border-[var(--color-border)]",
                "text-[var(--color-text-primary)]",
                "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
              )}
            />
          </div>

          {/* Body editor / preview toggle */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-[var(--color-text-primary)]">Email Body (HTML)</label>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowPreview(false)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors",
                    !showPreview
                      ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  )}
                >
                  <Code className="h-3 w-3" />Code
                </button>
                <button
                  onClick={() => setShowPreview(true)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors",
                    showPreview
                      ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  )}
                >
                  <Eye className="h-3 w-3" />Preview
                </button>
              </div>
            </div>

            {showPreview ? (
              <div
                className={cn(
                  "w-full min-h-[200px] p-4 rounded-lg",
                  "bg-white border border-[var(--color-border)]",
                  "text-sm text-gray-800"
                )}
              >
                <div
                  style={{ fontFamily: "sans-serif", maxWidth: 600, margin: "0 auto" }}
                  dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
                />
              </div>
            ) : (
              <textarea
                value={body}
                onChange={(e) => { setBody(e.target.value); setSaved(false); }}
                rows={10}
                className={cn(
                  "w-full px-3 py-2 rounded-lg text-sm font-mono leading-relaxed",
                  "bg-[var(--color-surface)] border border-[var(--color-border)]",
                  "text-[var(--color-text-primary)]",
                  "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40",
                  "resize-y"
                )}
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={handleReset}
              disabled={!template.isCustomized && !hasChanges}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium",
                "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]",
                "hover:bg-[var(--color-surface-hover)] transition-colors",
                "disabled:opacity-40 disabled:cursor-not-allowed"
              )}
            >
              <RotateCcw className="h-3.5 w-3.5" />Reset to Default
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className={cn(
                "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium",
                saved ? "bg-emerald-500 text-white" : "bg-[var(--color-accent)] text-white",
                saved ? "hover:bg-emerald-600" : "hover:bg-[var(--color-accent-hover)]",
                "transition-colors disabled:opacity-50"
              )}
            >
              {saved ? (
                <><Check className="h-3.5 w-3.5" />Saved!</>
              ) : saving ? (
                <>Saving...</>
              ) : (
                <><Save className="h-3.5 w-3.5" />Save Template</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function EmailTemplateManager({ templates }: { templates: TemplateData[] }) {
  return (
    <section className={cn("rounded-xl p-6", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
      <div className="flex items-center gap-2 mb-2">
        <Mail className="h-5 w-5 text-[var(--color-accent)]" />
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Email Templates</h2>
      </div>
      <p className="text-xs text-[var(--color-text-muted)] mb-4">
        Customize the emails sent by the system. Use {"{{variable}}"} placeholders for dynamic content.
      </p>

      <div className="space-y-2">
        {templates.map((t) => (
          <TemplateEditor key={t.type} template={t} />
        ))}
      </div>
    </section>
  );
}
