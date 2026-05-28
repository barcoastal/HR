# Breezy resume scraper — Railway worker

A standalone Railway service that pulls Breezy resumes the main app's
`/v3` API can't fetch (403 `getResumeUnauthorized`) and uploads them
into the platform's FileBlob storage.

Why a separate service: Playwright + Chromium need system libraries
the main Next.js Nixpacks container doesn't have. Putting it in its
own Docker-based service (Playwright's official image) is cleaner
than rebuilding the main app's container.

## Railway setup (one-time)

1. Railway → existing project → **New Service** → **GitHub Repo**, point
   at the same repo as the main app.
2. **Settings → Source → Root Directory** = `breezy-scraper`.
3. **Settings → Build** → Builder = **Dockerfile** (Railway auto-detects).
4. **Variables tab**, add:
   - `BREEZY_EMAIL` = `bar@coastaldebt.com`
   - `BREEZY_PASSWORD` = current Breezy password
   - `CRON_SECRET` = same value the main app uses
   - `APP_URL` = `https://hr.coastaldebt-tools.com`
   - (Optional) `INTERVAL_SEC` = `300` (default 5 min)
   - (Optional) `LIMIT_PER_RUN` = `50`
5. Deploy. Watch **Logs** — you should see `worker starting` then every
   5 min a `processing N of M pending` (or `nothing to do`).

The worker is a long-running loop; no Railway cron service needed.

## Local test

```bash
cd breezy-scraper
npm install
BREEZY_EMAIL=... BREEZY_PASSWORD=... \
  CRON_SECRET=... APP_URL=https://hr.coastaldebt-tools.com \
  INTERVAL_SEC=300 \
  node scraper.mjs
```
