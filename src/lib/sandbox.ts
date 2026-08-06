// Sandbox environment flag. Set SANDBOX_MODE=1 on the Railway sandbox
// service (never on production). When on:
//  - no real emails are sent (Resend calls are skipped and logged)
//  - job-board posting (Breezy) returns simulated success
//  - Google Calendar interview events are simulated with a fake Meet link
//  - background checks are simulated instead of hitting Continental Screening
//  - /api/sandbox/reset can wipe and reseed the demo data
export const IS_SANDBOX = process.env.SANDBOX_MODE === "1";
