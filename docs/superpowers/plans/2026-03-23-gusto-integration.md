# Gusto Integration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect CALATRAVA to Gusto's API for live payroll, time-off, and compensation data — employees can request time off (synced to Gusto), admins can view/approve payroll runs.

**Architecture:** Reuse existing OAuth infrastructure for the connection flow. A single `src/lib/gusto.ts` module handles all Gusto API communication with AES-256-GCM encrypted token storage and automatic refresh. Server actions in `src/lib/actions/gusto.ts` expose all operations. A `GustoConnection` model stores the single connection; employees link via `gustoEmployeeId` on the `Employee` model.

**Tech Stack:** Next.js 16 App Router, Prisma, TypeScript, Node.js `crypto` (AES-256-GCM), Material Symbols icons, shadcn-style UI components (Card, Button, Badge, Icon, PageHeader, StatCard)

**Spec:** `docs/superpowers/specs/2026-03-23-gusto-integration-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/gusto.ts` | Gusto API client: encryption helpers, token management with mutex refresh, typed API methods for all resources, `handleGustoCallback`, rate limit handling |
| Create | `src/lib/actions/gusto.ts` | Server actions: getGustoConnection, getGustoEmployees, mapEmployee, disconnectGusto, getPayrollRuns, getPayrollDetails, getTimeOffPolicies, getTimeOffRequests, requestTimeOff, approveTimeOff, denyTimeOff, getEmployeeCompensation, getEmployeePayStubs, getTimeOffBalances |
| Create | `src/app/api/gusto/webhooks/route.ts` | Webhook receiver: HMAC-SHA256 validation, event routing, feed notifications |
| Create | `src/app/(dashboard)/gusto/page.tsx` | Gusto dashboard: stats, payroll list, time-off requests |
| Create | `src/components/gusto/connection-status.tsx` | Reusable banner for connected/disconnected/error states |
| Create | `src/components/gusto/employee-mapping.tsx` | Mapping UI: auto-matched list, unmatched with manual dropdown |
| Create | `src/components/gusto/payroll-list.tsx` | Payroll runs list with status badges and approve button |
| Create | `src/components/gusto/payroll-detail-dialog.tsx` | Per-employee payroll breakdown dialog |
| Create | `src/components/gusto/time-off-requests.tsx` | Pending time-off requests with approve/deny |
| Create | `src/components/gusto/gusto-time-off-form.tsx` | Time-off request form for Gusto-mapped employees |
| Create | `src/components/gusto/employee-gusto-tab.tsx` | Compensation, pay stubs, time-off balances/history for employee profile |
| Modify | `src/lib/oauth/config.ts` | Add `gusto` entry to `OAUTH_PROVIDERS` |
| Modify | `src/app/api/platforms/[provider]/callback/route.ts` | Add provider-specific handler branching for Gusto |
| Modify | `prisma/schema.prisma` | Add `GustoConnection` model, add `gustoEmployeeId` to `Employee` |
| Modify | `src/app/(dashboard)/settings/page.tsx` | Add Gusto connection section |
| Modify | `src/app/(dashboard)/people/[id]/page.tsx` | Add Gusto tab when employee has `gustoEmployeeId` |
| Modify | `src/app/(dashboard)/time-off/page.tsx` | Dual mode: Gusto for mapped employees, local for unmapped |
| Modify | `src/components/layout/sidebar.tsx` | Add `/gusto` nav link for admin roles |

---

## Chunk 1: Foundation — Schema, Encryption, API Client

### Task 1: Prisma Schema Changes

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add GustoConnection model**

Add at the end of `prisma/schema.prisma`, before any closing comments:

```prisma
model GustoConnection {
  id             String   @id @default(uuid())
  companyId      String   @unique
  companyName    String
  accessToken    String
  refreshToken   String
  tokenExpiresAt DateTime
  webhookSubId   String?
  webhookSecret  String?
  connectedBy    String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

- [ ] **Step 2: Add gustoEmployeeId to Employee model**

In the `Employee` model, after the `status` field (line ~204), add:

```prisma
  gustoEmployeeId String?  @unique
```

- [ ] **Step 3: Generate Prisma client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client"

- [ ] **Step 4: Create migration file**

Run: `npx prisma migrate dev --name add-gusto-integration --create-only`

This may fail if no local DB — that's OK. The migration SQL will be created. If it fails with P1010, create the migration manually:

Run: `mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_add_gusto_integration && echo "-- CreateTable
CREATE TABLE \"GustoConnection\" (
    \"id\" TEXT NOT NULL,
    \"companyId\" TEXT NOT NULL,
    \"companyName\" TEXT NOT NULL,
    \"accessToken\" TEXT NOT NULL,
    \"refreshToken\" TEXT NOT NULL,
    \"tokenExpiresAt\" TIMESTAMP(3) NOT NULL,
    \"webhookSubId\" TEXT,
    \"webhookSecret\" TEXT,
    \"connectedBy\" TEXT,
    \"createdAt\" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    \"updatedAt\" TIMESTAMP(3) NOT NULL,
    CONSTRAINT \"GustoConnection_pkey\" PRIMARY KEY (\"id\")
);

-- CreateIndex
CREATE UNIQUE INDEX \"GustoConnection_companyId_key\" ON \"GustoConnection\"(\"companyId\");

-- AlterTable
ALTER TABLE \"Employee\" ADD COLUMN \"gustoEmployeeId\" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX \"Employee_gustoEmployeeId_key\" ON \"Employee\"(\"gustoEmployeeId\");" > prisma/migrations/$(date +%Y%m%d%H%M%S)_add_gusto_integration/migration.sql`

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(gusto): add GustoConnection model and gustoEmployeeId to Employee"
```

---

### Task 2: Gusto API Client — Encryption & Token Management

**Files:**
- Create: `src/lib/gusto.ts`

This is the core module. It handles: AES-256-GCM encryption/decryption, token storage/refresh with mutex, and all typed Gusto API methods.

- [ ] **Step 1: Create `src/lib/gusto.ts` with encryption helpers and base client**

```typescript
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
  // Format: base64(iv + tag + ciphertext)
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
  const bufferMs = 5 * 60 * 1000; // refresh 5 min before expiry

  if (conn.tokenExpiresAt.getTime() - bufferMs > now.getTime()) {
    return { accessToken: decrypt(conn.accessToken), companyId: conn.companyId };
  }

  // Mutex: only one refresh at a time
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
    // Mark connection as stale so UI shows reconnect banner
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

  // Rate limit: retry once on 429
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

// Types
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

// Company
export async function getGustoCompany() {
  const { companyId } = await ensureValidToken();
  return gustoFetch<{ uuid: string; name: string }>(`/companies/${companyId}`);
}

// Employees
export async function fetchGustoEmployees(): Promise<GustoEmployee[]> {
  return gustoFetch<GustoEmployee[]>("/companies/{companyId}/employees");
}

// Payroll
export async function fetchPayrollRuns(): Promise<GustoPayroll[]> {
  return gustoFetch<GustoPayroll[]>("/companies/{companyId}/payrolls");
}

export async function fetchPayrollDetail(payrollId: string): Promise<GustoPayroll> {
  return gustoFetch<GustoPayroll>(`/companies/{companyId}/payrolls/${payrollId}`);
}

export async function approvePayroll(payrollId: string): Promise<void> {
  await gustoFetch(`/companies/{companyId}/payrolls/${payrollId}/approve`, {
    method: "PUT",
  });
}

// Time Off
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
  await gustoFetch(`/companies/{companyId}/time_off_requests/${requestUuid}/approve`, {
    method: "PUT",
  });
}

export async function denyTimeOffRequest(requestUuid: string): Promise<void> {
  await gustoFetch(`/companies/{companyId}/time_off_requests/${requestUuid}/deny`, {
    method: "PUT",
  });
}

// Compensation
export async function fetchEmployeeCompensations(employeeUuid: string): Promise<GustoCompensation[]> {
  return gustoFetch<GustoCompensation[]>(`/employees/${employeeUuid}/compensations`);
}

// Pay stubs (employee payrolls) — limited to last 6 processed to avoid N+1
export async function fetchEmployeePayStubs(employeeUuid: string): Promise<GustoPayrollEmployee[]> {
  const payrolls = await fetchPayrollRuns();
  const processed = payrolls.filter((pr) => pr.processed).slice(-6);
  const details = await Promise.all(processed.map((p) => fetchPayrollDetail(p.payroll_uuid)));
  return details
    .map((d) => d.employee_compensations?.find((e) => e.employee_uuid === employeeUuid))
    .filter((e): e is GustoPayrollEmployee => !!e);
}

// Webhooks
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
    return null; // Degraded — no real-time notifications
  }
}

export async function deleteWebhookSubscription(accessToken: string, companyId: string, subscriptionId: string): Promise<void> {
  const baseUrl = API_BASE();
  await fetch(`${baseUrl}/v1/companies/${companyId}/webhooks/${subscriptionId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => {}); // Best-effort cleanup
}

// ── OAuth callback handler ──────────────────────────────────

export async function handleGustoCallback(
  tokens: { access_token: string; refresh_token?: string; expires_in?: number },
  stateData: { userId: string }
): Promise<void> {
  const baseUrl = API_BASE();

  // 1. Fetch company info
  const companyRes = await fetch(`${baseUrl}/v1/me`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!companyRes.ok) throw new Error("Failed to fetch Gusto company info");

  const me = await companyRes.json();
  const companyId = me.uuid || me.id;
  const companyName = me.name || "Gusto Company";

  // 2. Create/update GustoConnection with encrypted tokens
  const encAccessToken = encrypt(tokens.access_token);
  const encRefreshToken = encrypt(tokens.refresh_token || "");
  const tokenExpiresAt = new Date(Date.now() + (tokens.expires_in || 7200) * 1000);

  // 3. Try to create webhook subscription
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

  // 4. Auto-match employees by email
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

// Raw fetch for use during callback (before connection is stored)
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors in `src/lib/gusto.ts`

- [ ] **Step 3: Commit**

```bash
git add src/lib/gusto.ts
git commit -m "feat(gusto): add API client with encryption, token management, and typed methods"
```

---

### Task 3: Add Gusto to OAuth Provider Registry

**Files:**
- Modify: `src/lib/oauth/config.ts`

- [ ] **Step 1: Add gusto entry to OAUTH_PROVIDERS**

After the `google_calendar` entry (line 75), add:

```typescript
  gusto: {
    providerId: "gusto",
    platformName: "Gusto",
    authorizationUrl: `${process.env.GUSTO_API_URL || "https://api.gusto-demo.com"}/oauth/authorize`,
    tokenUrl: `${process.env.GUSTO_API_URL || "https://api.gusto-demo.com"}/oauth/token`,
    scopes: [
      "companies:read",
      "employees:read",
      "employees:manage",
      "payrolls:read",
      "payrolls:run",
      "time_off_policies:read",
      "time_off_requests:read",
      "time_off_requests:write",
      "webhooks:manage",
    ],
    clientIdEnvVar: "GUSTO_CLIENT_ID",
    clientSecretEnvVar: "GUSTO_CLIENT_SECRET",
    isAvailable: true,
  },
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/oauth/config.ts
git commit -m "feat(gusto): add Gusto to OAuth provider registry"
```

---

### Task 4: Add Gusto Callback Branching

**Files:**
- Modify: `src/app/api/platforms/[provider]/callback/route.ts`

- [ ] **Step 1: Add Gusto-specific branch in callback route**

After the token exchange (line 61, after `if (!tokens) { ... }`), add Gusto branching before the existing `RecruitmentPlatform` upsert:

```typescript
  // 6. Provider-specific callback handling
  if (providerId === "gusto") {
    try {
      const { handleGustoCallback } = await import("@/lib/gusto");
      await handleGustoCallback(tokens, { userId: stateData.userId });
      settingsUrl.searchParams.set("oauth_success", "Gusto");
      return NextResponse.redirect(settingsUrl);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Gusto connection failed";
      settingsUrl.searchParams.set("oauth_error", message);
      return NextResponse.redirect(settingsUrl);
    }
  }
```

This goes right before the existing line `// 6. Upsert RecruitmentPlatform with tokens` (rename that comment to `// 7.`).

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/platforms/[provider]/callback/route.ts
git commit -m "feat(gusto): add provider-specific callback branching for Gusto OAuth"
```

---

## Chunk 2: Webhook Receiver & Server Actions

### Task 5: Webhook Receiver

**Files:**
- Create: `src/app/api/gusto/webhooks/route.ts`

- [ ] **Step 1: Create webhook route**

```typescript
import { NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/gusto";

export async function POST(request: Request) {
  // 1. Look up connection
  const conn = await db.gustoConnection.findFirst();
  if (!conn || !conn.webhookSecret) {
    return NextResponse.json({ error: "No webhook secret configured" }, { status: 401 });
  }

  // 2. Read raw body for signature verification
  const body = await request.text();
  const signature = request.headers.get("x-gusto-signature") || "";

  // 3. Validate HMAC-SHA256
  const secret = decrypt(conn.webhookSecret);
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  if (signature !== expected) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 4. Parse and handle event
  const event = JSON.parse(body);
  const eventType = event.event_type || event.type || "";

  // Create feed notification for relevant events
  if (eventType.includes("payroll") || eventType.includes("time_off") || eventType.includes("employee")) {
    const message = getEventMessage(eventType, event);
    if (message) {
      // Find a system/admin employee to attribute the post to
      const admin = await db.employee.findFirst({
        where: { user: { role: "SUPER_ADMIN" } },
      });
      if (admin) {
        await db.feedPost.create({
          data: {
            type: "ANNOUNCEMENT",
            content: message,
            authorId: admin.id,
          },
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}

function getEventMessage(eventType: string, event: Record<string, unknown>): string | null {
  if (eventType.includes("payroll.processed")) {
    return `💰 Payroll has been processed via Gusto.`;
  }
  if (eventType.includes("time_off_request.approved")) {
    return `✅ A time off request has been approved in Gusto.`;
  }
  if (eventType.includes("employee.created")) {
    return `👋 A new employee has been added in Gusto.`;
  }
  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/gusto/webhooks/route.ts
git commit -m "feat(gusto): add webhook receiver with HMAC-SHA256 validation"
```

---

### Task 6: Server Actions

**Files:**
- Create: `src/lib/actions/gusto.ts`

- [ ] **Step 1: Create server actions file**

```typescript
"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import {
  decrypt,
  fetchGustoEmployees,
  fetchPayrollRuns,
  fetchPayrollDetail,
  approvePayroll as gustoApprovePayroll,
  fetchTimeOffPolicies,
  fetchTimeOffRequests,
  fetchEmployeeTimeOffBalances,
  createTimeOffRequest as gustoCreateTimeOffRequest,
  approveTimeOffRequest as gustoApproveTimeOff,
  denyTimeOffRequest as gustoDenyTimeOff,
  fetchEmployeeCompensations,
  fetchEmployeePayStubs,
  deleteWebhookSubscription,
  type GustoEmployee,
  type GustoPayroll,
  type GustoPayrollEmployee,
  type GustoTimeOffPolicy,
  type GustoTimeOffRequest,
  type GustoTimeOffBalance,
  type GustoCompensation,
} from "@/lib/gusto";

// ── Connection ──────────────────────────────────────────────

export async function getGustoConnection() {
  return db.gustoConnection.findFirst();
}

export async function isGustoConnected(): Promise<boolean> {
  const conn = await db.gustoConnection.findFirst({ select: { id: true } });
  return !!conn;
}

export async function disconnectGusto() {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
    throw new Error("Not authorized");
  }

  const conn = await db.gustoConnection.findFirst();
  if (!conn) return;

  // Delete webhook subscription from Gusto
  if (conn.webhookSubId) {
    try {
      const accessToken = decrypt(conn.accessToken);
      await deleteWebhookSubscription(accessToken, conn.companyId, conn.webhookSubId);
    } catch {
      // Best effort — continue with disconnect
    }
  }

  // Clear all gustoEmployeeId mappings
  await db.employee.updateMany({
    where: { gustoEmployeeId: { not: null } },
    data: { gustoEmployeeId: null },
  });

  // Delete the connection
  await db.gustoConnection.delete({ where: { id: conn.id } });

  revalidatePath("/settings");
  revalidatePath("/gusto");
}

// ── Employees ───────────────────────────────────────────────

export async function getGustoEmployeeList(): Promise<GustoEmployee[]> {
  return fetchGustoEmployees();
}

export async function getEmployeeMapping() {
  const [gustoEmps, calEmps] = await Promise.all([
    fetchGustoEmployees(),
    db.employee.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true, email: true, gustoEmployeeId: true },
    }),
  ]);

  const mapped = calEmps.filter((e) => e.gustoEmployeeId);
  const unmappedGusto = gustoEmps.filter(
    (ge) => !calEmps.some((ce) => ce.gustoEmployeeId === ge.uuid)
  );
  const unmappedCal = calEmps.filter((e) => !e.gustoEmployeeId);

  return { gustoEmps, mapped, unmappedGusto, unmappedCal };
}

export async function mapEmployeeToGusto(employeeId: string, gustoEmployeeId: string) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
    throw new Error("Not authorized");
  }

  await db.employee.update({
    where: { id: employeeId },
    data: { gustoEmployeeId },
  });

  revalidatePath("/settings");
}

export async function unmapEmployee(employeeId: string) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
    throw new Error("Not authorized");
  }

  await db.employee.update({
    where: { id: employeeId },
    data: { gustoEmployeeId: null },
  });

  revalidatePath("/settings");
}

// ── Payroll ─────────────────────────────────────────────────

export async function getPayrolls(): Promise<GustoPayroll[]> {
  return fetchPayrollRuns();
}

export async function getPayrollDetail(payrollId: string): Promise<GustoPayroll> {
  return fetchPayrollDetail(payrollId);
}

export async function approvePayrollRun(payrollId: string) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR") {
    throw new Error("Not authorized");
  }

  await gustoApprovePayroll(payrollId);
  revalidatePath("/gusto");
}

// ── Time Off ────────────────────────────────────────────────

export async function getGustoTimeOffPolicies(): Promise<GustoTimeOffPolicy[]> {
  return fetchTimeOffPolicies();
}

export async function getGustoTimeOffRequests(status?: string): Promise<GustoTimeOffRequest[]> {
  return fetchTimeOffRequests(status);
}

export async function getEmployeeTimeOffBalances(gustoEmployeeId: string): Promise<GustoTimeOffBalance[]> {
  return fetchEmployeeTimeOffBalances(gustoEmployeeId);
}

export async function requestTimeOff(data: {
  gustoEmployeeId: string;
  timeOffPolicyUuid: string;
  startDate: string;
  endDate: string;
  note?: string;
}) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  await requireAuth();

  const result = await gustoCreateTimeOffRequest({
    employeeUuid: data.gustoEmployeeId,
    timeOffPolicyUuid: data.timeOffPolicyUuid,
    startDate: data.startDate,
    endDate: data.endDate,
    note: data.note,
  });

  revalidatePath("/time-off");
  return result;
}

export async function approveTimeOff(requestUuid: string) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR") {
    throw new Error("Not authorized");
  }

  await gustoApproveTimeOff(requestUuid);
  revalidatePath("/time-off");
  revalidatePath("/gusto");
}

export async function denyTimeOff(requestUuid: string) {
  const { requireAuth } = await import("@/lib/auth-helpers");
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR") {
    throw new Error("Not authorized");
  }

  await gustoDenyTimeOff(requestUuid);
  revalidatePath("/time-off");
  revalidatePath("/gusto");
}

// ── Employee Profile Data ───────────────────────────────────

export async function getEmployeeCompensation(gustoEmployeeId: string): Promise<GustoCompensation[]> {
  return fetchEmployeeCompensations(gustoEmployeeId);
}

export async function getEmployeePayStubs(gustoEmployeeId: string): Promise<GustoPayrollEmployee[]> {
  return fetchEmployeePayStubs(gustoEmployeeId);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/gusto.ts
git commit -m "feat(gusto): add server actions for all Gusto operations"
```

---

## Chunk 3: Settings UI — Connection & Employee Mapping

### Task 7: Connection Status Component

**Files:**
- Create: `src/components/gusto/connection-status.tsx`

- [ ] **Step 1: Create connection status banner component**

```typescript
"use client";

import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type Props = {
  connected: boolean;
  companyName?: string | null;
  connectedAt?: Date | null;
  stale?: boolean; // token expired / refresh failed
};

export function GustoConnectionStatus({ connected, companyName, connectedAt, stale }: Props) {
  if (!connected) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
        <Icon name="link_off" size={20} className="text-amber-500" />
        <div className="flex-1">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">Gusto is not connected</p>
          <p className="text-xs text-[var(--color-text-muted)]">Connect in Settings to enable payroll and time-off sync.</p>
        </div>
        <Link href="/settings">
          <Button variant="secondary" size="sm">Connect</Button>
        </Link>
      </div>
    );
  }

  if (stale) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
        <Icon name="error" size={20} className="text-red-500" />
        <div className="flex-1">
          <p className="text-sm font-medium text-[var(--color-text-primary)]">Gusto connection lost</p>
          <p className="text-xs text-[var(--color-text-muted)]">Please reconnect in Settings to restore access.</p>
        </div>
        <Link href="/settings">
          <Button variant="secondary" size="sm">Reconnect</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
      <Icon name="check_circle" size={20} className="text-emerald-500" />
      <div className="flex-1">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">
          Connected to {companyName}
        </p>
        {connectedAt && (
          <p className="text-xs text-[var(--color-text-muted)]">
            Since {new Date(connectedAt).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/gusto/connection-status.tsx
git commit -m "feat(gusto): add connection status banner component"
```

---

### Task 8: Employee Mapping Component

**Files:**
- Create: `src/components/gusto/employee-mapping.tsx`

- [ ] **Step 1: Create employee mapping UI**

```typescript
"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { mapEmployeeToGusto, unmapEmployee } from "@/lib/actions/gusto";
import type { GustoEmployee } from "@/lib/gusto";

type CalEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  gustoEmployeeId: string | null;
};

type Props = {
  gustoEmployees: GustoEmployee[];
  mappedEmployees: CalEmployee[];
  unmappedGusto: GustoEmployee[];
  unmappedCal: CalEmployee[];
};

export function EmployeeMapping({ gustoEmployees, mappedEmployees, unmappedGusto, unmappedCal }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleMap(employeeId: string, gustoId: string) {
    startTransition(async () => {
      await mapEmployeeToGusto(employeeId, gustoId);
    });
  }

  function handleUnmap(employeeId: string) {
    startTransition(async () => {
      await unmapEmployee(employeeId);
    });
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="flex gap-4 text-sm">
        <span className="text-[var(--color-text-muted)]">
          <span className="font-semibold text-[var(--color-text-primary)]">{mappedEmployees.length}</span> mapped
        </span>
        <span className="text-[var(--color-text-muted)]">
          <span className="font-semibold text-amber-500">{unmappedGusto.length}</span> unmatched in Gusto
        </span>
      </div>

      {/* Mapped employees */}
      {mappedEmployees.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Mapped Employees</h4>
          <div className="space-y-1">
            {mappedEmployees.map((emp) => {
              const ge = gustoEmployees.find((g) => g.uuid === emp.gustoEmployeeId);
              return (
                <div key={emp.id} className="flex items-center justify-between rounded-lg px-3 py-2 bg-[var(--color-surface-container)]">
                  <div className="flex items-center gap-2">
                    <Icon name="link" size={16} className="text-emerald-500" />
                    <span className="text-sm">{emp.firstName} {emp.lastName}</span>
                    <Icon name="arrow_forward" size={14} className="text-[var(--color-text-muted)]" />
                    <span className="text-sm text-[var(--color-text-muted)]">{ge?.first_name} {ge?.last_name}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleUnmap(emp.id)} disabled={isPending}>
                    <Icon name="link_off" size={16} />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Unmatched Gusto employees */}
      {unmappedGusto.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">Unmatched Gusto Employees</h4>
          <div className="space-y-2">
            {unmappedGusto.map((ge) => (
              <UnmatchedRow
                key={ge.uuid}
                gustoEmployee={ge}
                availableEmployees={unmappedCal}
                onMap={handleMap}
                isPending={isPending}
              />
            ))}
          </div>
        </div>
      )}

      {unmappedGusto.length === 0 && mappedEmployees.length > 0 && (
        <p className="text-sm text-emerald-600">All Gusto employees are mapped.</p>
      )}
    </div>
  );
}

function UnmatchedRow({
  gustoEmployee,
  availableEmployees,
  onMap,
  isPending,
}: {
  gustoEmployee: GustoEmployee;
  availableEmployees: CalEmployee[];
  onMap: (employeeId: string, gustoId: string) => void;
  isPending: boolean;
}) {
  const [selected, setSelected] = useState("");

  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2 bg-[var(--color-surface-container)]">
      <Badge variant="warning">{gustoEmployee.first_name} {gustoEmployee.last_name}</Badge>
      <span className="text-xs text-[var(--color-text-muted)]">{gustoEmployee.email}</span>
      <div className="flex-1" />
      <select
        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-sm"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
      >
        <option value="">Select employee...</option>
        {availableEmployees.map((e) => (
          <option key={e.id} value={e.id}>
            {e.firstName} {e.lastName} ({e.email})
          </option>
        ))}
      </select>
      <Button
        variant="secondary"
        size="sm"
        disabled={!selected || isPending}
        onClick={() => onMap(selected, gustoEmployee.uuid)}
      >
        Link
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/gusto/employee-mapping.tsx
git commit -m "feat(gusto): add employee mapping UI component"
```

---

### Task 9: Settings Page — Gusto Section

**Files:**
- Create: `src/components/settings/gusto-connection.tsx`
- Modify: `src/app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Create Gusto settings component**

```typescript
"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { GustoConnectionStatus } from "@/components/gusto/connection-status";
import { EmployeeMapping } from "@/components/gusto/employee-mapping";
import { disconnectGusto } from "@/lib/actions/gusto";
import type { GustoEmployee } from "@/lib/gusto";

type CalEmployee = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  gustoEmployeeId: string | null;
};

type Props = {
  connection: {
    companyName: string;
    createdAt: Date;
    tokenExpiresAt: Date;
  } | null;
  mapping?: {
    gustoEmps: GustoEmployee[];
    mapped: CalEmployee[];
    unmappedGusto: GustoEmployee[];
    unmappedCal: CalEmployee[];
  } | null;
};

export function GustoConnection({ connection, mapping }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Epoch 0 is the sentinel value set when token refresh fails — means "please reconnect"
  const stale = connection ? connection.tokenExpiresAt.getTime() === 0 : false;

  function handleDisconnect() {
    startTransition(async () => {
      await disconnectGusto();
      setShowConfirm(false);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="payments" size={20} />
          Gusto Integration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <GustoConnectionStatus
          connected={!!connection}
          companyName={connection?.companyName}
          connectedAt={connection?.createdAt}
          stale={stale}
        />

        {!connection && (
          <a href="/api/platforms/gusto/authorize">
            <Button>
              <Icon name="link" size={16} className="mr-2" />
              Connect Gusto
            </Button>
          </a>
        )}

        {connection && !stale && (
          <>
            {/* Disconnect */}
            {!showConfirm ? (
              <Button variant="destructive" size="sm" onClick={() => setShowConfirm(true)}>
                Disconnect
              </Button>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
                <p className="text-sm flex-1">This will remove all employee mappings. Are you sure?</p>
                <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={isPending}>
                  {isPending ? "Disconnecting..." : "Yes, disconnect"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowConfirm(false)}>
                  Cancel
                </Button>
              </div>
            )}

            {/* Employee mapping */}
            {mapping && (
              <div className="pt-4 border-t border-[var(--color-border)]">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Employee Mapping</h3>
                <EmployeeMapping
                  gustoEmployees={mapping.gustoEmps}
                  mappedEmployees={mapping.mapped}
                  unmappedGusto={mapping.unmappedGusto}
                  unmappedCal={mapping.unmappedCal}
                />
              </div>
            )}
          </>
        )}

        {connection && stale && (
          <a href="/api/platforms/gusto/authorize">
            <Button>
              <Icon name="refresh" size={16} className="mr-2" />
              Reconnect Gusto
            </Button>
          </a>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Add Gusto section to settings page**

In `src/app/(dashboard)/settings/page.tsx`:

Add imports at the top:
```typescript
import { GustoConnection } from "@/components/settings/gusto-connection";
import { getGustoConnection, getEmployeeMapping } from "@/lib/actions/gusto";
```

In the `Promise.all` array (line 36-48), add:
```typescript
    getGustoConnection(),
```

Destructure the result (add `gustoConnection` at the end of the destructured array).

After the `Promise.all`, add conditional mapping fetch:
```typescript
  let gustoMapping = null;
  if (gustoConnection) {
    try {
      gustoMapping = await getEmployeeMapping();
    } catch {
      // Gusto API may be unavailable — show connection without mapping
    }
  }
```

In the JSX, add the `<GustoConnection>` component after the `<NativeIntegrations>` Suspense block:
```tsx
        <GustoConnection
          connection={gustoConnection ? {
            companyName: gustoConnection.companyName,
            createdAt: gustoConnection.createdAt,
            tokenExpiresAt: gustoConnection.tokenExpiresAt,
          } : null}
          mapping={gustoMapping}
        />
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/gusto-connection.tsx src/app/\(dashboard\)/settings/page.tsx
git commit -m "feat(gusto): add Gusto connection and mapping UI to Settings"
```

---

## Chunk 4: Gusto Dashboard Page

### Task 10: Payroll List Component

**Files:**
- Create: `src/components/gusto/payroll-list.tsx`

- [ ] **Step 1: Create payroll list component**

```typescript
"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { approvePayrollRun } from "@/lib/actions/gusto";
import type { GustoPayroll } from "@/lib/gusto";

type Props = {
  payrolls: GustoPayroll[];
  onViewDetail?: (payrollId: string) => void;
};

export function PayrollList({ payrolls, onViewDetail }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleApprove(payrollId: string) {
    startTransition(async () => {
      await approvePayrollRun(payrollId);
    });
  }

  const statusBadge = (p: GustoPayroll) => {
    if (p.processed) return <Badge variant="success">Processed</Badge>;
    return <Badge variant="warning">Unprocessed</Badge>;
  };

  if (payrolls.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-[var(--color-text-muted)]">
          No payroll runs found.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="payments" size={20} />
          Payroll Runs
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {payrolls.map((p) => (
            <div
              key={p.payroll_uuid}
              className="flex items-center justify-between rounded-lg px-4 py-3 bg-[var(--color-surface-container)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
              onClick={() => onViewDetail?.(p.payroll_uuid)}
            >
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {p.pay_period.start_date} — {p.pay_period.end_date}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  Check date: {p.check_date}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {p.totals && (
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                    ${parseFloat(p.totals.gross_pay || "0").toLocaleString()}
                  </span>
                )}
                {statusBadge(p)}
                {!p.processed && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApprove(p.payroll_uuid);
                    }}
                    disabled={isPending}
                  >
                    Approve
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/gusto/payroll-list.tsx
git commit -m "feat(gusto): add payroll list component"
```

---

### Task 11: Payroll Detail Dialog

**Files:**
- Create: `src/components/gusto/payroll-detail-dialog.tsx`

- [ ] **Step 1: Create payroll detail dialog**

```typescript
"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { getPayrollDetail } from "@/lib/actions/gusto";
import type { GustoPayroll } from "@/lib/gusto";

type Props = {
  payrollId: string | null;
  onClose: () => void;
};

export function PayrollDetailDialog({ payrollId, onClose }: Props) {
  const [detail, setDetail] = useState<GustoPayroll | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!payrollId) return;
    setLoading(true);
    setError(null);
    getPayrollDetail(payrollId)
      .then(setDetail)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [payrollId]);

  if (!payrollId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl bg-[var(--color-surface)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Payroll Details</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <Icon name="close" size={20} />
          </Button>
        </div>

        {loading && <p className="text-sm text-[var(--color-text-muted)]">Loading...</p>}
        {error && <p className="text-sm text-red-500">{error}</p>}

        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[var(--color-text-muted)]">Pay Period</p>
                <p className="font-medium">{detail.pay_period.start_date} — {detail.pay_period.end_date}</p>
              </div>
              <div>
                <p className="text-[var(--color-text-muted)]">Check Date</p>
                <p className="font-medium">{detail.check_date}</p>
              </div>
              {detail.totals && (
                <>
                  <div>
                    <p className="text-[var(--color-text-muted)]">Gross Pay</p>
                    <p className="font-semibold">${parseFloat(detail.totals.gross_pay || "0").toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-[var(--color-text-muted)]">Net Pay</p>
                    <p className="font-semibold">${parseFloat(detail.totals.net_pay || "0").toLocaleString()}</p>
                  </div>
                </>
              )}
            </div>

            {detail.employee_compensations && detail.employee_compensations.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Employee Breakdown</h3>
                <div className="space-y-1">
                  {detail.employee_compensations.map((ec) => (
                    <div key={ec.employee_uuid} className="flex items-center justify-between rounded-lg px-3 py-2 bg-[var(--color-surface-container)] text-sm">
                      <span className="text-[var(--color-text-muted)] font-mono text-xs">{ec.employee_uuid.slice(0, 8)}...</span>
                      <div className="flex gap-4">
                        <span>Gross: ${parseFloat(ec.gross_pay || "0").toLocaleString()}</span>
                        <span>Net: ${parseFloat(ec.net_pay || "0").toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/gusto/payroll-detail-dialog.tsx
git commit -m "feat(gusto): add payroll detail dialog"
```

---

### Task 12: Time Off Requests Component (for dashboard)

**Files:**
- Create: `src/components/gusto/time-off-requests.tsx`

- [ ] **Step 1: Create pending time-off requests component**

```typescript
"use client";

import { useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { approveTimeOff, denyTimeOff } from "@/lib/actions/gusto";
import type { GustoTimeOffRequest } from "@/lib/gusto";

type Props = {
  requests: GustoTimeOffRequest[];
  employeeNames?: Map<string, string>; // gustoEmployeeId → name
};

export function TimeOffRequests({ requests, employeeNames }: Props) {
  const [isPending, startTransition] = useTransition();

  function handleApprove(uuid: string) {
    startTransition(async () => {
      await approveTimeOff(uuid);
    });
  }

  function handleDeny(uuid: string) {
    startTransition(async () => {
      await denyTimeOff(uuid);
    });
  }

  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-[var(--color-text-muted)]">
          No pending time off requests.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="beach_access" size={20} />
          Pending Time Off Requests
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {requests.map((r) => (
            <div key={r.uuid} className="flex items-center justify-between rounded-lg px-4 py-3 bg-[var(--color-surface-container)]">
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {employeeNames?.get(r.employee_uuid) || r.employee_uuid.slice(0, 8)}
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {r.start_date} — {r.end_date} · {r.request_type}
                </p>
                {r.employee_note && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-1 italic">"{r.employee_note}"</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default">{r.days} day{r.days !== 1 ? "s" : ""}</Badge>
                <Button variant="secondary" size="sm" onClick={() => handleApprove(r.uuid)} disabled={isPending}>
                  <Icon name="check" size={16} className="mr-1" />
                  Approve
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDeny(r.uuid)} disabled={isPending}>
                  <Icon name="close" size={16} className="mr-1" />
                  Deny
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/gusto/time-off-requests.tsx
git commit -m "feat(gusto): add time-off requests component for dashboard"
```

---

### Task 13: Gusto Dashboard Page

**Files:**
- Create: `src/app/(dashboard)/gusto/page.tsx`

- [ ] **Step 1: Create the Gusto dashboard page**

```typescript
import { requireAdmin } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Icon } from "@/components/ui/icon";
import { GustoConnectionStatus } from "@/components/gusto/connection-status";
import { PayrollList } from "@/components/gusto/payroll-list";
import { TimeOffRequests } from "@/components/gusto/time-off-requests";
import { getGustoConnection, getPayrolls, getGustoTimeOffRequests, getGustoEmployeeList } from "@/lib/actions/gusto";
import { db } from "@/lib/db";
import { GustoDashboardClient } from "@/components/gusto/gusto-dashboard-client";

export default async function GustoDashboardPage() {
  await requireAdmin();

  const connection = await getGustoConnection();

  if (!connection) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <PageHeader title="Gusto" description="Payroll & time-off management" />
        <GustoConnectionStatus connected={false} />
      </div>
    );
  }

  const stale = connection.tokenExpiresAt.getTime() < Date.now();

  if (stale) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <PageHeader title="Gusto" description="Payroll & time-off management" />
        <GustoConnectionStatus connected stale companyName={connection.companyName} connectedAt={connection.createdAt} />
      </div>
    );
  }

  // Fetch data in parallel — wrap each in try/catch for resilience
  let payrolls: Awaited<ReturnType<typeof getPayrolls>> = [];
  let pendingRequests: Awaited<ReturnType<typeof getGustoTimeOffRequests>> = [];
  let gustoEmployeeCount = 0;
  let payrollError: string | null = null;
  let timeOffError: string | null = null;

  const results = await Promise.allSettled([
    getPayrolls(),
    getGustoTimeOffRequests("pending"),
    getGustoEmployeeList(),
  ]);

  if (results[0].status === "fulfilled") payrolls = results[0].value;
  else payrollError = "Failed to load payroll data";

  if (results[1].status === "fulfilled") pendingRequests = results[1].value;
  else timeOffError = "Failed to load time-off requests";

  if (results[2].status === "fulfilled") gustoEmployeeCount = results[2].value.length;

  // Build employee name map from DB for time-off display
  const mappedEmps = await db.employee.findMany({
    where: { gustoEmployeeId: { not: null } },
    select: { gustoEmployeeId: true, firstName: true, lastName: true },
  });
  const nameMap = new Map(
    mappedEmps.map((e) => [e.gustoEmployeeId!, `${e.firstName} ${e.lastName}`])
  );

  // Next payroll date
  const nextPayroll = payrolls.find((p) => !p.processed);
  const nextPayDate = nextPayroll?.check_date || "—";

  return (
    <div className="mx-auto max-w-4xl p-8 space-y-6">
      <PageHeader title="Gusto" description="Payroll & time-off management" />

      <GustoConnectionStatus connected companyName={connection.companyName} connectedAt={connection.createdAt} />

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Next Payroll" value={nextPayDate} icon="calendar_today" />
        <StatCard title="Pending Requests" value={String(pendingRequests.length)} icon="pending_actions" />
        <StatCard title="Gusto Employees" value={String(gustoEmployeeCount)} icon="group" />
      </div>

      <GustoDashboardClient
        payrolls={payrolls}
        pendingRequests={pendingRequests}
        employeeNames={Object.fromEntries(nameMap)}
        payrollError={payrollError}
        timeOffError={timeOffError}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create client wrapper for interactive components**

Create `src/components/gusto/gusto-dashboard-client.tsx`:

```typescript
"use client";

import { useState } from "react";
import { PayrollList } from "@/components/gusto/payroll-list";
import { PayrollDetailDialog } from "@/components/gusto/payroll-detail-dialog";
import { TimeOffRequests } from "@/components/gusto/time-off-requests";
import type { GustoPayroll, GustoTimeOffRequest } from "@/lib/gusto";

type Props = {
  payrolls: GustoPayroll[];
  pendingRequests: GustoTimeOffRequest[];
  employeeNames: Record<string, string>;
  payrollError: string | null;
  timeOffError: string | null;
};

export function GustoDashboardClient({ payrolls, pendingRequests, employeeNames, payrollError, timeOffError }: Props) {
  const [selectedPayroll, setSelectedPayroll] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {payrollError ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">{payrollError}</div>
      ) : (
        <PayrollList payrolls={payrolls} onViewDetail={setSelectedPayroll} />
      )}

      {timeOffError ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">{timeOffError}</div>
      ) : (
        <TimeOffRequests requests={pendingRequests} employeeNames={new Map(Object.entries(employeeNames))} />
      )}

      <PayrollDetailDialog payrollId={selectedPayroll} onClose={() => setSelectedPayroll(null)} />
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/gusto/page.tsx src/components/gusto/gusto-dashboard-client.tsx
git commit -m "feat(gusto): add Gusto dashboard page with payroll and time-off overview"
```

---

## Chunk 5: Employee Profile Tab, Time-Off Integration, Sidebar

### Task 14: Employee Gusto Tab Component

**Files:**
- Create: `src/components/gusto/employee-gusto-tab.tsx`

- [ ] **Step 1: Create employee Gusto tab**

```typescript
"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import {
  getEmployeeCompensation,
  getEmployeePayStubs,
  getEmployeeTimeOffBalances,
  getGustoTimeOffRequests,
} from "@/lib/actions/gusto";
import type { GustoCompensation, GustoPayrollEmployee, GustoTimeOffBalance, GustoTimeOffRequest } from "@/lib/gusto";

type Props = {
  gustoEmployeeId: string;
};

export function EmployeeGustoTab({ gustoEmployeeId }: Props) {
  const [compensation, setCompensation] = useState<GustoCompensation[]>([]);
  const [payStubs, setPayStubs] = useState<GustoPayrollEmployee[]>([]);
  const [balances, setBalances] = useState<GustoTimeOffBalance[]>([]);
  const [timeOffHistory, setTimeOffHistory] = useState<GustoTimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [comp, stubs, bal, history] = await Promise.allSettled([
          getEmployeeCompensation(gustoEmployeeId),
          getEmployeePayStubs(gustoEmployeeId),
          getEmployeeTimeOffBalances(gustoEmployeeId),
          getGustoTimeOffRequests(),
        ]);
        if (comp.status === "fulfilled") setCompensation(comp.value);
        if (stubs.status === "fulfilled") setPayStubs(stubs.value);
        if (bal.status === "fulfilled") setBalances(bal.value);
        if (history.status === "fulfilled") {
          setTimeOffHistory(history.value.filter((r) => r.employee_uuid === gustoEmployeeId));
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load Gusto data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [gustoEmployeeId]);

  if (loading) {
    return <p className="text-sm text-[var(--color-text-muted)] py-8 text-center">Loading Gusto data...</p>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">{error}</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Compensation */}
      {compensation.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Compensation</CardTitle></CardHeader>
          <CardContent>
            {compensation.map((c) => (
              <div key={c.uuid} className="flex items-center justify-between py-2 border-b border-[var(--color-border)] last:border-0">
                <div>
                  <p className="text-sm font-medium">${parseFloat(c.rate).toLocaleString()} / {c.payment_unit}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">Effective {c.effective_date} · {c.flsa_status}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Time Off Balances */}
      {balances.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Time Off Balances</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {balances.map((b) => (
                <div key={b.policy_uuid} className="rounded-lg bg-[var(--color-surface-container)] p-3 text-center">
                  <p className="text-lg font-bold text-[var(--color-text-primary)]">{b.balance}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{b.policy_name}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pay Stubs */}
      {payStubs.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Recent Pay Stubs</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1">
              {payStubs.slice(0, 6).map((s, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2 bg-[var(--color-surface-container)] text-sm">
                  <span>Gross: ${parseFloat(s.gross_pay || "0").toLocaleString()}</span>
                  <span>Net: ${parseFloat(s.net_pay || "0").toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Time Off History */}
      {timeOffHistory.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Time Off History</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1">
              {timeOffHistory.map((r) => (
                <div key={r.uuid} className="flex items-center justify-between rounded-lg px-3 py-2 bg-[var(--color-surface-container)] text-sm">
                  <div>
                    <span>{r.start_date} — {r.end_date}</span>
                    <span className="text-xs text-[var(--color-text-muted)] ml-2">{r.request_type}</span>
                  </div>
                  <Badge variant={r.status === "approved" ? "success" : r.status === "denied" ? "destructive" : "default"}>
                    {r.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/gusto/employee-gusto-tab.tsx
git commit -m "feat(gusto): add employee Gusto tab with compensation, balances, pay stubs, time-off history"
```

---

### Task 15: Add Gusto Tab to Employee Profile Page

**Files:**
- Modify: `src/app/(dashboard)/people/[id]/page.tsx`

- [ ] **Step 1: Add Gusto tab to employee profile**

At the top of the file, add the import:
```typescript
import { EmployeeGustoTab } from "@/components/gusto/employee-gusto-tab";
```

In the page component, after fetching the employee, check for `gustoEmployeeId`:
```typescript
  const hasGusto = !!employee.gustoEmployeeId;
```

Find the section in the JSX where tabs or content sections are rendered. Add a new section conditionally:

```tsx
        {hasGusto && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
              <Icon name="payments" size={20} />
              Gusto
            </h3>
            <EmployeeGustoTab gustoEmployeeId={employee.gustoEmployeeId!} />
          </div>
        )}
```

The exact insertion point depends on the page's current layout — add it after the existing info sections (personal info, employment info, documents, etc.), before any closing `</div>` of the main content area.

**Access control:** The page already checks `isAdmin || isOwnProfile` before rendering sensitive sections. Gusto tab should follow the same pattern — only show if the viewer is the employee themselves, or SUPER_ADMIN/ADMIN/HR.

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/people/\[id\]/page.tsx
git commit -m "feat(gusto): add Gusto tab to employee profile page"
```

---

### Task 16: Gusto Time-Off Request Form

**Files:**
- Create: `src/components/gusto/gusto-time-off-form.tsx`

- [ ] **Step 1: Create Gusto time-off request form**

```typescript
"use client";

import { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { requestTimeOff, getGustoTimeOffPolicies } from "@/lib/actions/gusto";
import type { GustoTimeOffPolicy } from "@/lib/gusto";

type Props = {
  gustoEmployeeId: string;
};

export function GustoTimeOffForm({ gustoEmployeeId }: Props) {
  const [policies, setPolicies] = useState<GustoTimeOffPolicy[]>([]);
  const [policyUuid, setPolicyUuid] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getGustoTimeOffPolicies().then(setPolicies).catch(() => {});
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      try {
        await requestTimeOff({
          gustoEmployeeId,
          timeOffPolicyUuid: policyUuid,
          startDate,
          endDate,
          note,
        });
        setSuccess(true);
        setPolicyUuid("");
        setStartDate("");
        setEndDate("");
        setNote("");
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to submit request");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon name="add_circle" size={18} />
          Request Time Off
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)]">Type</label>
            <select
              className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
              value={policyUuid}
              onChange={(e) => setPolicyUuid(e.target.value)}
              required
            >
              <option value="">Select type...</option>
              {policies.map((p) => (
                <option key={p.uuid} value={p.uuid}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[var(--color-text-muted)]">Start Date</label>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--color-text-muted)]">End Date</label>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--color-text-muted)]">Note (optional)</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
          {success && <p className="text-sm text-emerald-600">Time off request submitted!</p>}

          <Button type="submit" disabled={isPending}>
            {isPending ? "Submitting..." : "Submit Request"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/gusto/gusto-time-off-form.tsx
git commit -m "feat(gusto): add Gusto time-off request form component"
```

---

### Task 17: Integrate Gusto into Time-Off Page

**Files:**
- Modify: `src/app/(dashboard)/time-off/page.tsx`

- [ ] **Step 1: Add Gusto imports and conditional rendering**

Add imports at the top:
```typescript
import { GustoTimeOffForm } from "@/components/gusto/gusto-time-off-form";
import { GustoConnectionStatus } from "@/components/gusto/connection-status";
import { getEmployeeTimeOffBalances, isGustoConnected } from "@/lib/actions/gusto";
import { db } from "@/lib/db";
```

After the session/role extraction (around line 26), add:
```typescript
  // Check if current employee is mapped to Gusto
  const currentEmployee = await db.employee.findFirst({
    where: { id: employeeId },
    select: { gustoEmployeeId: true },
  });
  const gustoConnected = await isGustoConnected();
  const isGustoMapped = gustoConnected && !!currentEmployee?.gustoEmployeeId;
```

If `isGustoMapped`, fetch Gusto balances:
```typescript
  let gustoBalances: Awaited<ReturnType<typeof getEmployeeTimeOffBalances>> = [];
  if (isGustoMapped && currentEmployee?.gustoEmployeeId) {
    try {
      gustoBalances = await getEmployeeTimeOffBalances(currentEmployee.gustoEmployeeId);
    } catch {
      // Gusto API error — fall through to local
    }
  }
```

In the JSX, before the existing balance display, add a conditional Gusto section:
```tsx
        {isGustoMapped && currentEmployee?.gustoEmployeeId && (
          <div className="space-y-4">
            {/* Gusto balances */}
            {gustoBalances.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {gustoBalances.map((b) => (
                  <div key={b.policy_uuid} className="rounded-xl bg-[var(--color-surface-container)] p-4 text-center">
                    <p className="text-2xl font-bold text-[var(--color-text-primary)]">{b.balance}</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{b.policy_name}</p>
                  </div>
                ))}
              </div>
            )}
            <GustoTimeOffForm gustoEmployeeId={currentEmployee.gustoEmployeeId} />
          </div>
        )}
```

The existing local time-off UI (balance display + request form) should be wrapped in a condition:
```tsx
        {!isGustoMapped && (
          /* ... existing local time-off balance display, request form, etc. ... */
        )}
```

For the admin view, also fetch Gusto pending requests and merge them into the request list:
```typescript
  let gustoPendingRequests: GustoTimeOffRequest[] = [];
  if (isApprover && gustoConnected) {
    const { getGustoTimeOffRequests } = await import("@/lib/actions/gusto");
    try {
      gustoPendingRequests = await getGustoTimeOffRequests("pending");
    } catch {
      // Gusto API unavailable — show local only
    }
  }
```

Add the import for the type:
```typescript
import type { GustoTimeOffRequest } from "@/lib/gusto";
```

In the admin request list section, render Gusto requests alongside local ones. Each Gusto request should have a `<Badge variant="secondary">Gusto</Badge>` source indicator, and use the `TimeOffRequests` component (from `@/components/gusto/time-off-requests.tsx`) for approve/deny actions. Pass the Gusto requests as a separate section below the local requests list:

```tsx
        {isApprover && gustoPendingRequests.length > 0 && (
          <TimeOffRequests requests={gustoPendingRequests} />
        )}
```

Add the import:
```typescript
import { TimeOffRequests } from "@/components/gusto/time-off-requests";
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/time-off/page.tsx
git commit -m "feat(gusto): integrate Gusto time-off into time-off page with dual mode"
```

---

### Task 18: Add Gusto Link to Sidebar

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Add Gusto nav link**

In the `allNavLinks` array (around line 22), add a new entry after the `time-off` entry and before `clubs`:

```typescript
  { href: "/gusto", label: "Gusto", icon: "payments", access: (r: UserRole) => r === "SUPER_ADMIN" || r === "ADMIN" || r === "HR" },
```

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat(gusto): add Gusto link to sidebar navigation"
```

---

### Task 19: Environment Variables & Final Verification

**Files:**
- Modify: `.env` (add placeholder variables)

- [ ] **Step 1: Add missing env vars to `.env`**

Add to `.env`:
```
GUSTO_API_URL=https://api.gusto-demo.com
GUSTO_ENCRYPTION_KEY=
```

Generate an encryption key for local dev:
Run: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

Put the output as the `GUSTO_ENCRYPTION_KEY` value.

- [ ] **Step 2: Verify full build**

Run: `NEXT_LINT_DURING_BUILD=false npx next build 2>&1 | tail -30`

Fix any TypeScript or build errors that appear.

- [ ] **Step 3: Commit**

```bash
git add .env
git commit -m "feat(gusto): add Gusto env vars for local development"
```

- [ ] **Step 4: Push to main**

```bash
git push origin main
```

This triggers Railway deploy which runs `prisma migrate deploy` to create the `GustoConnection` table and add `gustoEmployeeId` to `Employee`.
