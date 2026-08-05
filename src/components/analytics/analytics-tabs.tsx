"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/analytics", label: "Overview" },
  { href: "/analytics/testing", label: "Testing" },
];

export function AnalyticsTabs() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 mb-6 border-b border-[var(--color-border)]">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              active
                ? "border-[var(--color-accent)] text-[var(--color-accent)]"
                : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
