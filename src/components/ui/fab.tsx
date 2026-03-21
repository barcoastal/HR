"use client";

import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

interface FABProps {
  icon: string;
  variant?: "gradient" | "solid";
  onClick?: () => void;
  className?: string;
}

export function FAB({ icon, variant = "solid", onClick, className }: FABProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "fixed bottom-8 right-8 z-50 flex items-center justify-center",
        "shadow-2xl shadow-[var(--color-primary)]/40",
        "hover:scale-110 active:scale-95 transition-all",
        variant === "gradient"
          ? "w-14 h-14 gradient-primary rounded-2xl"
          : "w-16 h-16 bg-[var(--color-primary)] rounded-full",
        "text-white",
        className
      )}
    >
      <Icon name={icon} size={28} />
    </button>
  );
}
