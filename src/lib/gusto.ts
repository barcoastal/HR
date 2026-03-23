import { db } from "@/lib/db";
import crypto from "crypto";

// ── Encryption ──────────────────────────────────────────────

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const hex = process.env.GUSTO_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("GUSTO_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decrypt(encoded: string): string {
  const key = getEncryptionKey();
  const data = Buffer.from(encoded, "base64");
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}

// ── Token refresh mutex ─────────────────────────────────────

let refreshPromise: Promise<void> | null = null;

async function ensureValidToken(): Promise<{
  accessToken: string;
  companyId: string;
}> {
  const conn = await db.gustoConnection.findFirst();
  if (!conn) throw new Error("Gusto is not connected");

  const now = new Date();
  const bufferMs = 5 * 60 * 1000;

  if (conn.tokenExpiresAt.getTime() - bufferMs > now.getTime()) {
    return { accessToken: decrypt(conn.accessToken), companyId: conn.companyId };
  }

  if (!refreshPromise) {
    refreshPromise = refreshToken(conn.id, decrypt(conn.refreshToken)).finally(() => {
      refreshPromise = null;
    });
  }
  await refreshPromise;

  const updated = await db.gustoConnection.findFirst();
  if (!updated) throw new Error("Gusto connection lost during refresh");
  return { accessToken: decrypt(updated.accessToken), companyId: updated.companyId };
}

async function refreshToken(connectionId: string, refreshTokenPlain: string): Promise<void> {
  const baseUrl = process.env.GUSTO_API_URL || "https://api.gusto-demo.com";
  const res = await fetch(`${baseUrl}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.GUSTO_CLIENT_ID || "",
      client_secret: process.env.GUSTO_CLIENT_SECRET || "",
      refresh_token: refreshTokenPlain,
    }),
  });

  if (!res.ok) {
    await db.gustoConnection.update({
      where: { id: connectionId },
      data: { tokenExpiresAt: new Date(0) },
    });
    throw new Error("Gusto token refresh failed — please reconnect");
  }

  const data = await res.json();
  await db.gustoConnection.update({
    where: { id: connectionId },
    data: {
      accessToken: encrypt(data.access_token),
      refreshToken: encrypt(data.refresh_token),
      tokenExpiresAt: new Date(Date.now() + (data.expires_in || 7200) * 1000),
    },
  });
}

// ── API helpers ─────────────────────────────────────────────

const API_BASE = () => process.env.GUSTO_API_URL || "https://api.gusto-demo.com";

async function gustoFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { accessToken, companyId } = await ensureValidToken();
  const url = `${API_BASE()}/v1${path.replace("{companyId}", companyId)}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("Retry-After") || "2", 10);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    return gustoFetch<T>(path, options);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gusto API error ${res.status}: ${text}`);
  }

  return res.json();
}

// ── Typed API methods ───────────────────────────────────────

export type GustoEmployee = {
  uuid: string;
  first_name: string;
  last_name: string;
  email: string;
  department?: string;
  jobs: { title: string; rate: string; payment_unit: string; current_compensation_id: string }[];
  terminated: boolean;
};

export type GustoPayroll = {
  payroll_uuid: string;
  pay_period: { start_date: string; end_date: string };
  check_date: string;
  processed: boolean;
  payroll_deadline: string;
  totals: { gross_pay: string; net_pay: string; employer_taxes: string; employee_taxes: string; deductions: string; reimbursements: string };
  employee_compensations: GustoPayrollEmployee[];
};

export type GustoPayrollEmployee = {
  employee_uuid: string;
  gross_pay: string;
  net_pay: string;
  taxes: { name: string; amount: string; employer: boolean }[];
  deductions: { name: string; amount: string }[];
  fixed_compensations: { name: string; amount: string }[];
};

export type GustoTimeOffPolicy = {
  uuid: string;
  name: string;
  policy_type: string;
  accrual_method: string;
};

export type GustoTimeOffRequest = {
  uuid: string;
  employee_uuid: string;
  status: string;
  request_type: string;
  start_date: string;
  end_date: string;
  days: number;
  employee_note: string;
  initiator_id: string;
};

export type GustoTimeOffBalance = {
  policy_name: string;
  policy_uuid: string;
  balance: string;
};

export type GustoCompensation = {
  uuid: string;
  rate: string;
  payment_unit: string;
  flsa_status: string;
  effective_date: string;
};

export async function getGustoCompany() {
  const { companyId } = await ensureValidToken();
  return gustoFetch<{ uuid: string; name: string }>(`/companies/${companyId}`);
}

export async function fetchGustoEmployees(): Promise<GustoEmployee[]> {
  return gustoFetch<GustoEmployee[]>("/companies/{companyId}/employees");
}

export async function fetchPayrollRuns(): Promise<GustoPayroll[]> {
  return gustoFetch<GustoPayroll[]>("/companies/{companyId}/payrolls");
}

export async function fetchPayrollDetail(payrollId: string): Promise<GustoPayroll> {
  return gustoFetch<GustoPayroll>(`/companies/{companyId}/payrolls/${payrollId}`);
}

export async function approvePayroll(payrollId: string): Promise<void> {
  await gustoFetch(`/companies/{companyId}/payrolls/${payrollId}/approve`, { method: "PUT" });
}

export async function fetchTimeOffPolicies(): Promise<GustoTimeOffPolicy[]> {
  return gustoFetch<GustoTimeOffPolicy[]>("/companies/{companyId}/time_off_policies");
}

export async function fetchTimeOffRequests(status?: string): Promise<GustoTimeOffRequest[]> {
  const qs = status ? `?status=${status}` : "";
  return gustoFetch<GustoTimeOffRequest[]>(`/companies/{companyId}/time_off_requests${qs}`);
}

export async function fetchEmployeeTimeOffBalances(employeeUuid: string): Promise<GustoTimeOffBalance[]> {
  return gustoFetch<GustoTimeOffBalance[]>(`/employees/${employeeUuid}/time_off_activities`);
}

export async function createTimeOffRequest(data: {
  employeeUuid: string;
  timeOffPolicyUuid: string;
  startDate: string;
  endDate: string;
  note?: string;
}): Promise<GustoTimeOffRequest> {
  return gustoFetch<GustoTimeOffRequest>(`/companies/{companyId}/time_off_requests`, {
    method: "POST",
    body: JSON.stringify({
      employee_uuid: data.employeeUuid,
      time_off_policy_uuid: data.timeOffPolicyUuid,
      start_date: data.startDate,
      end_date: data.endDate,
      employee_note: data.note || "",
    }),
  });
}

export async function approveTimeOffRequest(requestUuid: string): Promise<void> {
  await gustoFetch(`/companies/{companyId}/time_off_requests/${requestUuid}/approve`, { method: "PUT" });
}

export async function denyTimeOffRequest(requestUuid: string): Promise<void> {
  await gustoFetch(`/companies/{companyId}/time_off_requests/${requestUuid}/deny`, { method: "PUT" });
}

export async function fetchEmployeeCompensations(employeeUuid: string): Promise<GustoCompensation[]> {
  return gustoFetch<GustoCompensation[]>(`/employees/${employeeUuid}/compensations`);
}

export async function fetchEmployeePayStubs(employeeUuid: string): Promise<GustoPayrollEmployee[]> {
  const payrolls = await fetchPayrollRuns();
  const processed = payrolls.filter((pr) => pr.processed).slice(-6);
  const details = await Promise.all(processed.map((p) => fetchPayrollDetail(p.payroll_uuid)));
  return details
    .map((d) => d.employee_compensations?.find((e) => e.employee_uuid === employeeUuid))
    .filter((e): e is GustoPayrollEmployee => !!e);
}

// ── Webhooks ────────────────────────────────────────────────

export async function createWebhookSubscription(accessToken: string, companyId: string): Promise<{ uuid: string; subscription_secret: string } | null> {
  const baseUrl = API_BASE();
  const webhookUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/gusto/webhooks`;

  try {
    const res = await fetch(`${baseUrl}/v1/companies/${companyId}/webhooks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: webhookUrl }),
    });

    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function deleteWebhookSubscription(accessToken: string, companyId: string, subscriptionId: string): Promise<void> {
  const baseUrl = API_BASE();
  await fetch(`${baseUrl}/v1/companies/${companyId}/webhooks/${subscriptionId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => {});
}

// ── OAuth callback handler ──────────────────────────────────

export async function handleGustoCallback(
  tokens: { access_token: string; refresh_token?: string; expires_in?: number },
  stateData: { userId: string }
): Promise<void> {
  const baseUrl = API_BASE();

  const companyRes = await fetch(`${baseUrl}/v1/me`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!companyRes.ok) throw new Error("Failed to fetch Gusto company info");

  const me = await companyRes.json();
  const companyId = me.uuid || me.id;
  const companyName = me.name || "Gusto Company";

  const encAccessToken = encrypt(tokens.access_token);
  const encRefreshToken = encrypt(tokens.refresh_token || "");
  const tokenExpiresAt = new Date(Date.now() + (tokens.expires_in || 7200) * 1000);

  const webhook = await createWebhookSubscription(tokens.access_token, companyId);

  await db.gustoConnection.upsert({
    where: { companyId },
    create: {
      companyId,
      companyName,
      accessToken: encAccessToken,
      refreshToken: encRefreshToken,
      tokenExpiresAt,
      webhookSubId: webhook?.uuid || null,
      webhookSecret: webhook?.subscription_secret ? encrypt(webhook.subscription_secret) : null,
      connectedBy: stateData.userId,
    },
    update: {
      companyName,
      accessToken: encAccessToken,
      refreshToken: encRefreshToken,
      tokenExpiresAt,
      webhookSubId: webhook?.uuid || null,
      webhookSecret: webhook?.subscription_secret ? encrypt(webhook.subscription_secret) : null,
      connectedBy: stateData.userId,
    },
  });

  // Auto-match employees by email
  const gustoEmployees = await fetchGustoEmployeesRaw(tokens.access_token, companyId, baseUrl);
  const calEmployees = await db.employee.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, email: true },
  });

  const emailMap = new Map(calEmployees.map((e) => [e.email.toLowerCase(), e.id]));

  for (const ge of gustoEmployees) {
    if (!ge.email) continue;
    const calId = emailMap.get(ge.email.toLowerCase());
    if (calId) {
      await db.employee.update({
        where: { id: calId },
        data: { gustoEmployeeId: ge.uuid },
      });
    }
  }
}

async function fetchGustoEmployeesRaw(
  accessToken: string,
  companyId: string,
  baseUrl: string
): Promise<{ uuid: string; email: string }[]> {
  const res = await fetch(`${baseUrl}/v1/companies/${companyId}/employees`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  return res.json();
}
