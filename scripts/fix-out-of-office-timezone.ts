/**
 * One-off: out-of-office entries created before the company-time-zone fix were stored as
 * UTC wall-clock ("Aug 5 00:00Z"), which now renders as Aug 4 8 PM Eastern. This re-interprets
 * the stored UTC wall-clock as company-zone wall-clock for rows created before the cutoff.
 *
 * Dry run (prints what would change):
 *   DATABASE_URL=... npx tsx --tsconfig tsconfig.json scripts/fix-out-of-office-timezone.ts 2026-08-28T20:00:00Z
 * Apply:
 *   DATABASE_URL=... npx tsx --tsconfig tsconfig.json scripts/fix-out-of-office-timezone.ts 2026-08-28T20:00:00Z --apply
 *
 * Use the deploy time of the calendar fix as the cutoff so rows created afterwards (already
 * correct) are left alone. Safe to re-run: rows are only touched once because the cutoff never moves.
 */
import { db } from "@/lib/db";
import { zonedDate, COMPANY_TIME_ZONE } from "@/lib/time-zone";

function reinterpret(utcWallClock: Date): Date {
  const shifted = zonedDate(
    utcWallClock.getUTCFullYear(),
    utcWallClock.getUTCMonth(),
    utcWallClock.getUTCDate(),
    utcWallClock.getUTCHours(),
    utcWallClock.getUTCMinutes(),
  );
  return new Date(shifted.getTime() + utcWallClock.getUTCSeconds() * 1000 + utcWallClock.getUTCMilliseconds());
}

async function main() {
  const [cutoffArg, flag] = process.argv.slice(2);
  const cutoff = cutoffArg ? new Date(cutoffArg) : null;
  if (!cutoff || Number.isNaN(cutoff.getTime())) {
    console.error("Usage: fix-out-of-office-timezone.ts <cutoff ISO datetime> [--apply]");
    process.exit(1);
  }
  const apply = flag === "--apply";
  const rows = await db.outOfOffice.findMany({
    where: { createdAt: { lt: cutoff } },
    select: { id: true, startDate: true, endDate: true, createdAt: true, employee: { select: { firstName: true, lastName: true } } },
    orderBy: { startDate: "asc" },
  });
  console.log(`${rows.length} out-of-office row(s) created before ${cutoff.toISOString()} — zone ${COMPANY_TIME_ZONE} — ${apply ? "APPLYING" : "dry run"}`);
  for (const r of rows) {
    const start = reinterpret(r.startDate);
    const end = reinterpret(r.endDate);
    console.log(`${r.employee.firstName} ${r.employee.lastName}: ${r.startDate.toISOString()} → ${start.toISOString()} | ${r.endDate.toISOString()} → ${end.toISOString()}`);
    if (apply) await db.outOfOffice.update({ where: { id: r.id }, data: { startDate: start, endDate: end } });
  }
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
