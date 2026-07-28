/**
 * Sandbox / safe-send mode.
 *
 * Two ways to enable:
 *   1. Env: SANDBOX_MODE=1 (or true/yes) — typically the dedicated Railway sandbox service.
 *      Sync flag `IS_SANDBOX` is true only for this env form (used by reset API, banners, etc.).
 *   2. Settings toggle: CompanySettings.sandboxMode — applies for everyone on the instance.
 *
 * Prefer `await isSandboxMode()` for outbound side-effects (emails, SMS, calendar, Gusto).
 * That covers both env and the Settings toggle.
 */

function envSandboxEnabled(): boolean {
  const v = process.env.SANDBOX_MODE?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

/** Sync env-only flag (Railway sandbox service / reset tooling). */
export const IS_SANDBOX = envSandboxEnabled();

/**
 * True when env sandbox is on OR Settings → Sandbox mode is toggled on.
 */
export async function isSandboxMode(): Promise<boolean> {
  if (envSandboxEnabled()) return true;

  try {
    const { getCompanySettings } = await import("@/lib/actions/company-settings");
    const settings = await getCompanySettings();
    return Boolean(settings.sandboxMode);
  } catch {
    return false;
  }
}

export function logSandbox(channel: string, detail: string, extra?: unknown) {
  if (extra !== undefined) {
    console.warn(`[sandbox] ${channel}: ${detail}`, extra);
  } else {
    console.warn(`[sandbox] ${channel}: ${detail}`);
  }
}

/** Fake Meet link so UI flows still complete in sandbox. */
export function sandboxMeetLink(label = "test"): string {
  return `https://meet.google.com/sandbox-${label}-${Date.now().toString(36)}`;
}

/** Fake calendar event id so cancel/update paths can recognize sandbox events. */
export function sandboxEventId(label = "event"): string {
  return `sandbox-${label}-${Date.now().toString(36)}`;
}

export function isSandboxEventId(eventId: string | null | undefined): boolean {
  return !!eventId && eventId.startsWith("sandbox-");
}
