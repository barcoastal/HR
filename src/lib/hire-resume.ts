import { db } from "@/lib/db";

/** A candidate record HR can copy a resume from, as shown in the picker. */
export type ResumeCandidate = {
  id: string;
  name: string;
  email: string;
  /** ISO date the candidate applied. */
  appliedAt: string;
  positionTitle: string | null;
  hasResume: boolean;
  matchedBy: "email" | "name" | "search";
};

export type PullResumeResult =
  | { attached: true }
  | { attached: false; reason: string; candidates?: ResumeCandidate[] };

const CANDIDATE_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  resumeUrl: true,
  appliedAt: true,
  position: { select: { title: true } },
} as const;

type CandidateRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  resumeUrl: string | null;
  appliedAt: Date;
  position: { title: string } | null;
};

/**
 * After hire, HR looks at the People profile — not the candidate card.
 * Copy a Document row pointing at the candidate resume so it stays visible.
 * Does not duplicate the PDF blob; reuses the existing resume URL.
 */
export async function attachCandidateResumeToEmployee(opts: {
  employeeId: string;
  candidateId: string;
  firstName: string;
  lastName: string;
  resumeUrl?: string | null;
}): Promise<{ attached: boolean; url?: string }> {
  const { employeeId, candidateId, firstName, lastName } = opts;
  let resumeUrl = opts.resumeUrl?.trim() || null;

  // Prefer a local FileBlob resume when the candidate only has an external ATS link.
  if (!resumeUrl || !resumeUrl.startsWith("/api/")) {
    const localBlob = await db.fileBlob.findUnique({
      where: { filename: `resume-${candidateId}.pdf` },
      select: { filename: true },
    });
    if (localBlob) {
      resumeUrl = `/api/resumes/${candidateId}`;
    } else if (!resumeUrl) {
      return { attached: false };
    }
  }

  const existing = await db.document.findFirst({
    where: {
      employeeId,
      OR: [
        { url: resumeUrl },
        { name: { startsWith: "Resume" }, category: "GENERAL" },
      ],
    },
    select: { id: true },
  });
  if (existing) return { attached: false, url: resumeUrl };

  await db.document.create({
    data: {
      employeeId,
      name: `Resume — ${firstName} ${lastName}`,
      url: resumeUrl,
      category: "GENERAL",
      visibility: "HR_ONLY",
    },
  });

  return { attached: true, url: resumeUrl };
}

/** Marks which rows have a resume: a stored URL, or a PDF kept in FileBlob for that candidate. */
async function describe(rows: CandidateRow[], matchedBy: ResumeCandidate["matchedBy"]): Promise<ResumeCandidate[]> {
  const unsure = rows.filter((r) => !r.resumeUrl?.trim());
  const blobs = unsure.length
    ? await db.fileBlob.findMany({
        where: { filename: { in: unsure.map((r) => `resume-${r.id}.pdf`) } },
        select: { filename: true },
      })
    : [];
  const local = new Set(blobs.map((b) => b.filename));
  return rows.map((r) => ({
    id: r.id,
    name: `${r.firstName} ${r.lastName}`.trim(),
    email: r.email,
    appliedAt: r.appliedAt.toISOString(),
    positionTitle: r.position?.title ?? null,
    hasResume: Boolean(r.resumeUrl?.trim()) || local.has(`resume-${r.id}.pdf`),
    matchedBy,
  }));
}

type EmployeeNames = { firstName: string; lastName: string; preferredName?: string | null };

/** Candidates whose first (or preferred) and last name equal the employee's, newest hire first. */
async function candidatesNamedLike(employee: EmployeeNames): Promise<CandidateRow[]> {
  const last = employee.lastName.trim();
  const firsts = Array.from(
    new Set([employee.firstName, employee.preferredName].map((s) => s?.trim()).filter((s): s is string => Boolean(s)))
  );
  if (!last || firsts.length === 0) return [];
  return db.candidate.findMany({
    where: {
      lastName: { equals: last, mode: "insensitive" },
      OR: firsts.map((first) => ({ firstName: { equals: first, mode: "insensitive" as const } })),
    },
    orderBy: [{ hiredAt: "desc" }, { appliedAt: "desc" }],
    select: CANDIDATE_SELECT,
  });
}

/**
 * Candidates HR can pick a resume from. With a query, searches by name or email;
 * without one, lists the candidates that share the employee's name.
 */
export async function listResumeCandidates(employeeId: string, query = ""): Promise<ResumeCandidate[]> {
  const q = query.trim();
  if (q) {
    const words = q.split(/\s+/);
    const mode = "insensitive" as const;
    const where =
      words.length >= 2
        ? {
            AND: [
              { firstName: { contains: words[0], mode } },
              { lastName: { contains: words.slice(1).join(" "), mode } },
            ],
          }
        : {
            OR: [
              { firstName: { contains: q, mode } },
              { lastName: { contains: q, mode } },
              { email: { contains: q, mode } },
            ],
          };
    const rows = await db.candidate.findMany({
      where,
      orderBy: [{ appliedAt: "desc" }],
      take: 20,
      select: CANDIDATE_SELECT,
    });
    return describe(rows, "search");
  }

  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: { firstName: true, lastName: true, preferredName: true },
  });
  if (!employee) return [];
  return describe(await candidatesNamedLike(employee), "name");
}

/**
 * For people hired before resume copy existed. HR can name the candidate record
 * outright; otherwise match on work/personal email, then on an exact name when
 * only one such candidate has a resume. Anything less certain comes back as a
 * list for HR to choose from.
 */
export async function attachResumeFromMatchingCandidate(
  employeeId: string,
  candidateId?: string
): Promise<PullResumeResult> {
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, email: true, personalEmail: true, firstName: true, lastName: true, preferredName: true },
  });
  if (!employee) return { attached: false, reason: "Employee not found" };

  let candidate: { id: string; firstName: string; lastName: string; resumeUrl: string | null } | null = null;

  if (candidateId) {
    candidate = await db.candidate.findUnique({
      where: { id: candidateId },
      select: { id: true, firstName: true, lastName: true, resumeUrl: true },
    });
    if (!candidate) return { attached: false, reason: "Candidate not found" };
  } else {
    const emails = [employee.email, employee.personalEmail]
      .map((e) => e?.trim().toLowerCase())
      .filter((e): e is string => Boolean(e));
    if (emails.length > 0) {
      candidate = await db.candidate.findFirst({
        where: {
          OR: emails.map((email) => ({ email: { equals: email, mode: "insensitive" as const } })),
        },
        orderBy: [{ hiredAt: "desc" }, { createdAt: "desc" }],
        select: { id: true, firstName: true, lastName: true, resumeUrl: true },
      });
    }

    if (!candidate) {
      const rows = await candidatesNamedLike(employee);
      const named = await describe(rows, "name");
      const withResume = named.filter((c) => c.hasResume);
      if (named.length === 0) {
        return { attached: false, reason: "No matching candidate", candidates: [] };
      }
      if (withResume.length !== 1) {
        return {
          attached: false,
          reason:
            withResume.length === 0
              ? "The candidate records with this name have no resume"
              : "Several candidates share this name",
          candidates: named,
        };
      }
      const row = rows.find((r) => r.id === withResume[0].id)!;
      candidate = { id: row.id, firstName: row.firstName, lastName: row.lastName, resumeUrl: row.resumeUrl };
    }
  }

  const result = await attachCandidateResumeToEmployee({
    employeeId: employee.id,
    candidateId: candidate.id,
    firstName: candidate.firstName || employee.firstName,
    lastName: candidate.lastName || employee.lastName,
    resumeUrl: candidate.resumeUrl,
  });
  return result.attached
    ? { attached: true }
    : { attached: false, reason: result.url ? "Resume already on file" : "Candidate has no resume", candidates: [] };
}
