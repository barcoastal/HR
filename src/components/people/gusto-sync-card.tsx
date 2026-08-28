import { Icon } from "@/components/ui/icon";
import { getGustoMatches } from "@/lib/actions/gusto-sync";
import type { GustoMatch } from "@/lib/gusto-sync/types";
import { GustoApplyButton, GustoDiff, GustoMatchChip } from "./gusto-compare";

const CARD = "rounded-[var(--radius-lg)] bg-[var(--color-surface-container-lowest)] p-6";

function CardHeading({ children }: { children?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--color-text-primary)]">
          <Icon name="sync_alt" size={20} />
          Gusto record
        </h2>
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">What payroll has on file, compared with this profile.</p>
      </div>
      {children}
    </div>
  );
}

/** Suspense fallback while the Gusto directory is being pulled. */
export function GustoSyncCardSkeleton() {
  return (
    <section className={CARD}>
      <CardHeading />
      <p className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
        <Icon name="progress_activity" size={14} className="animate-material-spin" />
        Checking Gusto…
      </p>
    </section>
  );
}

/** Server component: the Gusto diff + apply for one person. Admin/HR only — the page gates it. */
export async function GustoSyncCard({ employeeId }: { employeeId: string }) {
  let match: GustoMatch | null = null;
  let error: string | null = null;
  try {
    const result = await getGustoMatches([employeeId]);
    match = result.matches[employeeId] ?? null;
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not reach Gusto";
  }

  return (
    <section className={CARD}>
      <CardHeading>
        {match && (
          <span className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            {match.gustoName}
            <GustoMatchChip matchedBy={match.matchedBy} />
          </span>
        )}
      </CardHeading>
      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div>
      ) : (
        <>
          <GustoDiff match={match} />
          {match && match.changes.length > 0 && <GustoApplyButton employeeId={employeeId} className="mt-4" />}
        </>
      )}
    </section>
  );
}
