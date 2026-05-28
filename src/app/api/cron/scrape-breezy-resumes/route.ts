import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 800; // Railway can run up to ~15 min per request

const CRON_SECRET = process.env.CRON_SECRET || "";
const BREEZY_EMAIL = process.env.BREEZY_EMAIL || "";
const BREEZY_PASSWORD = process.env.BREEZY_PASSWORD || "";

type PendingRow = {
  id: string;
  email: string;
  resumeUrl: string;
  cid: string;
  pid: string;
  cnd: string;
};

/**
 * GET /api/cron/scrape-breezy-resumes?secret=...&limit=50
 *
 * Server-side recovery for any Breezy candidate whose resume our /v3
 * sync couldn't download (returned 403 getResumeUnauthorized). Runs a
 * headless Chromium session, signs in as the configured Breezy user,
 * and pulls each pending candidate's PDF via the SPA-side API
 * (app.breezy.hr/api/...) where `resume.pdf_url` IS populated. The
 * downloaded bytes are persisted to FileBlob and the candidate row is
 * rewritten to /api/resumes/{id}.
 *
 * Stops at `limit` per invocation (default 50) so a single Railway
 * request never runs too long.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("secret") !== CRON_SECRET || !CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!BREEZY_EMAIL || !BREEZY_PASSWORD) {
    return NextResponse.json(
      { error: "BREEZY_EMAIL / BREEZY_PASSWORD env vars not set on the server" },
      { status: 500 },
    );
  }
  const limit = parseInt(url.searchParams.get("limit") || "50", 10);

  // Find every candidate whose resumeUrl still points at the raw
  // api.breezy.hr endpoint that's currently 403'ing.
  const rows = await db.candidate.findMany({
    where: { resumeUrl: { contains: "api.breezy.hr" } },
    select: { id: true, email: true, resumeUrl: true },
    take: limit,
  });
  const pending: PendingRow[] = [];
  for (const r of rows) {
    const match = r.resumeUrl?.match(
      /api\.breezy\.hr\/v3\/company\/([^/]+)\/position\/([^/]+)\/candidate\/([^/]+)\/resume/,
    );
    if (!match) continue;
    pending.push({
      id: r.id,
      email: r.email,
      resumeUrl: r.resumeUrl!,
      cid: match[1],
      pid: match[2],
      cnd: match[3],
    });
  }
  if (pending.length === 0) {
    return NextResponse.json({ status: "nothing-to-do", scanned: rows.length });
  }

  // Lazy-import Chromium so a broken native binary doesn't 500 the whole
  // module at load time — we want the real error in the response body.
  let executablePath: string;
  let chromiumArgs: string[];
  let playwrightChromium: typeof import("playwright-core").chromium;
  try {
    const sparticuz = (await import("@sparticuz/chromium")).default;
    const pw = await import("playwright-core");
    executablePath = await sparticuz.executablePath();
    chromiumArgs = sparticuz.args;
    playwrightChromium = pw.chromium;
  } catch (err) {
    return NextResponse.json(
      { error: `Chromium load failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }

  let browser: Awaited<ReturnType<typeof playwrightChromium.launch>>;
  try {
    browser = await playwrightChromium.launch({
      executablePath,
      headless: true,
      args: chromiumArgs,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Chromium launch failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
    locale: "en-US",
    timezoneId: "America/New_York",
    extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
  const page = await context.newPage();

  try {
    await page.goto("https://app.breezy.hr/signin", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForSelector('input[name="email_address"]', { timeout: 15000 });
    await page.fill('input[name="email_address"]', BREEZY_EMAIL);
    await page.fill('input[name="password"]', BREEZY_PASSWORD);
    await page.click('input[type="submit"], button[type="submit"]');
    await page.waitForURL((u) => !u.toString().includes("/signin"), { timeout: 30000 });
    await page.waitForTimeout(2000);
  } catch (err) {
    await browser.close();
    return NextResponse.json(
      { error: `Breezy login failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }

  let uploaded = 0;
  let failed = 0;
  const failures: { id: string; email: string; reason: string }[] = [];

  for (const c of pending) {
    try {
      const result = await page.evaluate(
        async ({ cid, pid, cnd }) => {
          const dr = await fetch(
            `https://app.breezy.hr/api/company/${cid}/position/${pid}/candidate/${cnd}`,
            { credentials: "include" },
          );
          if (!dr.ok) return { err: `detail ${dr.status}` };
          const detail = await dr.json();
          const url = detail?.resume?.pdf_url || detail?.resume?.url;
          if (!url) return { err: "no resume.pdf_url" };
          const pr = await fetch(url, { credentials: "include" });
          if (!pr.ok) return { err: `pdf fetch ${pr.status}` };
          const buf = await pr.arrayBuffer();
          const head = Array.from(new Uint8Array(buf.slice(0, 4)));
          const isPdf =
            head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46;
          return { bytes: Array.from(new Uint8Array(buf)), isPdf, byteLength: buf.byteLength };
        },
        { cid: c.cid, pid: c.pid, cnd: c.cnd },
      );

      if ("err" in result && result.err) {
        failures.push({ id: c.id, email: c.email, reason: result.err });
        failed += 1;
        continue;
      }
      if (!result.isPdf) {
        failures.push({ id: c.id, email: c.email, reason: "not a PDF" });
        failed += 1;
        continue;
      }
      const buffer = Buffer.from(result.bytes!);
      const bytes = new Uint8Array(buffer);
      const filename = `resume-${c.id}.pdf`;
      await db.fileBlob.upsert({
        where: { filename },
        update: { data: bytes, size: bytes.length, mimeType: "application/pdf" },
        create: { filename, data: bytes, size: bytes.length, mimeType: "application/pdf" },
      });
      await db.candidate.update({
        where: { id: c.id },
        data: { resumeUrl: `/api/resumes/${c.id}` },
      });
      uploaded += 1;
    } catch (err) {
      failures.push({
        id: c.id,
        email: c.email,
        reason: err instanceof Error ? err.message : String(err),
      });
      failed += 1;
    }
  }

  await browser.close();
  return NextResponse.json({
    status: "done",
    processed: pending.length,
    uploaded,
    failed,
    failures: failures.slice(0, 20),
  });
}
