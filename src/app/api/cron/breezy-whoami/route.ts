import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const CRON_SECRET = process.env.CRON_SECRET || "";
const BREEZY_BASE_URL = "https://api.breezy.hr/v3";

/**
 * GET /api/cron/breezy-whoami?secret=...
 * Surfaces the email used for the Breezy integration AND the full /signin
 * response so we can see the user's role/permissions. Diagnostic — remove
 * once the resume issue is sorted.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("secret") !== CRON_SECRET || !CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const platform = await db.recruitmentPlatform.findFirst({ where: { name: "Breezy HR" } });
  if (!platform || !platform.refreshToken) {
    return NextResponse.json({ error: "Breezy not connected" }, { status: 404 });
  }

  let email = "";
  try {
    const decoded = Buffer.from(platform.refreshToken, "base64").toString("utf-8");
    const [e] = decoded.split("::");
    email = e || "";
  } catch {
    return NextResponse.json({ error: "Could not decode credentials" }, { status: 500 });
  }
  if (!email) return NextResponse.json({ error: "No email in stored credentials" }, { status: 500 });

  // Do a fresh signin so we capture the full response (user object + role).
  const password = (() => {
    try {
      const decoded = Buffer.from(platform.refreshToken!, "base64").toString("utf-8");
      return decoded.split("::")[1] || "";
    } catch {
      return "";
    }
  })();
  if (!password) return NextResponse.json({ error: "No password in stored credentials" }, { status: 500 });

  const signinRes = await fetch(`${BREEZY_BASE_URL}/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const signinBody = await signinRes.json();

  // If we got an access_token, try /v3/me and /v3/companies to see scope.
  const accessToken: string = signinBody?.access_token || "";
  let me: unknown = null;
  let companies: unknown = null;
  if (accessToken) {
    const meRes = await fetch(`${BREEZY_BASE_URL}/me`, { headers: { Authorization: accessToken } });
    me = meRes.ok ? await meRes.json() : { status: meRes.status, body: (await meRes.text()).slice(0, 300) };
    const companiesRes = await fetch(`${BREEZY_BASE_URL}/companies`, { headers: { Authorization: accessToken } });
    companies = companiesRes.ok ? await companiesRes.json() : { status: companiesRes.status, body: (await companiesRes.text()).slice(0, 300) };
  }

  return NextResponse.json({
    connectedAs: email,
    signinResponseKeys: Object.keys(signinBody || {}),
    signinUserObject: signinBody?.user ?? null,
    me,
    companies,
  });
}
