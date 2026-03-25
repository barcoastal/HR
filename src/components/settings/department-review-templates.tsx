"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveDepartmentReviewTemplate, deleteDepartmentReviewTemplate } from "@/lib/actions/reviews";
import { TemplateBuilder } from "@/components/reviews/template-builder";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

type Department = { id: string; name: string };
type Template = {
  departmentId: string;
  departmentName: string;
  name: string;
  selfTemplate: unknown;
  managerTemplate: unknown;
};

export function DepartmentReviewTemplates({
  departments,
  templates,
}: {
  departments: Department[];
  templates: Template[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null); // departmentId
  const [templateName, setTemplateName] = useState("");
  const [selfFields, setSelfFields] = useState<unknown[]>([]);
  const [managerFields, setManagerFields] = useState<unknown[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"self" | "manager">("self");

  function startEdit(deptId: string) {
    const existing = templates.find((t) => t.departmentId === deptId);
    setEditing(deptId);
    setTemplateName(existing?.name || "Default Review");
    setSelfFields((existing?.selfTemplate as unknown[]) || []);
    setManagerFields((existing?.managerTemplate as unknown[]) || []);
    setActiveTab("self");
  }

  function cancel() {
    setEditing(null);
    setTemplateName("");
    setSelfFields([]);
    setManagerFields([]);
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    try {
      await saveDepartmentReviewTemplate({
        departmentId: editing,
        name: templateName || "Default Review",
        selfTemplate: selfFields.length > 0 ? selfFields : null,
        managerTemplate: managerFields.length > 0 ? managerFields : null,
      });
      cancel();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(deptId: string) {
    if (!confirm("Remove the review template for this department?")) return;
    await deleteDepartmentReviewTemplate(deptId);
    router.refresh();
  }

  const editingDept = departments.find((d) => d.id === editing);

  return (
    <section className="rounded-xl p-6 bg-[var(--color-surface)] border border-[var(--color-border)]">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Icon name="rate_review" size={20} className="text-[var(--color-accent)]" />
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Review Templates by Department</h2>
            <p className="text-xs text-[var(--color-text-muted)]">
              Set default review forms per department. Used for anniversary reviews.
            </p>
          </div>
        </div>
      </div>

      {!editing && (
        <div className="space-y-2">
          {departments.map((dept) => {
            const tmpl = templates.find((t) => t.departmentId === dept.id);
            return (
              <div
                key={dept.id}
                className="flex items-center justify-between p-3 rounded-lg border border-[var(--color-border)]"
              >
                <div className="flex items-center gap-3">
                  <Icon name="business" size={16} className="text-[var(--color-text-muted)]" />
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{dept.name}</p>
                    {tmpl ? (
                      <p className="text-xs text-emerald-400">Template configured</p>
                    ) : (
                      <p className="text-xs text-[var(--color-text-muted)]">No template — uses default form</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEdit(dept.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors"
                  >
                    {tmpl ? "Edit" : "Set Template"}
                  </button>
                  {tmpl && (
                    <button
                      onClick={() => handleDelete(dept.id)}
                      className="p-1.5 rounded text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Icon name="delete" size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && editingDept && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="business" size={16} className="text-[var(--color-accent)]" />
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">{editingDept.name}</span>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-1">Template Name</label>
            <input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-primary)]"
            />
          </div>

          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setActiveTab("self")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                activeTab === "self" ? "bg-blue-500/15 text-blue-400" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              )}
            >
              Self Review Template
            </button>
            <button
              onClick={() => setActiveTab("manager")}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                activeTab === "manager" ? "bg-purple-500/15 text-purple-400" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              )}
            >
              Manager Review Template
            </button>
          </div>

          {activeTab === "self" && (
            <TemplateBuilder
              value={selfFields as any[]}
              onChange={(fields) => setSelfFields(fields)}
            />
          )}
          {activeTab === "manager" && (
            <TemplateBuilder
              value={managerFields as any[]}
              onChange={(fields) => setManagerFields(fields)}
            />
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Template"}
            </button>
            <button onClick={cancel} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-muted)]">
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
