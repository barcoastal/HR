"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { Dialog } from "@/components/ui/dialog";
import {
  compareSystemPeople,
  dismissSystemGroup,
  mergeSystemGroup,
  scanSystemDuplicates,
  type SystemGroup,
  type SystemMergeResult,
  type SystemScan,
} from "@/lib/actions/duplicates";
import { mergeEmployeeData } from "@/lib/import-export/merge";
import { planMergeLogins, type GroupLogin } from "@/lib/import-export/merge-logins";
import type { Badge } from "./row-editor";
import { BUTTON } from "./row-editor";
import { ComparePeoplePicker } from "./compare-people-picker";
import {
  CompareTable,
  Note,
  REASON_LABEL,
  TableFooter,
  employeeMember,
  useMergeState,
  type FieldChoices,
  type Overrides,
  type PanelMember,
} from "./compare-table";

/**
 * /data → Duplicates: scan every non-archived person for look-alikes (spec §6), compare them side
 * by side, and either merge them into one record or mark them as not duplicates. With
 * `?people=a,b` the tab instead compares people HR picked by hand (the profile's "Merge duplicate"
 * link lands here with one id, which opens the picker).
 */

const SCAN_URL = "/data?tab=duplicates";

const LOGIN_BADGE: Badge = { label: "Has login", className: "bg-blue-500/10 text-blue-600" };

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "Something went wrong";
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

function joinNames(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function mergeNotice(r: SystemMergeResult): string {
  const moved = Object.values(r.moved).reduce((a, b) => a + b, 0);
  const dropped = Object.values(r.dropped).reduce((a, b) => a + b, 0);
  const parts = [`Merged ${joinNames(r.mergedNames)} into ${r.primaryName}.`];
  parts.push(moved > 0 ? `${plural(moved, "linked record")} moved over` : "No linked records needed moving");
  if (dropped > 0) parts[parts.length - 1] += `, ${dropped} already existed on ${r.primaryName} and ${dropped === 1 ? "was" : "were"} dropped`;
  parts[parts.length - 1] += ".";
  if (r.relinkedUser) parts.push(`The login ${r.relinkedUser} now belongs to ${r.primaryName}.`);
  if (r.detachedUsers.length > 0) parts.push(`Detached ${plural(r.detachedUsers.length, "login")}: ${r.detachedUsers.join(", ")}.`);
  for (const n of r.notes) parts.push(n.endsWith(".") ? n : `${n}.`);
  return parts.join(" ");
}

export function SystemDuplicatesView() {
  const router = useRouter();
  const params = useSearchParams();
  const involving = params.get("involving") || undefined;
  const peopleParam = params.get("people") ?? "";
  const pickedIds = useMemo(() => Array.from(new Set(peopleParam.split(",").map((s) => s.trim()).filter(Boolean))), [peopleParam]);
  const manual = pickedIds.length >= 2;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [scan, setScan] = useState<SystemScan | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scanning, startScan] = useTransition();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const applyScan = useCallback((next: SystemScan) => {
    setScan(next);
    setSelectedId((prev) => (prev && next.groups.some((g) => g.id === prev) ? prev : next.groups[0]?.id ?? null));
  }, []);

  const load = useCallback(() => {
    setError(null);
    startScan(async () => {
      try {
        applyScan(manual ? await compareSystemPeople(pickedIds) : await scanSystemDuplicates({ involvingStatus: involving }));
      } catch (e) {
        setError(errorMessage(e));
      }
    });
  }, [applyScan, involving, manual, pickedIds]);

  useEffect(() => {
    load();
  }, [load]);

  // One person in the URL (the profile's "Merge duplicate" link): open the picker with them already selected.
  useEffect(() => {
    if (pickedIds.length === 1) setPickerOpen(true);
  }, [pickedIds]);

  function closePicker() {
    setPickerOpen(false);
    if (pickedIds.length === 1) router.replace(SCAN_URL);
  }

  /** Run an action, show its message, then re-scan so the list reflects the new state. */
  function run(fn: () => Promise<string>) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const message = await fn();
        setNotice(message);
        if (manual) {
          // The pair HR picked is merged or dismissed — back to the scan.
          setScan(null);
          router.replace(SCAN_URL);
        } else {
          applyScan(await scanSystemDuplicates({ involvingStatus: involving }));
        }
      } catch (e) {
        setError(errorMessage(e));
      }
    });
  }

  const busy = scanning || pending;
  const selected = scan?.groups.find((g) => g.id === selectedId);
  const groupTitle = (g: SystemGroup) => Array.from(new Set(g.members.map((m) => scan?.employees[m.id]?.name ?? "Unknown person"))).join(" · ");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {!manual && (
          <button type="button" className={BUTTON.primary} disabled={busy} onClick={load}>
            <Icon name={scanning ? "progress_activity" : "person_search"} size={14} className={cn(scanning && "animate-material-spin")} />
            {scanning ? "Scanning…" : "Scan now"}
          </button>
        )}
        <button type="button" className={BUTTON.secondary} disabled={busy} onClick={() => setPickerOpen(true)}>
          <Icon name="compare_arrows" size={14} /> Compare people…
        </button>
        {manual && (
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/5 px-2.5 py-1 text-xs text-amber-700">
            <Icon name="touch_app" size={14} /> Comparing {plural(pickedIds.length, "person", "people")} you picked
            <Link href={SCAN_URL} className="font-medium underline">Back to the scan</Link>
          </span>
        )}
        {involving && (
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/5 px-2.5 py-1 text-xs text-amber-700">
            <Icon name="filter_alt" size={14} /> Only groups that include a {involving.toLowerCase()} person
            <Link href={SCAN_URL} className="font-medium underline">Show all</Link>
          </span>
        )}
        {scan && !manual && (
          <p className="text-xs text-[var(--color-text-muted)]">
            {scan.groups.length === 0 ? "No possible duplicates" : plural(scan.groups.length, "possible duplicate group")} among{" "}
            {plural(scan.scanned, "person", "people")} · scanned {new Date(scan.scannedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            {" · "}The email you pick in the Result column decides which login the merged person keeps.
          </p>
        )}
        {pending && (
          <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
            <Icon name="progress_activity" size={14} className="animate-material-spin" /> Working…
          </span>
        )}
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      {notice && (
        <p className="inline-flex items-start gap-1.5 text-xs text-emerald-600">
          <Icon name="check_circle" size={14} className="shrink-0 mt-px" /> <span>{notice}</span>
        </p>
      )}

      {!scan ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-12 text-center text-sm text-[var(--color-text-muted)]">
          {error ? (manual ? "These people could not be compared." : "The scan could not run.") : manual ? "Loading the people you picked…" : "Scanning everyone for look-alikes…"}
        </div>
      ) : scan.groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-12 text-center text-sm text-[var(--color-text-muted)]">
          <Icon name="verified" size={28} className="text-emerald-500" />
          <p className="mt-2">No possible duplicates among {plural(scan.scanned, "person", "people")}.</p>
          <p className="mt-1 text-xs">People match on the same email, phone number or name. Pairs marked “Not duplicates” never show up again.</p>
          <p className="mt-1 text-xs">Don’t see the pair you mean? Use “Compare people…” to pick them by hand.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
            <div className="px-4 py-2 border-b border-[var(--color-border)] text-xs font-medium text-[var(--color-text-muted)]">
              Possible duplicates ({scan.groups.length})
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
              {scan.groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedId(g.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors",
                    selectedId === g.id && "bg-[var(--color-accent)]/5",
                  )}
                >
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">{groupTitle(g)}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {g.reasons.map((r) => (
                      <span key={r} className="px-1.5 py-0.5 rounded-full bg-[var(--color-surface-container)] text-[10px] text-[var(--color-text-muted)]">
                        {REASON_LABEL[r] ?? r}
                      </span>
                    ))}
                    <span className="ml-auto text-[10px] font-medium text-[var(--color-text-muted)]">{plural(g.members.length, "record")}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="min-w-0">
            {selected ? (
              <SystemComparePanel
                key={selected.id}
                scan={scan}
                group={selected}
                busy={busy}
                onMerge={(primaryId, duplicateIds, choices, overrides) =>
                  run(async () => mergeNotice(await mergeSystemGroup(primaryId, duplicateIds, choices, overrides)))
                }
                onDismiss={(ids) =>
                  run(async () => {
                    await dismissSystemGroup(ids);
                    return `Marked ${joinNames(ids.map((id) => scan.employees[id]?.name ?? "Unknown person"))} as not duplicates — they won’t be paired again.`;
                  })
                }
              />
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--color-border)] p-12 text-center text-sm text-[var(--color-text-muted)]">
                Select a group to compare the records.
              </div>
            )}
          </div>
        </div>
      )}

      <ComparePeoplePicker open={pickerOpen} onClose={closePicker} initialIds={pickedIds.length === 1 ? pickedIds : EMPTY_IDS} />
    </div>
  );
}

const EMPTY_IDS: string[] = [];

// ---------------------------------------------------------------------------
// Compare + merge for one group
// ---------------------------------------------------------------------------

function SystemComparePanel({
  scan,
  group,
  busy,
  onMerge,
  onDismiss,
}: {
  scan: SystemScan;
  group: SystemGroup;
  busy: boolean;
  onMerge: (primaryId: string, duplicateIds: string[], choices: FieldChoices, overrides: Overrides) => void;
  onDismiss: (memberIds: string[]) => void;
}) {
  const members = useMemo<PanelMember[]>(
    () => group.members.map((ref) => employeeMember(ref, scan.employees[ref.id], scan.logins[ref.id] ? [LOGIN_BADGE] : [])),
    [group, scan],
  );
  const liveMembers = members.filter((m) => m.live);
  const canDecide = liveMembers.length >= 2;
  const merge = useMergeState(liveMembers, canDecide);
  const [confirming, setConfirming] = useState(false);

  const primaryId = merge.primary?.id ?? null;
  const primary = primaryId ? scan.employees[primaryId] : undefined;
  const duplicates = primaryId ? liveMembers.filter((m) => m.ref.id !== primaryId) : [];

  // What the server will do with logins — the same rule it applies (`planMergeLogins`): the
  // Result column's email picks the login that survives; the others are detached and deactivated.
  const resultEmail = useMemo(() => {
    if (!merge.primary) return undefined;
    try {
      return mergeEmployeeData(liveMembers, merge.primary, merge.choices, merge.overrides).email;
    } catch {
      return undefined;
    }
  }, [liveMembers, merge.primary, merge.choices, merge.overrides]);
  const logins: GroupLogin[] = liveMembers.flatMap((m) =>
    scan.logins[m.ref.id] ? [{ userId: m.ref.id, employeeId: m.ref.id, email: scan.logins[m.ref.id] }] : [],
  );
  const loginPlan = primaryId ? planMergeLogins({ primaryId, duplicateIds: duplicates.map((m) => m.ref.id), logins, resultEmail }) : null;
  const nameOf = (id: string) => scan.employees[id]?.name ?? "Unknown person";

  function confirm() {
    if (!primaryId) return;
    setConfirming(false);
    onMerge(primaryId, duplicates.map((m) => m.ref.id), merge.choices, merge.overrides);
    merge.cancel();
  }

  return (
    <>
      <CompareTable
        members={members}
        groupId={group.id}
        reasons={group.reasons}
        busy={busy}
        merging={merge.merging}
        primary={merge.primary}
        choices={merge.choices}
        overrides={merge.overrides}
        onChoosePrimary={merge.choosePrimary}
        onChooseField={merge.chooseField}
        onEdit={merge.edit}
        onReset={merge.reset}
        footer={
          <TableFooter>
            {!canDecide && <Note icon="info">Fewer than two of these people still exist — scan again.</Note>}
            {canDecide && !merge.merging && (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className={BUTTON.primary} disabled={busy} onClick={merge.enter}>
                  <Icon name="call_merge" size={14} /> Merge into one
                </button>
                <button type="button" className={BUTTON.secondary} disabled={busy} onClick={() => onDismiss(liveMembers.map((m) => m.ref.id))}>
                  <Icon name="person_check" size={14} /> Not duplicates
                </button>
                <span className="basis-full">
                  <Note icon="info">
                    Merging keeps one record and moves everything attached to the others onto it, then deletes them. “Not duplicates” hides this group for good.
                  </Note>
                </span>
              </div>
            )}
            {merge.merging && (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className={BUTTON.secondary} disabled={busy} onClick={merge.cancel}>
                  Cancel
                </button>
                <button type="button" className={BUTTON.primary} disabled={busy || !primary} onClick={() => setConfirming(true)}>
                  <Icon name="check" size={14} /> Merge into one
                </button>
                <span className="basis-full">
                  <Note icon="warning" tone="warn">
                    This deletes {plural(duplicates.length, "record")} and can’t be undone.
                  </Note>
                </span>
              </div>
            )}
          </TableFooter>
        }
      />

      <Dialog open={confirming && !!primary} onClose={() => setConfirming(false)} title="Merge these people?">
        {primary && (
          <div className="space-y-4 text-sm text-[var(--color-text-primary)]">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Kept</p>
              <p className="mt-1 font-medium">
                {primary.name} <span className="font-normal text-[var(--color-text-muted)]">· {primary.data.email ?? "no email"}</span>
              </p>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">Updated with the Result column exactly as shown.</p>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-red-500">Deleted</p>
              <ul className="mt-1 space-y-1">
                {duplicates.map((m) => (
                  <li key={m.key} className="font-medium">
                    {m.name} <span className="font-normal text-[var(--color-text-muted)]">· {m.data.email ?? "no email"}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                Everything attached to {duplicates.length === 1 ? "this record" : "these records"} — tasks, documents, reviews, 1:1s, time off, feed activity,
                chat, notifications, HR notes, training, clubs, signing requests, direct reports — moves to {primary.name}. Where {primary.name} already has
                the same item (the same club membership, say), the duplicate’s copy is dropped.
              </p>
            </div>

            {loginPlan?.kept && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Login</p>
                <ul className="mt-1 space-y-1 text-xs">
                  <li className="inline-flex items-start gap-1.5 text-[var(--color-text-primary)]">
                    <Icon name="link" size={14} className="shrink-0 mt-px" />
                    <span>
                      {loginPlan.kept.email} stays active as {primary.name}’s login
                      {loginPlan.kept.employeeId !== primaryId ? ` (moved over from ${nameOf(loginPlan.kept.employeeId)})` : ""}, and the profile keeps
                      that address as its email.
                    </span>
                  </li>
                  {loginPlan.notes.map((n) => (
                    <li key={n} className="inline-flex items-start gap-1.5 text-amber-600">
                      <Icon name="info" size={14} className="shrink-0 mt-px" />
                      <span>{n}. To keep a different login, pick its address in the Email row of the Result column.</span>
                    </li>
                  ))}
                  {loginPlan.detached.map((l) => (
                    <li key={l.email} className="inline-flex items-start gap-1.5 text-amber-600">
                      <Icon name="link_off" size={14} className="shrink-0 mt-px" />
                      <span>
                        {l.email} will be detached and deactivated — it can no longer sign in. To keep this one instead, pick it in the Email row of
                        the Result column.
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-amber-600 inline-flex items-start gap-1.5">
              <Icon name="warning" size={14} className="shrink-0 mt-px" /> <span>This can’t be undone.</span>
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className={BUTTON.secondary} onClick={() => setConfirming(false)}>
                Cancel
              </button>
              <button type="button" className={cn(BUTTON.primary, "bg-red-500 hover:bg-red-600")} onClick={confirm}>
                <Icon name="call_merge" size={14} /> Merge and delete {plural(duplicates.length, "record")}
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
