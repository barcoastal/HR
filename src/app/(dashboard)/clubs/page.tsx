import { cn } from "@/lib/utils";
import { requireAuth } from "@/lib/auth-helpers";
import { getClubs } from "@/lib/actions/clubs";
import { ClubCard } from "@/components/clubs/club-card";
import { CreateClubDialog } from "@/components/clubs/create-club-dialog";
import { Users2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

export default async function ClubsPage() {
  const session = await requireAuth();
  const clubs = await getClubs();
  const employeeId = session.user.employeeId || "";

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <PageHeader title="Clubs" description="Join interest groups and connect with colleagues" action={<CreateClubDialog />} />

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
        <div className={cn("rounded-2xl p-12 text-center", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
          <Users2 className="h-10 w-10 text-[var(--color-text-muted)] mx-auto mb-3" />
          <p className="text-[var(--color-text-muted)]">No clubs yet. Be the first to create one!</p>
        </div>
      )}
    </div>
  );
}
