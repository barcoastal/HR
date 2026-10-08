# CALATRAVA data recovery and risk summary

_Last reviewed 2026-10-08._

## What the system is made of

| Part | Where it lives | Backed up by |
| --- | --- | --- |
| HRIS database (people, candidates, documents, signatures, settings) | Railway project **HR** → service **Postgres** → volume `postgres-volume` | Railway volume backups |
| Resumes downloaded from job boards | Railway service **HR** → volume `hr-volume` (`/app/data/resumes`) | Railway volume backups |
| Uploaded files (signed documents, employee documents, resume uploads) | Inside the database (`FileBlob` table) | Covered by the database backup |
| Application code | GitHub `barcoastal/HR`, branch `main` | GitHub; any commit can be redeployed |
| Sandbox database | Railway service **Postgres-Xfsk** | Not needed for recovery (demo data) |

## Backup schedule

Railway takes **daily, weekly and monthly** snapshots of both volumes. Each schedule keeps its
snapshots for Railway's retention window; see the current windows and the newest snapshot with:

```
python3 scripts/railway-backups.py status
```

If the schedules ever show `NONE`, re-enable them with `python3 scripts/railway-backups.py enable`.
Backups are also visible in the Railway dashboard: project HR → the service → its volume → **Backups**.

## How a restore works

Restores are done by engineering, not from inside the HRIS.

1. Railway dashboard → project HR → service Postgres (or HR for resumes) → volume → **Backups**.
2. Pick the snapshot closest to the point in time you want. **Restore** creates a fresh volume
   from it; Railway attaches it to the service and redeploys.
3. For the database, confirm the app comes up and spot-check a few recent records.
4. If both the database and the resumes need restoring, restore the database first.

Recovery point: at worst the last daily snapshot, so up to 24 hours of changes could be lost.
Recovery time: under an hour for a full restore.

## What HR can do without engineering

- **Data → Export** produces a CSV or Excel copy of people or candidate data with chosen columns.
  Keeping a periodic export in the HR shared drive is a cheap second copy.
- Signed documents can be downloaded from each person's profile.

## Known risks

- **Single provider, single region.** Database and backups both live in Railway's `us-west2`.
  A Railway-wide outage affects the app and the backups together. An off-platform copy
  (for example a weekly database dump to the company Google Drive) would close this gap.
- **Deploys apply schema changes automatically.** The start script runs `prisma db push
  --accept-data-loss` on every deploy to `main`. A mistaken schema change can drop a column
  in production. Daily snapshots are the safety net; review schema changes before pushing.
- **Avi agent volume** (`avi-hr-agent-volume`) holds the Slack assistant's working data and is not
  backed up. It can be rebuilt; nothing HR-owned lives there.
- **Access.** Backups and restores need a Railway login on the HR project. Today that is the
  engineering owner; a second person should have access so a restore never waits on one person.

## Owner

Engineering (Mendel). HR requests a restore by message; no console access is needed.
