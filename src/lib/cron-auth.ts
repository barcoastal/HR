/**
 * Verify the inbound cron secret. Accepts:
 *   1. `Authorization: Bearer <secret>` header (preferred — doesn't leak to logs)
 *   2. `?secret=<secret>` query string (back-compat for existing Railway cron service)
 *
 * Returns true when authorized.
 */
export function isAuthorizedCronRequest(request: Request): boolean {
  const expected = process.env.CRON_SECRET || "";
  if (!expected) return false;

  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match && match[1] === expected) return true;
  }

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  if (querySecret && querySecret === expected) return true;

  return false;
}
