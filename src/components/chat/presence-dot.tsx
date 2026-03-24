"use client";

import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  ONLINE: "bg-[#22C55E]",
  AWAY: "bg-[#F59E0B]",
  DND: "bg-[#EF4444]",
  OFFLINE: "bg-gray-400",
};

const statusLabels: Record<string, string> = {
  ONLINE: "Online",
  AWAY: "Away",
  DND: "Do not disturb",
  OFFLINE: "Offline",
};

export function PresenceDot({
  status,
  size = "sm",
  className,
}: {
  status: string;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const sizeClass = size === "xs" ? "w-2 h-2" : size === "sm" ? "w-2.5 h-2.5" : "w-3 h-3";
  const color = statusColors[status] || statusColors.OFFLINE;

  return (
    <span
      className={cn(
        sizeClass,
        "rounded-full border-2 border-white inline-block",
        color,
        className
      )}
      title={statusLabels[status] || "Offline"}
    />
  );
}
