import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "onboarding", label: "Onboarding", href: "/onboarding", icon: "person_add" },
  { id: "training", label: "Training", href: "/training", icon: "school" },
] as const;

export function OnboardingTabs({ active }: { active: "onboarding" | "training" }) {
  return (
    <nav aria-label="Onboarding sections" className="mb-7 flex gap-1 border-b border-[var(--color-border)]">
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "relative inline-flex h-11 items-center gap-2 px-3 text-sm font-medium transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-accent)]",
              selected
                ? "text-[var(--color-accent)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            )}
          >
            <Icon name={tab.icon} size={17} fill={selected} />
            {tab.label}
            {tab.id === "training" && (
              <span className="rounded-full bg-[var(--color-surface-hover)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)]">
                Selected hires
              </span>
            )}
            {selected && <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--color-accent)]" />}
          </Link>
        );
      })}
    </nav>
  );
}
