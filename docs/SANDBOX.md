# Sandbox environment

A separate deployment of the HR platform where the team can test everything
without touching production data or sending anything real. Controlled by one
env var: `SANDBOX_MODE=1`.

## What sandbox mode changes

| Area | Behavior in sandbox |
|---|---|
| Emails (Resend) | Suppressed and logged, nothing is sent |
| Breezy job posting | Simulated success, nothing posted to job boards |
| Google Calendar | Interview / 1:1 events simulated with a fake Meet link |
| Background checks | Simulated order, backgroundchecks.com is never called |
| Banner | Amber "SANDBOX ENVIRONMENT" strip on every page |
| `/api/sandbox/reset` | Enabled (hard 404 on production) |

## Demo logins (credentials form on /login)

| Username | Role |
|---|---|
| `admin` | SUPER_ADMIN |
| `hr` | HR (also configured as recruiter) |
| `manager` | MANAGER |
| `employee` | EMPLOYEE |

Password for all: `sandbox123`

## Railway setup (one-time)

1. Railway → the HR project → **New Service → GitHub Repo** → same repo
   (`barcoastal/HR`), branch `main`.
2. **New → Database → PostgreSQL** in the same project for the sandbox DB.
3. Sandbox service → Variables:
   - `SANDBOX_MODE` = `1`
   - `DATABASE_URL` = the new sandbox Postgres URL (never the prod one!)
   - `NEXTAUTH_SECRET` = any random string (`openssl rand -hex 32`)
   - `NEXTAUTH_URL` = the sandbox service URL (e.g. `https://hr-sandbox-production.up.railway.app`)
   - `CRON_SECRET` = same value as prod (or a new one)
   - Do NOT set `RESEND_API_KEY`, `BACKGROUND_CHECK_API_KEY`, or Google
     OAuth vars — they are unnecessary, and their absence is a second
     safety net.
4. Deploy. The start command runs `prisma db push`, creating the schema.
5. Seed the demo data:
   `curl "https://<sandbox-url>/api/sandbox/reset?secret=<CRON_SECRET>"`
6. Optional nightly reset: add a cron service (image `curlimages/curl`,
   schedule `0 6 * * *`) running the same curl command.

## Resetting after a messy test session

Hit the same URL again — it wipes everything and reseeds:

```
curl "https://<sandbox-url>/api/sandbox/reset?secret=<CRON_SECRET>"
```

## Seeded data

4 departments, 7 employees (including one mid-onboarding and one in
pre-onboarding), 4 positions (3 open), 14 candidates spread across every
pipeline stage, 2 upcoming video interviews, onboarding + pre-onboarding
checklists, and the 4 demo users above.
