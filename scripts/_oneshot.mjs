import { chromium } from "playwright";
const { BREEZY_EMAIL, BREEZY_PASSWORD, CRON_SECRET, APP_URL } = process.env;

async function fetchPending() {
  const r = await fetch(`${APP_URL}/api/cron/breezy-pending-resumes?secret=${CRON_SECRET}`);
  return r.json();
}
async function upload(id, buf) {
  const r = await fetch(`${APP_URL}/api/cron/attach-resume?secret=${CRON_SECRET}&candidateId=${id}`, {
    method: "POST", headers: { "Content-Type": "application/pdf" }, body: buf,
  });
  return r.json();
}

const { candidates } = await fetchPending();
console.log(`pending: ${candidates.length}`);
const browser = await chromium.launch({ headless: true, args: ["--disable-blink-features=AutomationControlled"] });
const ctx = await browser.newContext({
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  viewport: { width: 1280, height: 800 }, locale: "en-US", timezoneId: "America/New_York",
});
await ctx.addInitScript(() => { Object.defineProperty(navigator, "webdriver", { get: () => undefined }); });
const page = await ctx.newPage();
await page.goto("https://app.breezy.hr/signin", { waitUntil: "domcontentloaded" });
await page.waitForSelector('input[name="email_address"]');
await page.fill('input[name="email_address"]', BREEZY_EMAIL);
await page.fill('input[name="password"]', BREEZY_PASSWORD);
await page.click('input[type="submit"], button[type="submit"]');
await page.waitForURL(u => !u.toString().includes("/signin"));
await page.waitForTimeout(2000);
console.log("signed in");

let ok = 0, fail = 0;
for (const c of candidates) {
  if (!c.breezyCompanyId || !c.breezyPositionId || !c.breezyCandidateId) {
    console.log(`SKIP ${c.name} — bad URL`); fail++; continue;
  }
  try {
    const result = await page.evaluate(async ({ cid, pid, cnd }) => {
      const dr = await fetch(`https://app.breezy.hr/api/company/${cid}/position/${pid}/candidate/${cnd}`, { credentials: "include" });
      if (!dr.ok) return { err: `detail ${dr.status}` };
      const detail = await dr.json();
      const url = detail?.resume?.pdf_url || detail?.resume?.url;
      if (!url) return { err: "no pdf_url" };
      const pr = await fetch(url, { credentials: "include" });
      if (!pr.ok) return { err: `pdf ${pr.status}` };
      const buf = await pr.arrayBuffer();
      return { bytes: Array.from(new Uint8Array(buf)) };
    }, { cid: c.breezyCompanyId, pid: c.breezyPositionId, cnd: c.breezyCandidateId });
    if (result.err) { console.log(`FAIL ${c.name} — ${result.err}`); fail++; continue; }
    await upload(c.id, Buffer.from(result.bytes));
    ok++;
    if (ok % 20 === 0) console.log(`progress: ${ok} ok, ${fail} fail`);
  } catch (e) { console.log(`FAIL ${c.name} — ${e.message}`); fail++; }
}
console.log(`done: ${ok} ok, ${fail} fail`);
await browser.close();
