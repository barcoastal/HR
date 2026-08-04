import twilio from "twilio";

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
