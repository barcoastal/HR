#!/usr/bin/env node
/**
 * Long-running Railway worker that pulls Breezy resumes our /v3 API can't
 * fetch (403'd) and uploads them to the main app.
 *
 * Critical design choice: we log in ONCE at startup and reuse the same
 * Chromium context for every 5-min tick. Re-logging in every tick burned
 * through Breezy's WAF tolerance and started getting CAPTCHA-blocked.
 *
 * Required env (set on the Railway service):
 *   BREEZY_EMAIL, BREEZY_PASSWORD
 *   CRON_SECRET            — matches the main app's CRON_SECRET
 *   APP_URL                — e.g. https://hr.coastaldebt-tools.com
 *
 * Optional env:
 *   INTERVAL_SEC=300       — seconds between runs (default 5 min)
 *   LIMIT_PER_RUN=50       — max candidates processed per run
 *   SESSION_TTL_HOURS=12   — force a re-login after this many hours
 */

import { chromium } from "playwright";

const {
  BREEZY_EMAIL,
  BREEZY_PASSWORD,
  CRON_SECRET,
  APP_URL,
} = process.env;
const INTERVAL_SEC = parseInt(process.env.INTERVAL_SEC || "300", 10);
const LIMIT_PER_RUN = parseInt(process.env.LIMIT_PER_RUN || "50", 10);
const SESSION_TTL_MS = parseInt(process.env.SESSION_TTL_HOURS || "12", 10) * 60 * 60 * 1000;

if (!BREEZY_EMAIL || !BREEZY_PASSWORD || !CRON_SECRET || !APP_URL) {
  console.error("Missing required env: BREEZY_EMAIL, BREEZY_PASSWORD, CRON_SECRET, APP_URL");
  process.exit(1);
}

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function fetchPending() {
  const res = await fetch(`${APP_URL}/api/cron/breezy-pending-resumes?secret=${CRON_SECRET}`);
  if (!res.ok) throw new Error(`pending list ${res.status}: ${await res.text()}`);
  return res.json();
}

async function uploadResume(candidateId, buffer) {
  const res = await fetch(
    `${APP_URL}/api/cron/attach-resume?secret=${CRON_SECRET}&candidateId=${candidateId}`,
    { method: "POST", headers: { "Content-Type": "application/pdf" }, body: buffer },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`upload ${res.status}: ${data.error || ""}`);
  return data;
}

async function newBrowserContext() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
  });
  const ctx = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
    locale: "en-US",
    timezoneId: "America/New_York",
    extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
  });
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
  return { browser, ctx };
}

async function loginPage(ctx) {
  const page = await ctx.newPage();
  // domcontentloaded is enough — networkidle is unreliable on SPA pages
  // with long-polling listeners and was the source of the WAF timeouts.
  await page.goto("https://app.breezy.hr/signin", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForSelector('input[name="email_address"]', { timeout: 15000 });
  await page.fill('input[name="email_address"]', BREEZY_EMAIL);
  await page.fill('input[name="password"]', BREEZY_PASSWORD);
  // Submit + wait for navigation off /signin.
  await Promise.all([
    page.waitForURL((u) => !u.toString().includes("/signin"), { timeout: 30000 }),
    page.click('input[type="submit"], button[type="submit"]'),
  ]);
  await page.waitForTimeout(2000);
  return page;
}

async function isSessionValid(page) {
  try {
    const ok = await page.evaluate(async () => {
      const r = await fetch("https://app.breezy.hr/api/me", { credentials: "include" });
      return r.ok;
    });
    return !!ok;
  } catch {
    return false;
  }
}

async function processCandidate(page, c) {
  const result = await page.evaluate(
    async ({ cid, pid, cnd }) => {
      const dr = await fetch(
        `https://app.breezy.hr/api/company/${cid}/position/${pid}/candidate/${cnd}`,
        { credentials: "include" },
      );
      if (!dr.ok) return { err: `detail ${dr.status}`, authFailed: dr.status === 401 || dr.status === 403 };
      const detail = await dr.json();
      const url = detail?.resume?.pdf_url || detail?.resume?.url;
      if (!url) return { err: "no resume.pdf_url" };
      const pr = await fetch(url, { credentials: "include" });
      if (!pr.ok) return { err: `pdf fetch ${pr.status}`, authFailed: pr.status === 401 || pr.status === 403 };
      const buf = await pr.arrayBuffer();
      const head = Array.from(new Uint8Array(buf.slice(0, 4)));
      const isPdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46;
      return { bytes: Array.from(new Uint8Array(buf)), isPdf };
    },
    { cid: c.breezyCompanyId, pid: c.breezyPositionId, cnd: c.breezyCandidateId },
  );
  return result;
}

// Module-level session state — re-used across ticks. Re-created when the
// session expires or a fatal browser error occurs.
let browser = null;
let ctx = null;
let page = null;
let loggedInAt = 0;

async function ensureSession() {
  const sessionExpired = loggedInAt && Date.now() - loggedInAt > SESSION_TTL_MS;
  if (browser && page && !sessionExpired && (await isSessionValid(page))) {
    return;
  }
  if (browser) {
    try { await browser.close(); } catch { /* ignore */ }
    browser = null; ctx = null; page = null;
  }
  log("signing in to Breezy…");
  const created = await newBrowserContext();
  browser = created.browser;
  ctx = created.ctx;
  page = await loginPage(ctx);
  loggedInAt = Date.now();
  log("signed in.");
}

async function runOnce() {
  const { total, candidates } = await fetchPending();
  if (total === 0) {
    log("nothing to do");
    return { uploaded: 0, failed: 0 };
  }
  const work = candidates.slice(0, LIMIT_PER_RUN);
  log(`processing ${work.length} of ${total} pending`);

  await ensureSession();

  let uploaded = 0, failed = 0;
  for (const c of work) {
    if (!c.breezyCompanyId || !c.breezyPositionId || !c.breezyCandidateId) {
      log(`SKIP ${c.name} — could not parse Breezy IDs from resumeUrl`);
      failed += 1;
      continue;
    }
    try {
      let result = await processCandidate(page, c);
      // If auth slipped between the session check and this fetch, recover once.
      if (result.authFailed) {
        log("session lost mid-run, re-signing in…");
        loggedInAt = 0;
        await ensureSession();
        result = await processCandidate(page, c);
      }
      if (result.err) {
        log(`FAIL ${c.name} — ${result.err}`);
        failed += 1;
        continue;
      }
      if (!result.isPdf) {
        log(`FAIL ${c.name} — not a PDF`);
        failed += 1;
        continue;
      }
      await uploadResume(c.id, Buffer.from(result.bytes));
      uploaded += 1;
    } catch (err) {
      log(`FAIL ${c.name} — ${err instanceof Error ? err.message : String(err)}`);
      failed += 1;
    }
  }
  log(`run done — ${uploaded} uploaded, ${failed} failed`);
  return { uploaded, failed };
}

async function main() {
  log(`worker starting — every ${INTERVAL_SEC}s, limit ${LIMIT_PER_RUN}/run, session ttl ${SESSION_TTL_MS / 3600000}h`);
  for (;;) {
    try {
      await runOnce();
    } catch (err) {
      log(`run failed — ${err instanceof Error ? err.message : String(err)}`);
      // Force a fresh session next time around.
      if (browser) {
        try { await browser.close(); } catch { /* ignore */ }
        browser = null; ctx = null; page = null; loggedInAt = 0;
      }
    }
    await new Promise((r) => setTimeout(r, INTERVAL_SEC * 1000));
  }
}

main();
