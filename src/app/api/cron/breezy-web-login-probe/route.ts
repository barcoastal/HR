import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const CRON_SECRET = process.env.CRON_SECRET || "";

/**
 * Probe app.breezy.hr's signin to see if we can establish a browser-style
 * session via plain HTTP (no headless browser). If yes, we can use those
 * cookies to fetch /v3/.../resume — which currently 403s with the API
 * token but might work with a session cookie.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("secret") !== CRON_SECRET || !CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const platform = await db.recruitmentPlatform.findFirst({
    where: { name: "Breezy HR" },
    select: { refreshToken: true, accountIdentifier: true },
  });
  if (!platform?.refreshToken) {
    return NextResponse.json({ error: "Breezy creds not stored" }, { status: 404 });
  }
  const decoded = Buffer.from(platform.refreshToken, "base64").toString("utf-8");
  const [email, password] = decoded.split("::");
  const companyId = platform.accountIdentifier ?? "";

  type Step = { label: string; status: number; setCookie?: string[]; contentType?: string | null; preview?: string; location?: string | null };
  const steps: Step[] = [];

  // 1. GET /signin to bootstrap cookies + CSRF token
  const signinPageRes = await fetch("https://app.breezy.hr/signin", {
    redirect: "manual",
  });
  const signinCookies = signinPageRes.headers.getSetCookie();
  steps.push({
    label: "GET /signin",
    status: signinPageRes.status,
    setCookie: signinCookies,
    contentType: signinPageRes.headers.get("content-type"),
    location: signinPageRes.headers.get("location"),
  });
  const signinHtml = await signinPageRes.text();
  const csrfMatch = signinHtml.match(/name="_csrf"\s+value="([^"]+)"|csrfToken['"]?\s*:\s*['"]([^'"]+)['"]/);
  const csrf = csrfMatch ? csrfMatch[1] || csrfMatch[2] : null;
  steps.push({ label: "csrf extracted", status: 0, preview: csrf || "none" });

  // Build cookie header for the next request
  const cookieJar: string[] = [];
  for (const c of signinCookies) {
    const cookie = c.split(";")[0];
    cookieJar.push(cookie);
  }

  // 2. POST to /signin with various body shapes
  const bodyShapes = [
    { label: "JSON {email,password}", contentType: "application/json", body: JSON.stringify({ email, password }) },
    { label: "form-urlencoded email+password", contentType: "application/x-www-form-urlencoded", body: new URLSearchParams({ email, password }).toString() },
    { label: "JSON with _csrf", contentType: "application/json", body: JSON.stringify({ email, password, _csrf: csrf }) },
    { label: "form with _csrf", contentType: "application/x-www-form-urlencoded", body: new URLSearchParams({ email, password, _csrf: csrf || "" }).toString() },
  ];
  for (const shape of bodyShapes) {
    try {
      const res = await fetch("https://app.breezy.hr/signin", {
        method: "POST",
        headers: {
          "Content-Type": shape.contentType,
          Cookie: cookieJar.join("; "),
          Accept: "application/json, text/html",
        },
        body: shape.body,
        redirect: "manual",
      });
      const text = await res.text();
      steps.push({
        label: `POST /signin (${shape.label})`,
        status: res.status,
        contentType: res.headers.get("content-type"),
        setCookie: res.headers.getSetCookie(),
        location: res.headers.get("location"),
        preview: text.slice(0, 250),
      });
    } catch (err) {
      steps.push({ label: `POST /signin (${shape.label})`, status: 0, preview: String(err) });
    }
  }

  // 3. Try the JSON API path that browser dashboards often use
  try {
    const res = await fetch("https://app.breezy.hr/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email, password }),
      redirect: "manual",
    });
    const text = await res.text();
    steps.push({
      label: "POST /api/auth/signin",
      status: res.status,
      contentType: res.headers.get("content-type"),
      setCookie: res.headers.getSetCookie(),
      preview: text.slice(0, 250),
    });
  } catch (err) {
    steps.push({ label: "POST /api/auth/signin", status: 0, preview: String(err) });
  }

  return NextResponse.json({ companyId, steps });
}
