"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";
import { saveNotificationRules } from "@/lib/actions/notification-settings";
import { Icon } from "@/components/ui/icon";

type Rule = {
  id: string;
  action: string;
  channel: string;
  recipient: string;
  enabled: boolean;
};

type Employee = { id: string; firstName: string; lastName: string; email: string };
type Recipient = { id: string; employeeId: string; employee: Employee };

const ACTION_LABELS: Record<string, string> = {
  STAGE_CHANGE: "Candidate Stage Change",
  OFFER_SENT: "Offer Letter Sent",
  OFFER_SIGNED: "Offer Signed",
  DOCUMENT_SIGN_REQUEST: "Document Sign Request",
  DOCUMENT_SIGNED: "Document Signed",
  INTERVIEW_SCHEDULED: "Interview Scheduled",
  NEW_HIRE: "New Hire / Onboarding",
  TASK_ASSIGNED: "Task Assigned",
  ONBOARDING_COMPLETED: "Onboarding Completed",
};

const ACTIONS = Object.keys(ACTION_LABELS);
const EMAIL_RECIPIENTS = ["candidate", "recruiter", "manager", "hr_team"];
const INAPP_RECIPIENTS = ["recruiter", "manager", "hr_team"];
const RECIPIENT_LABELS: Record<string, string> = {
  candidate: "Candidate",
  recruiter: "Recruiter",
  manager: "Manager",
  hr_team: "HR Team",
};

export function NotificationSettings({
  initialRules,
  initialRecipients,
  allEmployees,
}: {
  initialRules: Rule[];
  initialRecipients: Recipient[];
  allEmployees: Employee[];
}) {
  const [rules, setRules] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const r of initialRules) {
      map[`${r.action}:${r.channel}:${r.recipient}`] = r.enabled;
    }
    return map;
  });
  const [hrTeamIds, setHrTeamIds] = useState<string[]>(initialRecipients.map((r) => r.employeeId));
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function getKey(action: string, channel: string, recipient: string) {
    return `${action}:${channel}:${recipient}`;
  }

  function toggle(action: string, channel: string, recipient: string) {
    const key = getKey(action, channel, recipient);
    setRules((prev) => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  }

  function isEnabled(action: string, channel: string, recipient: string) {
    return rules[getKey(action, channel, recipient)] ?? false;
  }

  async function handleSave() {
    setSaving(true);
    const ruleList = Object.entries(rules).map(([key, enabled]) => {
      const [action, channel, recipient] = key.split(":");
      return { action, channel, recipient, enabled };
    });
    await saveNotificationRules(ruleList, hrTeamIds);
    setSaving(false);
    setSaved(true);
  }

  const filteredEmployees = allEmployees.filter(
    (e) =>
      !hrTeamIds.includes(e.id) &&
      (`${e.firstName} ${e.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        e.email.toLowerCase().includes(search.toLowerCase()))
  );

  const inputClass = cn(
    "w-full px-3 py-2 rounded-lg text-sm",
    "bg-[var(--color-background)] border border-[var(--color-border)]",
    "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
  );

  return (
    <div className={cn("rounded-2xl p-6", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
      <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-4">Notification Settings</h3>
      <p className="text-xs text-[var(--color-text-muted)] mb-4">
        Control who receives email and in-app notifications for each action.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="text-left py-2 pr-4 font-medium text-[var(--color-text-primary)]">Action</th>
              <th colSpan={4} className="text-center py-2 px-1 font-medium text-[var(--color-text-primary)]">Email</th>
              <th className="w-px bg-[var(--color-border)]" />
              <th colSpan={3} className="text-center py-2 px-1 font-medium text-[var(--color-text-primary)]">In-App</th>
            </tr>
            <tr className="border-b border-[var(--color-border)]">
              <th />
              {EMAIL_RECIPIENTS.map((r) => (
                <th key={`eh-${r}`} className="text-center py-1 px-1 font-normal text-[var(--color-text-muted)]">
                  {RECIPIENT_LABELS[r]}
                </th>
              ))}
              <th className="w-px bg-[var(--color-border)]" />
              {INAPP_RECIPIENTS.map((r) => (
                <th key={`ih-${r}`} className="text-center py-1 px-1 font-normal text-[var(--color-text-muted)]">
                  {RECIPIENT_LABELS[r]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ACTIONS.map((action) => (
              <tr key={action} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-hover)]">
                <td className="py-2 pr-4 text-[var(--color-text-primary)] whitespace-nowrap">{ACTION_LABELS[action]}</td>
                {EMAIL_RECIPIENTS.map((r) => (
                  <td key={`e-${r}`} className="text-center py-2 px-1">
                    <input
                      type="checkbox"
                      checked={isEnabled(action, "EMAIL", r)}
                      onChange={() => toggle(action, "EMAIL", r)}
                      className="accent-[var(--color-accent)]"
                    />
                  </td>
                ))}
                <td className="w-px bg-[var(--color-border)]" />
                {INAPP_RECIPIENTS.map((r) => (
                  <td key={`i-${r}`} className="text-center py-2 px-1">
                    <input
                      type="checkbox"
                      checked={isEnabled(action, "IN_APP", r)}
                      onChange={() => toggle(action, "IN_APP", r)}
                      className="accent-[var(--color-accent)]"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* HR Team Recipients */}
      <div className="mt-6">
        <label className="block text-xs font-medium text-[var(--color-text-primary)] mb-2">
          HR Team Recipients
        </label>
        <p className="text-xs text-[var(--color-text-muted)] mb-2">
          These employees receive notifications for any action where &quot;HR Team&quot; is enabled.
        </p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {hrTeamIds.map((id) => {
            const emp = allEmployees.find((e) => e.id === id);
            if (!emp) return null;
            return (
              <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                {emp.firstName} {emp.lastName}
                <button onClick={() => { setHrTeamIds((prev) => prev.filter((x) => x !== id)); setSaved(false); }} className="hover:text-red-500">
                  <Icon name="close" size={12} />
                </button>
              </span>
            );
          })}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={inputClass}
          placeholder="Search employees to add..."
        />
        {search && (
          <div className="mt-1 max-h-32 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-background)]">
            {filteredEmployees.slice(0, 5).map((e) => (
              <button
                key={e.id}
                onClick={() => { setHrTeamIds((prev) => [...prev, e.id]); setSearch(""); setSaved(false); }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-[var(--color-surface-hover)]"
              >
                {e.firstName} {e.lastName} <span className="text-[var(--color-text-muted)]">({e.email})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end mt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium",
            "bg-[var(--color-accent)] text-white",
            "hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
          )}
        >
          {saving ? "Saving..." : saved ? "Saved!" : "Save"}
        </button>
      </div>
    </div>
  );
}
