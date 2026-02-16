"use client";

import { cn } from "@/lib/utils";
import { Users } from "lucide-react";
import { joinClub, leaveClub } from "@/lib/actions/clubs";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ClubData = {
  id: string;
  name: string;
  description: string | null;
  emoji: string;
  _count: { members: number };
  members: { employeeId: string }[];
};

export function ClubCard({
  club,
  currentEmployeeId,
}: {
  club: ClubData;
  currentEmployeeId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isMember = club.members.some((m) => m.employeeId === currentEmployeeId);

  async function handleToggle() {
    if (!currentEmployeeId) return;
    setLoading(true);
    if (isMember) {
      await leaveClub(club.id, currentEmployeeId);
    } else {
      await joinClub(club.id, currentEmployeeId);
    }
    setLoading(false);
    router.refresh();
  }

  return (
    <div className={cn("rounded-xl p-5", "bg-[var(--color-surface)] border border-[var(--color-border)]", "hover:border-[var(--color-accent)]/30 transition-colors")}>
      <div className="flex items-start gap-3 mb-3">
        <span className="text-3xl">{club.emoji}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{club.name}</h3>
          {club.description && (
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5 line-clamp-2">{club.description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
          <Users className="h-3.5 w-3.5" />
          <span>{club._count.members} member{club._count.members !== 1 ? "s" : ""}</span>
        </div>
        {currentEmployeeId && (
          <button
            onClick={handleToggle}
            disabled={loading}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              isMember
                ? "text-red-400 hover:bg-red-500/10"
                : "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]",
              "disabled:opacity-50"
            )}
          >
            {loading ? "..." : isMember ? "Leave" : "Join"}
          </button>
        )}
      </div>
    </div>
  );
}
