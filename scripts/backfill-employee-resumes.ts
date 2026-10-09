/**
 * One-off: hires made before 2026-10-06 never had their applicant resume copied onto the
 * People profile (the copy-at-hire step shipped that day). For every active employee with
 * no resume document, apply the same matching the Pull resume button uses: work or personal
 * email first, then an exact name when exactly one such candidate has a resume. Anyone
 * ambiguous is left for HR to pick in the app and reported here as a count.
 *
 * Dry run (changes nothing):
 *   DATABASE_URL=... npx tsx --tsconfig tsconfig.json scripts/backfill-employee-resumes.ts
 * Apply:
 *   DATABASE_URL=... npx tsx --tsconfig tsconfig.json scripts/backfill-employee-resumes.ts --apply
 *
 * Safe to re-run: employees that already have a resume document are skipped. Each attachment
 * is written to the audit log as document.resume_pulled_from_candidate with backfill: true.
 */
import { db } from "@/lib/db";
import { attachCandidateResumeToEmployee, findResumeCandidate } from "@/lib/hire-resume";

const ACTOR = "backfill-employee-resumes script";

async function main() {
  const apply = process.argv.includes("--apply");

  const employees = await db.employee.findMany({
    where: {
      status: { not: "OFFBOARDED" },
      documents: {
        none: { OR: [{ name: { startsWith: "Resume", mode: "insensitive" } }, { url: { contains: "/api/resumes/" } }] },
      },
    },
    select: { id: true, firstName: true, lastName: true, preferredName: true, email: true, personalEmail: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  console.log(`${employees.length} active employee(s) without a resume document — ${apply ? "APPLYING" : "dry run"}`);

  const tally = { attached: 0, noResume: 0, noCandidate: 0, ambiguous: 0 };
  for (const e of employees) {
    const label = `${e.firstName.charAt(0)}. ${e.lastName}`;
    const match = await findResumeCandidate(e);
    if (!match.found) {
      if (match.candidates.length === 0) tally.noCandidate++;
      else tally.ambiguous++;
      console.log(`  ${label}: ${match.reason}${match.candidates.length ? ` (${match.candidates.length} to pick from in the app)` : ""}`);
      continue;
    }
    const c = match.candidate;
    if (!apply) {
      // Mirror the attach rules without writing: a resume URL, or a stored PDF for that candidate.
      const stored = c.resumeUrl?.trim()
        ? true
        : Boolean(await db.fileBlob.findUnique({ where: { filename: `resume-${c.id}.pdf` }, select: { filename: true } }));
      if (stored) tally.attached++;
      else tally.noResume++;
      console.log(`  ${label}: would attach (matched by ${match.matchedBy})${stored ? "" : " — but the candidate has no resume"}`);
      continue;
    }
    const result = await attachCandidateResumeToEmployee({
      employeeId: e.id,
      candidateId: c.id,
      firstName: c.firstName || e.firstName,
      lastName: c.lastName || e.lastName,
      resumeUrl: c.resumeUrl,
    });
    if (!result.attached) {
      tally.noResume++;
      console.log(`  ${label}: matched by ${match.matchedBy} but ${result.url ? "a resume is already on file" : "the candidate has no resume"}`);
      continue;
    }
    tally.attached++;
    await db.auditLog.create({
      data: {
        actorEmail: ACTOR,
        action: "document.resume_pulled_from_candidate",
        entityType: "employee",
        entityId: e.id,
        details: { candidateId: c.id, matchedBy: match.matchedBy, backfill: true },
      },
    });
    console.log(`  ${label}: attached (matched by ${match.matchedBy})`);
  }

  console.log(
    `\n${apply ? "Attached" : "Would attach"}: ${tally.attached} · candidate has no resume: ${tally.noResume} · ` +
      `no candidate record: ${tally.noCandidate} · several candidates, HR picks in the app: ${tally.ambiguous}`
  );
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
