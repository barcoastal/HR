import { db } from "@/lib/db";

/**
 * Continental Screening Services API v2 client.
 *
 * Auth is HTTP Basic with the Continental account credentials — no API keys.
 * Docs: https://clients.continentalss.com/docs/home.php?overview
 *
 * Orders are placed with the invitation flow: Continental emails the
 * applicant, who supplies their own SSN/DOB/addresses. Completed results
 * (including the report PDF, base64-encoded) arrive on our postback route;
 * status can also be polled via GET /orders/{orderID}.
 */

const BASE = process.env.CONTINENTAL_API_BASE || "https://clients.continentalss.com/api2";
const API_USER = process.env.CONTINENTAL_API_USER || "";
const API_PASSWORD = process.env.CONTINENTAL_API_PASSWORD || "";

// "Standard Criminal Package": nationwide + county + federal criminal + SSN trace.
export const CONTINENTAL_PACKAGE_ID = parseInt(process.env.CONTINENTAL_PACKAGE_ID || "20319", 10);

export function isContinentalConfigured(): boolean {
  return Boolean(API_USER && API_PASSWORD);
}

export class ContinentalError extends Error {
  constructor(
    message: string,
    public httpStatus: number,
    public details?: string
  ) {
    super(message);
  }
}

async function continentalFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!isContinentalConfigured()) {
    throw new ContinentalError("Continental Screening credentials are not configured on the server", 500);
  }
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: "Basic " + Buffer.from(`${API_USER}:${API_PASSWORD}`).toString("base64"),
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const text = await res.text();
  let data: { status?: number; description?: string; payload?: unknown } | null = null;
  try {
    data = JSON.parse(text);
  } catch {
    // non-JSON body — fall through to the error below
  }
  if (!res.ok || !data || data.status !== 0) {
    throw new ContinentalError(
      data?.description || `Continental API returned ${res.status}`,
      res.status,
      data ? undefined : text.slice(0, 300)
    );
  }
  return data as T;
}

// ── Option mapping ─────────────────────────────────────────
// The order dialog still sends the legacy option keys; they map onto
// Continental SearchCodes here. The base package covers criminal + SSN trace.

export type BgCheckOptions = {
  drug_test?: string; // "Y" | "N"
  drug_sku?: string; // "drug" (5-panel) | "drug9" | "drug10"
  mvr?: string;
  employment?: string;
  education?: string;
  blj?: string;
  bankruptcy?: string;
  civil_judgment?: string;
  tax_lien?: string;
  [key: string]: string | undefined;
};

const DRUG_PANELS: Record<string, string> = {
  drug: "ES5P", // ES - 5 Panel Standard
  drug9: "ES9P", // ES - 9 Panel Standard
  drug10: "ES10P", // ES - 10 Panel Standard
};

export function buildProductList(options: BgCheckOptions | null | undefined): { SearchCode: string }[] {
  const codes: string[] = [];
  const o = options || {};
  if (o.employment === "Y") codes.push("EM");
  if (o.education === "Y") codes.push("EV");
  if (o.mvr === "Y") codes.push("MVR");
  // BLJ covers bankruptcies, liens and judgments — collapse the legacy
  // financial toggles into it.
  if (o.blj === "Y" || o.bankruptcy === "Y" || o.civil_judgment === "Y" || o.tax_lien === "Y") {
    codes.push("BLJ");
  }
  if (o.drug_test === "Y") codes.push(DRUG_PANELS[o.drug_sku || "drug"] || "ES5P");
  return codes.map((SearchCode) => ({ SearchCode }));
}

// ── Orders ─────────────────────────────────────────────────

export async function createInvitationOrder(params: {
  firstName: string;
  lastName: string;
  email: string;
  products: { SearchCode: string }[];
}): Promise<{ orderId: string; raw: unknown }> {
  const payload: Record<string, unknown> = {
    applicantinfo: { firstname: params.firstName, lastname: params.lastName },
    invitation: 1,
    packageid: CONTINENTAL_PACKAGE_ID,
    pricequote: false,
    applicantemail: params.email,
    branchid: 0,
  };
  if (params.products.length > 0) payload.product = params.products;

  const postbackBase = process.env.NEXTAUTH_URL;
  const postbackSecret = process.env.CRON_SECRET;
  if (postbackBase && postbackSecret) {
    payload.postbackurl = `${postbackBase}/api/background-check/postback?secret=${postbackSecret}`;
  }

  const data = await continentalFetch<{ payload?: { orderID?: number | string; OrderID?: number | string } }>(
    "/orders",
    { method: "POST", body: JSON.stringify(payload) }
  );
  const orderId = data.payload?.orderID ?? data.payload?.OrderID;
  if (orderId === undefined || orderId === null || orderId === "") {
    console.error("[continental] order response missing orderID:", JSON.stringify(data).slice(0, 800));
    throw new ContinentalError("Continental did not return an order ID", 502);
  }
  return { orderId: String(orderId), raw: data };
}

export type ContinentalSearch = {
  SearchID?: string;
  SearchName?: string;
  SearchStatus?: string;
  RecordsFound?: string | number;
  Notes?: string;
};

export type ContinentalOrder = {
  OrderID?: string;
  OrderStatus?: string;
  Searches?: ContinentalSearch[];
};

export async function getOrder(orderId: string): Promise<ContinentalOrder> {
  const data = await continentalFetch<{ payload?: ContinentalOrder }>(`/orders/${encodeURIComponent(orderId)}`);
  return data.payload || {};
}

// ── Invitations ────────────────────────────────────────────

export type ContinentalInvitation = {
  ID?: string;
  ApplicantName?: string;
  ApplicantEmail?: string;
  Status?: string;
  SignDate?: string | null;
  OrderID?: string;
  DateCreated?: string;
};

export async function listInvitations(): Promise<ContinentalInvitation[]> {
  const data = await continentalFetch<{ payload?: ContinentalInvitation[] }>("/invitations");
  return Array.isArray(data.payload) ? data.payload : [];
}

// ── Status mapping ─────────────────────────────────────────

export function hasRecords(search: ContinentalSearch): boolean {
  const n = parseInt(String(search.RecordsFound ?? "0"), 10);
  return Number.isFinite(n) && n > 0;
}

/**
 * Map a Continental order (plus its invitation, when known) onto our
 * internal statuses. A closed order with zero records across all searches is
 * PASSED; any records flag it FAILED ("Flagged for Review" in the UI — the
 * reject decision stays manual). An unsigned invitation means the applicant
 * hasn't filled in their info yet.
 */
export function mapOrderStatus(
  order: ContinentalOrder,
  invitation?: ContinentalInvitation | null
): "AWAITING_APPLICANT" | "PENDING" | "PASSED" | "FAILED" {
  const status = (order.OrderStatus || "").toLowerCase();
  if (status === "closed" || status === "complete" || status === "completed") {
    const flagged = (order.Searches || []).some(hasRecords);
    return flagged ? "FAILED" : "PASSED";
  }
  if (invitation && !invitation.SignDate) return "AWAITING_APPLICANT";
  return "PENDING";
}

// ── Notifications ──────────────────────────────────────────

export async function fireBgCheckCompleteNotification(
  candidateId: string,
  newStatus: "PASSED" | "FAILED",
  candidate: { firstName: string; lastName: string; position: { title: string } | null }
) {
  try {
    const { sendNotifications } = await import("@/lib/notifications/send");
    const fullName = `${candidate.firstName} ${candidate.lastName}`;
    const positionTitle = candidate.position?.title || "their position";
    const resultLabel = newStatus === "PASSED" ? "Passed — Clear" : "Flagged for Review";
    await sendNotifications({
      action: "BACKGROUND_CHECK_COMPLETE",
      candidateId,
      message: `Background check complete for ${fullName}: ${resultLabel}`,
      link: "/cv",
      emailSubject: `Background check ${newStatus === "PASSED" ? "passed" : "flagged"}: ${fullName}`,
      emailBody: `<p>The background check for <strong>${fullName}</strong>${candidate.position?.title ? ` (${positionTitle})` : ""} has completed.</p><p>Result: <strong>${resultLabel}</strong>.</p><p><a href="${process.env.NEXTAUTH_URL || ""}/cv">Open in CALATRAVA</a></p>`,
    });
  } catch (err) {
    console.error("[background-check] notification failed:", err);
  }
}

/**
 * Persist a completed report PDF (base64) as a FileBlob and stamp it on the
 * candidate so /api/background-check/{key}/pdf serves it from cache.
 */
export async function storeReportPdf(candidateId: string, orderId: string, base64Pdf: string): Promise<void> {
  const buffer = Buffer.from(base64Pdf, "base64");
  if (buffer.length < 100 || !buffer.subarray(0, 5).toString("latin1").startsWith("%PDF")) {
    console.error(`[continental] postback PDF for order ${orderId} doesn't look like a PDF (${buffer.length} bytes)`);
    return;
  }
  const { randomUUID } = await import("crypto");
  const filename = `bg-report-${orderId}-${randomUUID()}.pdf`;
  await db.fileBlob.create({
    data: { filename, mimeType: "application/pdf", size: buffer.length, data: buffer },
  });
  await db.candidate.update({
    where: { id: candidateId },
    data: { backgroundReportFilename: filename, backgroundReportImportedAt: new Date() },
  });
}
