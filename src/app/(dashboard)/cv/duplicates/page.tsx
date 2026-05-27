import { requireManagerOrAdmin } from "@/lib/auth-helpers";
import { findDuplicateCandidates } from "@/lib/actions/candidate-duplicates";
import { PageHeader } from "@/components/ui/page-header";
import { Icon } from "@/components/ui/icon";
import { DuplicatesView } from "@/components/cv/duplicates-view";

export const dynamic = "force-dynamic";

export default async function DuplicatesPage() {
  await requireManagerOrAdmin();
  const groups = await findDuplicateCandidates();

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <PageHeader
        title="Possible Duplicates"
        description="Candidates that look like the same person across phone, name, or normalized email."
      />

      {groups.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center">
          <Icon name="verified" size={36} className="text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-[var(--color-text-primary)]">No duplicates detected</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            The platform already blocks exact-email duplicates. We surface here when phone, name, or normalized email (Gmail dots/aliases) collides.
          </p>
        </div>
      ) : (
        <DuplicatesView groups={groups} />
      )}
    </div>
  );
}
