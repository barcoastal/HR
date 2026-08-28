import twilio from "twilio";
import { db } from "@/lib/db";

const client =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

const FROM_NUMBER = process.env.TWILIO_PHONE_NUMBER || "";

/**
 * Send a single SMS. Returns true on success, false on failure.
 * Never throws — failures are logged and returned as false.
 */
export async function sendSMS(to: string, body: string): Promise<boolean> {
  if (await isDeactivatedPhone(to)) {
    console.warn(`[sms] Suppressed — recipient is deactivated: ${to}`);
    return false;
  }
  if (!client || !FROM_NUMBER) {
    console.warn(`[sms] Twilio not configured — skipping SMS to ${to}`);
    return false;
  }

  try {
    await client.messages.create({
      body,
      from: FROM_NUMBER,
      to,
    });
    console.log(`[sms] Sent to ${to}`);
    return true;
  } catch (error) {
    console.error(`[sms] Failed to send to ${to}:`, error);
    return false;
  }
}

/** True when the number belongs to an offboarded/archived employee or a deactivated login. */
async function isDeactivatedPhone(to: string): Promise<boolean> {
  const digits = to.replace(/\D/g, "").slice(-10);
  if (digits.length < 10) return false;
  const [active, archived] = await Promise.all([
    db.employee.findMany({ where: { phone: { contains: digits.slice(-4) } }, select: { id: true, phone: true, status: true, user: { select: { deactivatedAt: true } } } }),
    db.employee.findMany({ where: { phone: { contains: digits.slice(-4) }, archivedAt: { not: null } }, select: { id: true, phone: true } }),
  ]);
  const sameNumber = (p: string | null) => (p ?? "").replace(/\D/g, "").slice(-10) === digits;
  if (archived.some((e) => sameNumber(e.phone))) return true;
  return active.some((e) => sameNumber(e.phone) && (e.status === "OFFBOARDED" || !!e.user?.deactivatedAt));
}
