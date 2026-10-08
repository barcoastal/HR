/**
 * Which login a merged person keeps. Browser-safe (no database) so the compare screen can show
 * exactly what the merge will do before HR confirms it.
 *
 * Rule: the Result column's email decides. The group login whose address equals that email is
 * kept — wherever it lives — and every other login in the group is detached and deactivated.
 * When the Result email is not a login, the primary's login is kept (then the first duplicate's),
 * and the person's email stays on that login so sign-in keeps working.
 */

export type GroupLogin = { userId: string; employeeId: string; email: string };

export type MergeLoginPlan = {
  /** The login the merged person ends up with, or null when nobody in the group has one. */
  kept: GroupLogin | null;
  /** Logins that lose: detached from their person and deactivated so they cannot sign in. */
  detached: GroupLogin[];
  /** Why the Result email will not be applied, when that is the case. */
  notes: string[];
};

const normalize = (email: string | null | undefined) => (email ?? "").trim().toLowerCase();

export function planMergeLogins(args: {
  primaryId: string;
  duplicateIds: string[];
  logins: GroupLogin[];
  resultEmail?: string | null;
}): MergeLoginPlan {
  const { primaryId, duplicateIds, logins } = args;
  const byEmployee = new Map(logins.map((l) => [l.employeeId, l]));
  // Primary's login first, then the duplicates' in the order given.
  const candidates = [primaryId, ...duplicateIds].flatMap((id) => {
    const l = byEmployee.get(id);
    return l ? [l] : [];
  });
  if (candidates.length === 0) return { kept: null, detached: [], notes: [] };

  const wanted = normalize(args.resultEmail);
  const kept = candidates.find((l) => normalize(l.email) === wanted) ?? candidates[0];
  const detached = candidates.filter((l) => l !== kept);
  const notes = wanted && normalize(kept.email) !== wanted ? [`Email kept as ${kept.email} — it's the login`] : [];
  return { kept, detached, notes };
}
