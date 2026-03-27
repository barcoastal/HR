"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import type { NotificationPreferences } from "@/lib/actions/notification-preferences";

type PreferenceKey = keyof NotificationPreferences;

type PreferenceGroup = {
  label: string;
  description: string;
  icon: string;
  toggles: { key: PreferenceKey; label: string }[];
};

const GROUPS: PreferenceGroup[] = [
  {
    label: "Feed Posts",
    description: "New posts and announcements in the feed",
    icon: "article",
    toggles: [
      { key: "notifyFeedPostInApp", label: "In-App" },
      { key: "notifyFeedPostEmail", label: "Email" },
    ],
  },
  {
    label: "Events",
    description: "New events and calendar activities",
    icon: "event",
    toggles: [
      { key: "notifyFeedEventInApp", label: "In-App" },
      { key: "notifyFeedEventEmail", label: "Email" },
    ],
  },
  {
    label: "Comments",
    description: "When someone comments on your post",
    icon: "chat_bubble",
    toggles: [
      { key: "notifyCommentInApp", label: "In-App" },
      { key: "notifyCommentEmail", label: "Email" },
    ],
  },
  {
    label: "Reactions",
    description: "When someone reacts to your post",
    icon: "favorite",
    toggles: [{ key: "notifyReactionInApp", label: "In-App" }],
  },
  {
    label: "Shoutouts",
    description: "When you're mentioned in a shoutout",
    icon: "campaign",
    toggles: [
      { key: "notifyShoutoutInApp", label: "In-App" },
      { key: "notifyShoutoutEmail", label: "Email" },
    ],
  },
  {
    label: "Promotions",
    description: "When a team member gets promoted",
    icon: "trending_up",
    toggles: [
      { key: "notifyPromotionInApp", label: "In-App" },
      { key: "notifyPromotionEmail", label: "Email" },
    ],
  },
];

function Toggle({
  enabled,
  onChange,
  disabled,
}: {
  enabled: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
        enabled ? "bg-[var(--color-accent)]" : "bg-[var(--color-border)]",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
          enabled ? "translate-x-[18px]" : "translate-x-[3px]"
        )}
      />
    </button>
  );
}

export function NotificationPreferencesPanel({
  userId,
  initialPrefs,
}: {
  userId: string;
  initialPrefs: NotificationPreferences;
}) {
  const [prefs, setPrefs] = useState(initialPrefs);
  const [saving, setSaving] = useState(false);

  async function handleToggle(key: PreferenceKey) {
    const newValue = !prefs[key];
    setPrefs((prev) => ({ ...prev, [key]: newValue }));
    setSaving(true);
    try {
      const { updateNotificationPreferences } = await import(
        "@/lib/actions/notification-preferences"
      );
      await updateNotificationPreferences(userId, { [key]: newValue });
    } catch (err) {
      console.error("Failed to update preference:", err);
      setPrefs((prev) => ({ ...prev, [key]: !newValue }));
    } finally {
      setSaving(false);
    }
  }

  const masterOff = !prefs.emailNotificationsEnabled;

  return (
    <div className="space-y-4">
      {/* Master email toggle */}
      <div className="flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center">
            <Icon
              name="notifications"
              size={16}
              className="text-[var(--color-accent)]"
            />
          </div>
          <div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              Email Notifications
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">
              Master switch for all email notifications
            </p>
          </div>
        </div>
        <Toggle
          enabled={prefs.emailNotificationsEnabled}
          onChange={() => handleToggle("emailNotificationsEnabled")}
          disabled={saving}
        />
      </div>

      {/* Per-category preferences */}
      {GROUPS.map((group) => (
        <div
          key={group.label}
          className="flex items-center justify-between py-2"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-[var(--color-surface-container)] flex items-center justify-center shrink-0">
              <Icon
                name={group.icon}
                size={14}
                className="text-[var(--color-text-muted)]"
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                {group.label}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {group.description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {group.toggles.map((toggle) => {
              const isEmail = toggle.key.endsWith("Email");
              const disabled = saving || (isEmail && masterOff);
              return (
                <div
                  key={toggle.key}
                  className="flex items-center gap-1.5"
                >
                  <span
                    className={cn(
                      "text-[10px] uppercase tracking-wider font-medium",
                      disabled
                        ? "text-[var(--color-text-muted)]/50"
                        : "text-[var(--color-text-muted)]"
                    )}
                  >
                    {toggle.label}
                  </span>
                  <Toggle
                    enabled={isEmail && masterOff ? false : prefs[toggle.key]}
                    onChange={() => handleToggle(toggle.key)}
                    disabled={disabled}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {masterOff && (
        <p className="text-xs text-[var(--color-text-muted)] italic">
          Email notifications are off. Turn on the master switch to configure
          individual email preferences.
        </p>
      )}
    </div>
  );
}
