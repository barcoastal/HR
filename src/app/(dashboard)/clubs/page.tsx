import { cn } from "@/lib/utils";
import { requireAuth } from "@/lib/auth-helpers";
import { getClubs } from "@/lib/actions/clubs";
import { ClubCard } from "@/components/clubs/club-card";
import { CreateClubDialog } from "@/components/clubs/create-club-dialog";
import { Users2 } from "lucide-react";

export default async function ClubsPage() {
  const session = await requireAuth();
  const clubs = await getClubs();
  const employeeId = session.user.employeeId || "";

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Clubs</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Join interest groups and connect with colleagues</p>
        </div>
        <CreateClubDialog />
      </div>

      {clubs.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clubs.map((club) => (
            <ClubCard
              key={club.id}
              club={club as any}
              currentEmployeeId={employeeId}
            />
          ))}
        </div>
      ) : (
        <div className={cn("rounded-xl p-12 text-center", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
          <Users2 className="h-10 w-10 text-[var(--color-text-muted)] mx-auto mb-3" />
          <p className="text-[var(--color-text-muted)]">No clubs yet. Be the first to create one!</p>
        </div>
      )}
    </div>
  );
}
