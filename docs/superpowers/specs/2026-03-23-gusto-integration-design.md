# Gusto Integration — Design Spec

## Goal

Connect CALATRAVA to Gusto via their App Integrations API to display payroll, time off, and compensation data. Employees can request time off from CALATRAVA (synced to Gusto). Admins can view and approve payroll runs. All Gusto data is fetched live — no local caching.

## Constraints

- OAuth2 authentication with access/refresh token management
- Live API calls to Gusto (no local data duplication except tokens + employee mapping)
- Employee mapping by email auto-match, with manual fallback
- Time off requests originate in CALATRAVA, sync to Gusto
- Payroll: view + approve in CALATRAVA, final submission in Gusto
- Webhooks for real-time event notifications
- Access: employees see their own data, SUPER_ADMIN/ADMIN/HR see everything
- Gusto API base URL configurable via `GUSTO_API_URL` env var (sandbox: `https://api.gusto-demo.com`, production: `https://api.gusto.com`)

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `GUSTO_CLIENT_ID` | OAuth2 client ID (registered in Gusto developer portal) |
| `GUSTO_CLIENT_SECRET` | OAuth2 client secret |
| `GUSTO_API_URL` | API base URL — `https://api.gusto-demo.com` (sandbox) or `https://api.gusto.com` (production) |
| `GUSTO_ENCRYPTION_KEY` | 32-byte hex key for AES-256-GCM encryption of stored tokens |

### OAuth Scopes

Request these scopes during authorization: `companies:read employees:read employees:manage payrolls:read payrolls:run time_off_policies:read time_off_requests:read time_off_requests:write webhooks:manage`

---

## Architecture

### OAuth2 Connection Flow

Reuses the existing OAuth infrastructure (`src/lib/oauth/config.ts`, `src/lib/oauth/utils.ts`):

1. Add `gusto` to `OAUTH_PROVIDERS` registry with scopes, token URL, and authorization URL
2. Admin clicks "Connect Gusto" → hits `GET /api/platforms/gusto/authorize` (existing dynamic route)
3. Existing route generates CSRF `state` via `createOAuthState`, redirects to Gusto authorization URL
4. Gusto redirects back to `GET /api/platforms/gusto/callback` (existing dynamic route)
5. Callback validates state via `validateAndConsumeState`, exchanges code for tokens via `exchangeCodeForTokens`
6. **Callback branching**: Add a provider-specific callback handler map to the callback route. When `providerId === 'gusto'`, call a dedicated `handleGustoCallback(tokens, stateData)` function (exported from `src/lib/gusto.ts`) instead of the default `RecruitmentPlatform` upsert. All other providers continue using the existing logic unchanged. The Gusto handler: creates/updates `GustoConnection` with encrypted tokens, fetches company info from Gusto API, creates webhook subscription (storing `webhookSubId` and `webhookSecret`), and triggers employee auto-matching. If webhook subscription creation fails, the connection still succeeds but `webhookSubId`/`webhookSecret` remain null (degraded — no real-time notifications). Employee auto-matching is done synchronously with paginated fetches.
7. Token refresh is automatic (tokens expire every 2 hours). Encrypt/decrypt helpers live in `src/lib/gusto.ts`. A mutex/lock (in-memory promise dedup) ensures only one refresh runs at a time to prevent race conditions when concurrent requests detect an expired token simultaneously.
8. The `gusto` entry in `OAUTH_PROVIDERS` computes `authorizationUrl` and `tokenUrl` from `process.env.GUSTO_API_URL` at registration time (e.g., `${GUSTO_API_URL}/oauth/authorize`), ensuring sandbox/production URLs stay in sync.

### API Wrapper

Single module `src/lib/gusto.ts` handles all Gusto API communication:
- Token management (auto-refresh before expiry)
- Typed API methods for each resource (employees, payroll, time off, etc.)
- Error handling (token expiry, rate limits, network failures)
- Rate limit handling: respect Gusto's `X-RateLimit-Remaining` / `Retry-After` headers. On 429 responses, wait and retry once. For dashboard pages that make multiple API calls, use `Promise.all` to parallelize but respect rate limits.

### Webhook Receiver

`/api/gusto/webhooks` endpoint receives Gusto events:
1. Look up the single `GustoConnection` row (one connection per instance)
2. If no connection or no `webhookSecret`, reject with 401
3. Decrypt `webhookSecret` and validate HMAC-SHA256 signature against request body
4. Parse event type and handle: employee updated, payroll processed, time off changed
5. Post notification to CALATRAVA feed when relevant

---

## Database Changes

### New model: GustoConnection

```prisma
model GustoConnection {
  id             String   @id @default(uuid())
  companyId      String   @unique  // Gusto-assigned company UUID, used as path param in all API calls
  companyName    String
  accessToken    String            // AES-256-GCM encrypted
  refreshToken   String            // AES-256-GCM encrypted
  tokenExpiresAt DateTime
  webhookSubId   String?           // Gusto webhook subscription UUID (for cleanup on disconnect)
  webhookSecret  String?           // HMAC-SHA256 signing secret returned when creating webhook subscription (encrypted)
  connectedBy    String?           // User ID of admin who initiated the connection (from OAuth state)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

Single row — one Gusto connection per CALATRAVA instance. `companyId` is the Gusto-assigned company UUID used in all API paths (`/v1/companies/{companyId}/...`).

### Modify Employee model

Add `gustoEmployeeId String? @unique` — nullable, unique constraint. Links CALATRAVA employee to Gusto employee UUID. One-to-one mapping.

---

## Features

### 1. Settings — Gusto Connection (`/settings`)

- **Connect button**: Initiates OAuth2 flow → Gusto authorization → callback stores tokens
- **Connection status**: Shows connected company name, connection date, or "Not connected"
- **Disconnect button**: Calls `disconnectGusto` server action which deletes the webhook subscription via Gusto API (using `webhookSubId`), deletes the `GustoConnection` row, and clears all `gustoEmployeeId` values. Confirmation dialog before executing.
- **Employee mapping UI**: After connecting, auto-matches by email. Shows unmatched Gusto employees with a dropdown to manually link to CALATRAVA employees
- Access: SUPER_ADMIN and ADMIN only

### 2. Gusto Dashboard (`/gusto`)

Admin-only overview page showing:
- **Connection status** banner
- **Quick stats**: next payroll date, pending time off requests count, Gusto employee count
- **Recent payroll runs**: list with status (unprocessed, approved, processed), dates, total amounts
- **Pending time off requests**: list with employee name, dates, type, approve/deny buttons

Access: SUPER_ADMIN, ADMIN, HR

### 3. Employee Profile — Gusto Tab (`/people/[id]`)

New tab on employee profile page (only visible if employee has `gustoEmployeeId`):
- **Compensation**: salary/hourly rate, pay schedule
- **Pay stubs**: list of recent payroll entries with gross/net pay, deductions, taxes
- **Time off balances**: vacation days remaining, sick days remaining, PTO balance
- **Time off history**: list of past requests with status

Access: Employee sees their own tab. SUPER_ADMIN/ADMIN/HR see all employees.

### 4. Time Off Page (`/time-off`) — Enhanced

The existing local time-off system (`TimeOffPolicy`, `TimeOffBalance`, `TimeOffRequest`) remains for employees not mapped to Gusto. For mapped employees, the page switches to Gusto mode:

- **Employee view (mapped to Gusto)**: Shows Gusto time off balances + request form (start date, end date, type selection from Gusto policies). Submitting creates the request in Gusto via API. Local `TimeOffRequest` records are not created — Gusto is the source of truth.
- **Employee view (not mapped)**: Unchanged — uses existing local time-off system.
- **Admin view**: Shows both Gusto-sourced and local requests in a unified list. Gusto requests have approve/deny buttons that sync to Gusto API. Local requests use existing local logic. A badge indicates the source (Gusto vs. Local).

### 5. Payroll on Gusto Dashboard

- List of payroll runs fetched from Gusto (upcoming, in progress, completed)
- Click to view details: per-employee earnings, deductions, taxes, net pay
- "Approve" button for unprocessed payrolls → calls Gusto API to approve
- Final submission/processing happens in Gusto directly

### 6. Error & Disconnected States

All Gusto-dependent UI handles the disconnected/error case:
- **Not connected**: Pages that require Gusto show a banner: "Gusto is not connected. Connect in Settings." with a link to `/settings`.
- **Token expired / refresh failed**: If token refresh fails (e.g., revoked access), mark connection as stale, show "Gusto connection lost — please reconnect" banner on all Gusto pages, and redirect admin to Settings.
- **API errors**: Individual API call failures show inline error messages ("Failed to load payroll data — try again") with a retry button. Do not break the entire page for a single failed fetch.

---

## Data Flows

### Employee Mapping

```
Admin connects Gusto
  → Fetch all Gusto employees
  → Match by email to CALATRAVA employees
  → Store gustoEmployeeId on matched employees
  → Show unmatched in mapping UI for manual linking
```

### Time Off Request

```
Employee submits in CALATRAVA (dates, type)
  → POST to Gusto API to create time off request
  → Show pending status in CALATRAVA

Admin approves/denies in CALATRAVA
  → PUT to Gusto API to approve/deny
  → Status reflected on next read
```

### Payroll Approval

```
Admin views payroll runs on /gusto (fetched live from Gusto)
  → Clicks "Approve" on unprocessed payroll
  → PUT to Gusto API to approve
  → Final submission done in Gusto UI
```

### Webhook Subscription

```
OAuth callback completes successfully
  → POST to Gusto API to create webhook subscription for company events
  → Store returned subscription UUID in GustoConnection.webhookSubId
  → Webhook URL: {NEXTAUTH_URL}/api/gusto/webhooks

On disconnect:
  → DELETE webhook subscription via Gusto API using webhookSubId
  → Then delete GustoConnection row
```

### Webhook Event Handling

```
Gusto event fired (employee updated, payroll processed, time off changed)
  → POST /api/gusto/webhooks
  → Validate HMAC-SHA256 signature using webhook signing secret from subscription
  → Create feed notification if relevant
```

---

## API Routes

| Route | Purpose |
|-------|---------|
| `GET /api/platforms/gusto/authorize` | Initiate OAuth2 flow (existing dynamic route) |
| `GET /api/platforms/gusto/callback` | OAuth2 callback — custom Gusto logic in callback handler |
| `POST /api/gusto/webhooks` | Receive Gusto webhook events |
| Server actions in `src/lib/actions/gusto.ts` | All other Gusto operations (fetch employees, payroll, time off, approve, disconnect, etc.) |

---

## File Summary

| Action | File |
|--------|------|
| Create | `src/lib/gusto.ts` (API wrapper with token management, encryption helpers) |
| Create | `src/lib/actions/gusto.ts` (server actions for all Gusto operations including disconnect) |
| Create | `src/app/api/gusto/webhooks/route.ts` (webhook receiver) |
| Create | `src/app/(dashboard)/gusto/page.tsx` (Gusto dashboard) |
| Create | `src/components/gusto/` (dashboard components, mapping UI, payroll cards, time off components) |
| Modify | `src/lib/oauth/config.ts` (add `gusto` to OAUTH_PROVIDERS registry) |
| Modify | `src/app/api/platforms/[provider]/callback/route.ts` (add Gusto-specific callback logic) |
| Modify | `prisma/schema.prisma` (add GustoConnection model, gustoEmployeeId on Employee) |
| Modify | `src/app/(dashboard)/people/[id]/page.tsx` (add Gusto tab) |
| Modify | `src/app/(dashboard)/time-off/page.tsx` (integrate Gusto balances + requests, dual mode) |
| Modify | `src/app/(dashboard)/settings/page.tsx` (add Gusto connection section) |
| Modify | `src/components/layout/sidebar.tsx` (add Gusto nav link) |
