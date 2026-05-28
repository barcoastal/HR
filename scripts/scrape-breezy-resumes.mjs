#!/usr/bin/env node
/**
 * Bulk-scrape Breezy resumes that our API can't fetch (403 on /resume),
 * and upload each into our platform.
 *
 * Setup (one-time):
 *   npm install --no-save playwright
 *   npx playwright install chromium
 *
 * Run:
 *   BREEZY_EMAIL='bar@coastaldebt.com' \
 *   BREEZY_PASSWORD='your-breezy-password' \
 *   CRON_SECRET='7bef9265de5ebbe161384f5eac6e78338ed53514af90f42e7e9729835ced9f07' \
 *   APP_URL='https://hr.coastaldebt-tools.com' \
 *   node scripts/scrape-breezy-resumes.mjs
 *
 * Optional flags:
 *   HEADED=1          show the browser so you can watch it work the first time
 *   LIMIT=5           only process the first N candidates (good for a dry run)
 *   SLOWMO=200        slow each browser action by this many ms when HEADED=1
 */

import { chromium } from "playwright";

const { BREEZY_EMAIL, BREEZY_PASSWORD, CRON_SECRET, APP_URL } = process.env;
const HEADED = process.env.HEADED === "1";
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : Infinity;
const SLOWMO = process.env.SLOWMO ? parseInt(process.env.SLOWMO, 10) : 0;

if (!BREEZY_EMAIL || !BREEZY_PASSWORD || !CRON_SECRET || !APP_URL) {
  console.error("Missing required env vars. Need: BREEZY_EMAIL, BREEZY_PASSWORD, CRON_SECRET, APP_URL");
  process.exit(1);
}

function log(msg) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

async function fetchPending() {
  const url = `${APP_URL}/api/cron/breezy-pending-resumes?secret=${CRON_SECRET}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch pending list: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function uploadResume(candidateId, buffer) {
  const url = `${APP_URL}/api/cron/attach-resume?secret=${CRON_SECRET}&candidateId=${candidateId}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/pdf" },
    body: buffer,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`upload failed ${res.status}: ${data.error || ""}`);
  return data;
}

async function main() {
  log(`Fetching pending list from ${APP_URL}…`);
  const { total, candidates } = await fetchPending();
  log(`${total} candidates with raw Breezy URLs. Processing up to ${Math.min(total, LIMIT)}.`);

  const work = candidates.slice(0, LIMIT);
  if (work.length === 0) {
    log("Nothing to do.");
    return;
  }

  log(`Launching ${HEADED ? "headed" : "headless"} Chromium…`);
  const browser = await chromium.launch({ headless: !HEADED, slowMo: SLOWMO });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  log("Signing in to Breezy…");
  await page.goto("https://app.breezy.hr/signin", { waitUntil: "domcontentloaded" });
  // The SPA renders the form client-side — wait for inputs to exist.
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 15000 });
  await page.fill('input[type="email"], input[name="email"]', BREEZY_EMAIL);
  await page.fill('input[type="password"], input[name="password"]', BREEZY_PASSWORD);
  // Submit button is typically the only submit in the form.
  await page.click('button[type="submit"], button:has-text("Sign In"), button:has-text("Sign in")');
  // Wait for the post-login redirect to the dashboard.
  await page.waitForURL((u) => !u.toString().includes("/signin"), { timeout: 30000 });
  log("Signed in.");

  let succeeded = 0;
  let failed = 0;
  for (let i = 0; i < work.length; i++) {
    const c = work[i];
    const label = `${i + 1}/${work.length} ${c.name} <${c.email}>`;
    try {
      if (!c.breezyCompanyId || !c.breezyPositionId || !c.breezyCandidateId) {
        log(`SKIP ${label} — could not parse Breezy IDs from resumeUrl`);
        failed += 1;
        continue;
      }
      // Navigate to the candidate's profile page in Breezy. Even if the deep
      // URL differs from this, the SPA's runtime will resolve and load the
      // correct candidate context once cookies + token are in place.
      const candUrl = `https://app.breezy.hr/coastaldebt/positions/${c.breezyPositionId}/candidates/${c.breezyCandidateId}`;
      await page.goto(candUrl, { waitUntil: "domcontentloaded" });

      // Two ways the SPA exposes the resume:
      //   (a) explicit download link / button — click it and capture the download
      //   (b) an embedded preview pointing at a signed URL — find the iframe / link
      //
      // Try (a) first via the most common copies of the button label.
      const downloadSelectors = [
        'a:has-text("Download Resume")',
        'button:has-text("Download Resume")',
        'a:has-text("Download")',
        'button:has-text("Download")',
        'a[download][href*="resume"]',
        'a[href*="resume"][href*="key="]',
      ];
      let downloaded = null;
      for (const sel of downloadSelectors) {
        const el = await page.$(sel);
        if (!el) continue;
        try {
          const [download] = await Promise.all([
            page.waitForEvent("download", { timeout: 8000 }),
            el.click({ button: "left" }),
          ]);
          const stream = await download.createReadStream();
          const chunks = [];
          for await (const chunk of stream) chunks.push(chunk);
          const buf = Buffer.concat(chunks);
          if (buf.length >= 100 && buf[0] === 0x25 && buf[1] === 0x50) {
            downloaded = buf;
            break;
          }
        } catch {
          // Try the next selector
        }
      }

      // Fallback (b): scrape any pdf-looking href off the rendered DOM and
      // pull it through the page's auth context.
      if (!downloaded) {
        const hrefs = await page.$$eval('a[href*=".pdf"], iframe[src*=".pdf"], a[href*="/resume"]', (els) =>
          els.map((el) => el.getAttribute("href") || el.getAttribute("src")).filter(Boolean)
        );
        for (const raw of hrefs) {
          const absolute = raw.startsWith("http") ? raw : new URL(raw, "https://app.breezy.hr").toString();
          try {
            const buf = await page.evaluate(async (u) => {
              const r = await fetch(u, { credentials: "include" });
              if (!r.ok) return null;
              const ab = await r.arrayBuffer();
              return Array.from(new Uint8Array(ab));
            }, absolute);
            if (buf && buf.length >= 100 && buf[0] === 0x25 && buf[1] === 0x50) {
              downloaded = Buffer.from(buf);
              break;
            }
          } catch {
            // Try the next candidate href
          }
        }
      }

      if (!downloaded) {
        log(`FAIL ${label} — could not find a downloadable resume on the page`);
        failed += 1;
        continue;
      }

      const up = await uploadResume(c.id, downloaded);
      log(`OK   ${label} — ${up.size} bytes uploaded`);
      succeeded += 1;
    } catch (err) {
      log(`FAIL ${label} — ${err instanceof Error ? err.message : String(err)}`);
      failed += 1;
    }
  }

  log(`Done. ${succeeded} uploaded, ${failed} failed.`);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
