import { cn } from "@/lib/utils";
import { AnimatedCounterClient } from "./stat-card-client";
import type { ReactNode } from "react";

const colorSchemes = {
  blue: {
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-600",
    accent: "from-blue-500 to-indigo-500",
  },
  emerald: {
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-600",
    accent: "from-emerald-500 to-teal-500",
  },
  amber: {
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-600",
    accent: "from-amber-500 to-orange-500",
  },
  red: {
    iconBg: "bg-red-500/10",
    iconColor: "text-red-600",
    accent: "from-red-500 to-rose-500",
  },
  purple: {
    iconBg: "bg-purple-500/10",
    iconColor: "text-purple-600",
    accent: "from-purple-500 to-violet-500",
  },
  cyan: {
    iconBg: "bg-cyan-500/10",
    iconColor: "text-cyan-600",
    accent: "from-cyan-500 to-blue-500",
  },
  rose: {
    iconBg: "bg-rose-500/10",
    iconColor: "text-rose-600",
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
        "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 md:p-5 transition-all duration-300 hover:shadow-xl",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--color-text-muted)] truncate">
            {title}
          </p>
          <p className="mt-1 md:mt-2 text-xl md:text-2xl font-bold text-[var(--color-text-primary)]">
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
                  ? "text-emerald-600"
                  : "text-red-600"
              )}
            >
              {trend.value >= 0 ? "+" : ""}
              {trend.value}% {trend.label}
            </p>
          )}
        </div>
        <div
          className={cn(
            "flex h-9 w-9 md:h-11 md:w-11 shrink-0 items-center justify-center rounded-xl",
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
