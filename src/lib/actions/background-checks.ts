"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import {
  assertCandidateAccess,
  getRecruiterScope,
  requireAuth,
  requireManagerOrAdmin,
} from "@/lib/auth-helpers";
import { displayName } from "@/lib/utils";
import {
  findInvitationById,
  fireBgCheckCompleteNotification,
  getOrder,
  hasRecords,
  isContinentalConfigured,
  isInvitationKey,
  isInvitationSigned,
  listInvitations,
  mapOrderStatus,
  type ContinentalInvitation,
  type ContinentalOrder,
  type ContinentalSearch,
} from "@/lib/continental";
import {
  deriveBackgroundCheckStatus,
  isOpenBackgroundCheck,
  summarizeBackgroundChecks,
} from "@/lib/background-checks/status";
import type {
  BackgroundCheckDetail,
  BackgroundCheckList,
  BackgroundCheckRow,
  ProviderInvitation,
  ProviderOrder,
  RefreshBackgroundCheckResult,
  RefreshPendingResult,
  SimulateBackgroundCheckResult,
} from "@/lib/background-checks/types";

/**
 * Background Checks module — one place to see every Continental Screening
 * check and what the vendor has sent back, and to refresh a check on demand.
 *
 * Status transitions deliberately mirror the postback route
 * (src/app/api/background-check/postback/route.ts) and the invitation → order
 * linking in the status poll / bg-link-by-email cron, so a manual refresh can
 * never produce a different outcome than the automated paths.
 */

const PAGE_PATH = "/background-checks";

const candidateSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  recruiterId: true,
  backgroundCheckStatus: true,
  backgroundCheckId: true,
  backgroundCheckDate: true,
  backgroundReportFilename: true,
  backgroundReportImportedAt: true,
  preAdverseActionStatus: true,
  preAdverseActionSentAt: true,
  preAdverseActionDueAt: true,
  adverseActionLetterSentAt: true,
  updatedAt: true,
  position: { select: { title: true } },
} as const;

type CandidateRecord = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  recruiterId: string | null;
  backgroundCheckStatus: string | null;
  backgroundCheckId: string | null;
  backgroundCheckDate: Date | null;
  backgroundReportFilename: string | null;
  backgroundReportImportedAt: Date | null;
  preAdverseActionStatus: string | null;
  preAdverseActionSentAt: Date | null;
  preAdverseActionDueAt: Date | null;
  adverseActionLetterSentAt: Date | null;
  updatedAt: Date;
  position: { title: string } | null;
};

// ── Helpers ────────────────────────────────────────────────

function iso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

/** Continental order ids are numeric; anything else is an invitation, sandbox or legacy key. */
function isOrderId(key: string | null | undefined): boolean {
  return typeof key === "string" && /^\d+$/.test(key);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Continental timestamps look like "2026-08-01 12:34:56" — normalise when parseable. */
function providerDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

async function recruiterNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map();
  const employees = await db.employee.findMany({
    where: { id: { in: unique } },
    select: { id: true, firstName: true, lastName: true, preferredName: true },
  });
  return new Map(employees.map((e) => [e.id, displayName(e)]));
}

function toRow(candidate: CandidateRecord, recruiterName: string | null): BackgroundCheckRow {
  const checkId = candidate.backgroundCheckId || null;
  return {
    candidateId: candidate.id,
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    email: candidate.email,
    positionTitle: candidate.position?.title ?? null,
    recruiterName,
    status: deriveBackgroundCheckStatus(candidate.backgroundCheckStatus),
    rawStatus: candidate.backgroundCheckStatus ?? null,
    sentAt: iso(candidate.backgroundCheckDate),
    checkId,
    isInvitation: isInvitationKey(checkId),
    reportUrl:
      checkId && candidate.backgroundReportFilename
        ? `/api/background-check/${encodeURIComponent(checkId)}/pdf`
        : null,
    reportImportedAt: iso(candidate.backgroundReportImportedAt),
    preAdverseActionStatus: candidate.preAdverseActionStatus ?? null,
    preAdverseActionSentAt: iso(candidate.preAdverseActionSentAt),
    preAdverseActionDueAt: iso(candidate.preAdverseActionDueAt),
    adverseActionLetterSentAt: iso(candidate.adverseActionLetterSentAt),
    updatedAt: candidate.updatedAt.toISOString(),
  };
}

async function loadCandidate(candidateId: string): Promise<CandidateRecord> {
  const candidate = await db.candidate.findUnique({ where: { id: candidateId }, select: candidateSelect });
  if (!candidate) throw new Error("Candidate not found");
  return candidate;
}

async function rowFor(candidate: CandidateRecord): Promise<BackgroundCheckRow> {
  const names = await recruiterNames([candidate.recruiterId]);
  return toRow(candidate, candidate.recruiterId ? names.get(candidate.recruiterId) ?? null : null);
}

function toProviderOrder(order: ContinentalOrder, fallbackOrderId: string | null): ProviderOrder {
  return {
    orderId: order.OrderID ? String(order.OrderID) : fallbackOrderId,
    status: order.OrderStatus ?? null,
    searches: (order.Searches || []).map((search: ContinentalSearch) => {
      const records = parseInt(String(search.RecordsFound ?? ""), 10);
      return {
        id: search.SearchID ? String(search.SearchID) : null,
        name: search.SearchName || "Search",
        status: search.SearchStatus ?? null,
        recordsFound: Number.isFinite(records) ? records : null,
        flagged: hasRecords(search),
        notes: search.Notes || null,
      };
    }),
  };
}

function toProviderInvitation(invitation: ContinentalInvitation): ProviderInvitation {
  return {
    id: invitation.ID ? String(invitation.ID) : null,
    status: invitation.Status ?? null,
    applicantEmail: invitation.ApplicantEmail ?? null,
    createdAt: providerDate(invitation.DateCreated),
    signedAt: isInvitationSigned(invitation) ? providerDate(invitation.SignDate) : null,
    orderId: invitation.OrderID ? String(invitation.OrderID) : null,
  };
}

type ProviderState = {
  order: ContinentalOrder | null;
  invitation: ContinentalInvitation | null;
  /** Nothing to fetch for this key — informational. */
  note: string | null;
  /** Continental call failed. */
  error: string | null;
};

/**
 * Pull whatever Continental knows about a stored check key. Invitation keys
 * resolve through the invitations list (and on to the order once the
 * applicant has signed); numeric keys go straight to the order, with the
 * invitation looked up best-effort for the sign date.
 */
async function fetchProviderState(checkId: string | null): Promise<ProviderState> {
  const empty = { order: null, invitation: null, note: null, error: null };
  if (!checkId) return { ...empty, note: "No Continental order is linked to this candidate." };
  if (!isContinentalConfigured()) {
    return { ...empty, note: "Continental Screening credentials are not configured on this server." };
  }
  try {
    if (isInvitationKey(checkId)) {
      const invitationId = checkId.slice(4);
      const invitation = await findInvitationById(invitationId);
      if (!invitation) return { ...empty, error: `Invitation ${invitationId} was not found at Continental.` };
      if (!invitation.OrderID) return { ...empty, invitation };
      const order = await getOrder(String(invitation.OrderID));
      return { ...empty, invitation, order };
    }
    if (isOrderId(checkId)) {
      const order = await getOrder(checkId);
      let invitation: ContinentalInvitation | null = null;
      try {
        const invitations = await listInvitations();
        invitation = invitations.find((i) => String(i.OrderID ?? "") === checkId) || null;
      } catch {
        // invitation lookup is best-effort — the order alone is enough
      }
      return { ...empty, order, invitation };
    }
    return {
      ...empty,
      note: checkId.startsWith("SBX-")
        ? "Sandbox order — no Continental data to fetch."
        : "Legacy report key — this check was not ordered through Continental.",
    };
  } catch (err) {
    return { ...empty, error: errorMessage(err) };
  }
}

async function loadScopedCandidates(): Promise<CandidateRecord[]> {
  const scope = await getRecruiterScope();
  return db.candidate.findMany({
    where: {
      OR: [{ backgroundCheckId: { not: null } }, { backgroundCheckStatus: { not: null } }],
      ...(scope ? { recruiterId: scope } : {}),
    },
    select: candidateSelect,
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Re-fetch one check from Continental and apply the postback's transition
 * rules. Callers handle auth; this only touches data.
 */
async function performRefresh(candidate: CandidateRecord, bulk: boolean): Promise<RefreshBackgroundCheckResult> {
  const previousStatus = deriveBackgroundCheckStatus(candidate.backgroundCheckStatus);
  let checkId = candidate.backgroundCheckId;
  let linkedOrderId: string | null = null;
  let providerError: string | null = null;
  let newStatus: ReturnType<typeof mapOrderStatus> | null = null;
  let searches: ContinentalSearch[] | null = null;

  const state = await fetchProviderState(checkId);
  if (state.error) {
    providerError = state.error;
  } else if (state.note) {
    providerError = state.note;
  } else {
    // Invitation picked up its OrderID — swap the real id in, exactly like
    // the postback / status poll do, so the report route and polling work.
    if (checkId && isInvitationKey(checkId) && state.invitation?.OrderID) {
      linkedOrderId = String(state.invitation.OrderID);
      await db.candidate.update({ where: { id: candidate.id }, data: { backgroundCheckId: linkedOrderId } });
      checkId = linkedOrderId;
    }
    if (state.order) {
      newStatus = mapOrderStatus(state.order, state.invitation);
      searches = state.order.Searches || null;
    } else if (state.invitation) {
      newStatus = isInvitationSigned(state.invitation) ? "PENDING" : "AWAITING_APPLICANT";
    }
  }

  let changed = false;
  if (newStatus && newStatus !== previousStatus) {
    const terminal = newStatus === "PASSED" || newStatus === "FAILED";
    const currentlyTerminal = previousStatus === "PASSED" || previousStatus === "FAILED";
    // Postback rule: PASSED/FAILED always lands and notifies. In-flight
    // moves (awaiting → in progress) are persisted too, as the status poll
    // does, but never overwrite a result that has already been recorded.
    if (terminal || !currentlyTerminal) {
      await db.candidate.update({ where: { id: candidate.id }, data: { backgroundCheckStatus: newStatus } });
      changed = true;
      if (newStatus === "PASSED" || newStatus === "FAILED") {
        await fireBgCheckCompleteNotification(candidate.id, newStatus, candidate);
      }
    }
  }

  await audit({
    action: "background_check.refreshed",
    entityType: "candidate",
    entityId: candidate.id,
    details: {
      name: `${candidate.firstName} ${candidate.lastName}`,
      email: candidate.email,
      checkId,
      from: previousStatus,
      to: changed && newStatus ? newStatus : previousStatus,
      providerStatus: newStatus,
      changed,
      linkedOrderId,
      providerError,
      bulk,
      searchCount: searches ? searches.length : null,
      searchesWithRecords: searches ? searches.filter(hasRecords).length : null,
    },
  });

  const row = await rowFor(await loadCandidate(candidate.id));
  return { row, changed, previousStatus, linkedOrderId, providerError };
}

// ── Actions ────────────────────────────────────────────────

/** Every candidate with a check on file, scoped like the recruitment pages. */
export async function listBackgroundChecks(): Promise<BackgroundCheckList> {
  await requireManagerOrAdmin();
  const candidates = await loadScopedCandidates();
  const names = await recruiterNames(candidates.map((c) => c.recruiterId));
  const rows = candidates.map((c) => toRow(c, c.recruiterId ? names.get(c.recruiterId) ?? null : null));
  // Most recently sent first; checks without a send date sink to the bottom.
  rows.sort((a, b) => {
    if (a.sentAt && b.sentAt && a.sentAt !== b.sentAt) return a.sentAt < b.sentAt ? 1 : -1;
    if (!!a.sentAt !== !!b.sentAt) return a.sentAt ? -1 : 1;
    return a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0;
  });
  return { rows, summary: summarizeBackgroundChecks(rows.map((r) => r.status)) };
}

/** Stored row plus whatever Continental returns right now. Provider failures are reported, never thrown. */
export async function getBackgroundCheckDetail(candidateId: string): Promise<BackgroundCheckDetail> {
  await requireManagerOrAdmin();
  await assertCandidateAccess(candidateId);
  const candidate = await loadCandidate(candidateId);
  const row = await rowFor(candidate);
  const state = await fetchProviderState(candidate.backgroundCheckId);
  const fallbackOrderId = isOrderId(candidate.backgroundCheckId) ? candidate.backgroundCheckId ?? null : null;
  return {
    row,
    providerConfigured: isContinentalConfigured(),
    providerNote: state.note,
    providerError: state.error,
    order: state.order ? toProviderOrder(state.order, fallbackOrderId) : null,
    invitation: state.invitation ? toProviderInvitation(state.invitation) : null,
    fetchedAt: new Date().toISOString(),
  };
}

/** Re-fetch one check from Continental and apply the same transitions as the postback. */
export async function refreshBackgroundCheck(candidateId: string): Promise<RefreshBackgroundCheckResult> {
  await requireManagerOrAdmin();
  await assertCandidateAccess(candidateId);
  const candidate = await loadCandidate(candidateId);
  const result = await performRefresh(candidate, false);
  revalidatePath(PAGE_PATH);
  revalidatePath("/cv");
  return result;
}

/** Refresh every AWAITING_APPLICANT / PENDING check in the caller's scope, one at a time. */
export async function refreshPendingBackgroundChecks(): Promise<RefreshPendingResult> {
  await requireManagerOrAdmin();
  const result: RefreshPendingResult = { refreshed: 0, changed: 0, skipped: 0, errors: [] };
  if (!isContinentalConfigured()) {
    result.errors.push({
      candidateId: null,
      name: "Continental Screening",
      error: "Continental Screening credentials are not configured on this server.",
    });
    return result;
  }

  const open = (await loadScopedCandidates()).filter((c) =>
    isOpenBackgroundCheck(deriveBackgroundCheckStatus(c.backgroundCheckStatus))
  );
  for (const candidate of open) {
    const name = `${candidate.firstName} ${candidate.lastName}`;
    if (!candidate.backgroundCheckId || !(isInvitationKey(candidate.backgroundCheckId) || isOrderId(candidate.backgroundCheckId))) {
      result.skipped += 1;
      continue;
    }
    try {
      const r = await performRefresh(candidate, true);
      result.refreshed += 1;
      if (r.changed) result.changed += 1;
      if (r.providerError) result.errors.push({ candidateId: candidate.id, name, error: r.providerError });
    } catch (err) {
      result.errors.push({ candidateId: candidate.id, name, error: errorMessage(err) });
    }
  }

  await audit({
    action: "background_check.refreshed_all",
    entityType: "candidate",
    details: {
      candidates: open.length,
      refreshed: result.refreshed,
      changed: result.changed,
      skipped: result.skipped,
      errors: result.errors.length,
    },
  });
  revalidatePath(PAGE_PATH);
  revalidatePath("/cv");
  return result;
}

/**
 * SUPER_ADMIN only. Applies a PASSED/FAILED result exactly as a Continental
 * postback would — status update plus the completion notification — so the
 * downstream flow (notifications, adverse-action workflow) can be exercised
 * without the vendor. Every use is audited with the acting user.
 */
export async function simulateBackgroundCheckResult(
  candidateId: string,
  result: "PASSED" | "FAILED"
): Promise<SimulateBackgroundCheckResult> {
  const session = await requireAuth();
  if (session.user?.role !== "SUPER_ADMIN") {
    throw new Error("Only super admins can simulate background check results");
  }
  if (result !== "PASSED" && result !== "FAILED") {
    throw new Error("Result must be PASSED or FAILED");
  }

  const candidate = await loadCandidate(candidateId);
  const previousStatus = deriveBackgroundCheckStatus(candidate.backgroundCheckStatus);
  const changed = candidate.backgroundCheckStatus !== result;
  if (changed) {
    await db.candidate.update({ where: { id: candidateId }, data: { backgroundCheckStatus: result } });
    await fireBgCheckCompleteNotification(candidateId, result, candidate);
  }

  await audit({
    action: "background_check.simulated",
    entityType: "candidate",
    entityId: candidateId,
    details: {
      test: true,
      name: `${candidate.firstName} ${candidate.lastName}`,
      email: candidate.email,
      checkId: candidate.backgroundCheckId,
      from: previousStatus,
      to: result,
      changed,
      actor: session.user.email,
      actorRole: session.user.role,
    },
  });
  revalidatePath(PAGE_PATH);
  revalidatePath("/cv");
  return { row: await rowFor(await loadCandidate(candidateId)), changed };
}
