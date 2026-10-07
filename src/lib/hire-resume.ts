import { db } from "@/lib/db";

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

/**
 * For people hired before resume copy existed: find a HIRED (or any) candidate
 * matching work/personal email and attach their resume if present.
 */
export async function attachResumeFromMatchingCandidate(employeeId: string): Promise<{
  attached: boolean;
  reason?: string;
}> {
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, email: true, personalEmail: true, firstName: true, lastName: true },
  });
  if (!employee) return { attached: false, reason: "Employee not found" };

  const emails = [employee.email, employee.personalEmail]
    .map((e) => e?.trim().toLowerCase())
    .filter((e): e is string => Boolean(e));
  if (emails.length === 0) return { attached: false, reason: "No email on employee" };

  const candidate = await db.candidate.findFirst({
    where: {
      OR: emails.map((email) => ({ email: { equals: email, mode: "insensitive" as const } })),
    },
    orderBy: [{ hiredAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, firstName: true, lastName: true, resumeUrl: true },
  });
  if (!candidate) return { attached: false, reason: "No matching candidate" };

  const result = await attachCandidateResumeToEmployee({
    employeeId: employee.id,
    candidateId: candidate.id,
    firstName: candidate.firstName || employee.firstName,
    lastName: candidate.lastName || employee.lastName,
    resumeUrl: candidate.resumeUrl,
  });
  return result.attached
    ? { attached: true }
    : { attached: false, reason: result.url ? "Resume already on file" : "Candidate has no resume" };
}
