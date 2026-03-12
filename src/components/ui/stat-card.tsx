import { cn } from "@/lib/utils";
import { AnimatedCounterClient } from "./stat-card-client";
import type { ReactNode } from "react";

const colorSchemes = {
  blue: {
    iconBg: "bg-blue-500/10 dark:bg-blue-500/15",
    iconColor: "text-blue-600 dark:text-blue-400",
    accent: "from-blue-500 to-indigo-500",
  },
  emerald: {
    iconBg: "bg-emerald-500/10 dark:bg-emerald-500/15",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    accent: "from-emerald-500 to-teal-500",
  },
  amber: {
    iconBg: "bg-amber-500/10 dark:bg-amber-500/15",
    iconColor: "text-amber-600 dark:text-amber-400",
    accent: "from-amber-500 to-orange-500",
  },
  red: {
    iconBg: "bg-red-500/10 dark:bg-red-500/15",
    iconColor: "text-red-600 dark:text-red-400",
    accent: "from-red-500 to-rose-500",
  },
  purple: {
    iconBg: "bg-purple-500/10 dark:bg-purple-500/15",
    iconColor: "text-purple-600 dark:text-purple-400",
    accent: "from-purple-500 to-violet-500",
  },
  cyan: {
    iconBg: "bg-cyan-500/10 dark:bg-cyan-500/15",
    iconColor: "text-cyan-600 dark:text-cyan-400",
    accent: "from-cyan-500 to-blue-500",
  },
  rose: {
    iconBg: "bg-rose-500/10 dark:bg-rose-500/15",
    iconColor: "text-rose-600 dark:text-rose-400",
    accent: "from-rose-500 to-pink-500",
  },
} as const;

export type ColorScheme = keyof typeof colorSchemes;
export { colorSchemes };

interface StatCardProps {
  title: string;
  value: number | string;
  icon: ReactNode;
  color?: ColorScheme;
  suffix?: string;
  description?: string;
  trend?: { value: number; label: string };
  className?: string;
  animate?: boolean;
}

export function StatCard({
  title,
  value,
  icon,
  color = "blue",
  suffix,
  description,
  trend,
  className,
  animate = true,
}: StatCardProps) {
  const scheme = colorSchemes[color];
  const numValue = typeof value === "number" ? value : null;

  return (
    <div
      className={cn(
        "gradient-border rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-all duration-300 hover:shadow-xl",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--color-text-muted)] truncate">
            {title}
          </p>
          <p className="mt-2 text-2xl font-bold text-[var(--color-text-primary)]">
            {animate && numValue !== null ? (
              <AnimatedCounterClient value={numValue} />
            ) : (
              value
            )}
            {suffix && (
              <span className="text-lg font-medium text-[var(--color-text-muted)] ml-0.5">
                {suffix}
              </span>
            )}
          </p>
          {description && (
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {description}
            </p>
          )}
          {trend && (
            <p
              className={cn(
                "mt-1.5 text-xs font-medium",
                trend.value >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              )}
            >
              {trend.value >= 0 ? "+" : ""}
              {trend.value}% {trend.label}
            </p>
          )}
        </div>
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            scheme.iconBg,
            scheme.iconColor
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
