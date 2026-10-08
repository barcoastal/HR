import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fileBlob: { findUnique: vi.fn(), findMany: vi.fn() },
  document: { findFirst: vi.fn(), create: vi.fn() },
  employee: { findUnique: vi.fn() },
  candidate: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
}));
vi.mock("@/lib/db", () => ({
  db: {
    fileBlob: mocks.fileBlob,
    document: mocks.document,
    employee: mocks.employee,
    candidate: mocks.candidate,
  },
}));

import {
  attachCandidateResumeToEmployee,
  attachResumeFromMatchingCandidate,
  listResumeCandidates,
} from "@/lib/hire-resume";

const EMPLOYEE = {
  id: "emp-1",
  email: "alex@coastaldebt.com",
  personalEmail: null,
  firstName: "Alex",
  lastName: "Hire",
  preferredName: null,
};

function candidateRow(id: string, over: Partial<{ resumeUrl: string | null; email: string; firstName: string }> = {}) {
  return {
    id,
    firstName: over.firstName ?? "Alex",
    lastName: "Hire",
    email: over.email ?? `${id}@gmail.com`,
    resumeUrl: "resumeUrl" in over ? over.resumeUrl : `/api/resumes/${id}`,
    appliedAt: new Date("2025-08-01T00:00:00Z"),
    position: { title: "Retention Specialist" },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.fileBlob.findUnique.mockResolvedValue(null);
  mocks.fileBlob.findMany.mockResolvedValue([]);
  mocks.document.findFirst.mockResolvedValue(null);
  mocks.document.create.mockResolvedValue({ id: "doc-1" });
  mocks.candidate.findFirst.mockResolvedValue(null);
  mocks.candidate.findMany.mockResolvedValue([]);
});

describe("attachCandidateResumeToEmployee", () => {
  it("creates an HR-only Document pointing at the candidate resume URL", async () => {
    const result = await attachCandidateResumeToEmployee({
      employeeId: "emp-1",
      candidateId: "cand-1",
      firstName: "Alex",
      lastName: "Hire",
      resumeUrl: "/api/resumes/cand-1",
    });

    expect(result).toEqual({ attached: true, url: "/api/resumes/cand-1" });
    expect(mocks.document.create).toHaveBeenCalledWith({
      data: {
        employeeId: "emp-1",
        name: "Resume — Alex Hire",
        url: "/api/resumes/cand-1",
        category: "GENERAL",
        visibility: "HR_ONLY",
      },
    });
  });

  it("falls back to the local resume FileBlob when only an external ATS URL exists", async () => {
    mocks.fileBlob.findUnique.mockResolvedValue({ filename: "resume-cand-1.pdf" });

    const result = await attachCandidateResumeToEmployee({
      employeeId: "emp-1",
      candidateId: "cand-1",
      firstName: "Alex",
      lastName: "Hire",
      resumeUrl: "https://breezy.hr/files/xyz",
    });

    expect(result.attached).toBe(true);
    expect(result.url).toBe("/api/resumes/cand-1");
  });

  it("does not attach twice", async () => {
    mocks.document.findFirst.mockResolvedValue({ id: "existing" });

    const result = await attachCandidateResumeToEmployee({
      employeeId: "emp-1",
      candidateId: "cand-1",
      firstName: "Alex",
      lastName: "Hire",
      resumeUrl: "/api/resumes/cand-1",
    });

    expect(result.attached).toBe(false);
    expect(mocks.document.create).not.toHaveBeenCalled();
  });
});

describe("attachResumeFromMatchingCandidate", () => {
  it("matches the employee email to a candidate and attaches the resume", async () => {
    mocks.employee.findUnique.mockResolvedValue({
      id: "emp-1",
      email: "alex@coastaldebt.com",
      personalEmail: "alex.personal@example.com",
      firstName: "Alex",
      lastName: "Hire",
    });
    mocks.candidate.findFirst.mockResolvedValue({
      id: "cand-1",
      firstName: "Alex",
      lastName: "Hire",
      resumeUrl: "/api/resumes/cand-1",
    });

    const result = await attachResumeFromMatchingCandidate("emp-1");

    expect(result).toEqual({ attached: true });
    expect(mocks.candidate.findFirst).toHaveBeenCalled();
    expect(mocks.document.create).toHaveBeenCalled();
  });

  it("falls back to the one candidate with the same name and a resume when no email matches", async () => {
    mocks.employee.findUnique.mockResolvedValue(EMPLOYEE);
    mocks.candidate.findMany.mockResolvedValue([candidateRow("cand-name")]);

    const result = await attachResumeFromMatchingCandidate("emp-1");

    expect(result).toEqual({ attached: true });
    expect(mocks.candidate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ lastName: { equals: "Hire", mode: "insensitive" } }),
      })
    );
    expect(mocks.document.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ url: "/api/resumes/cand-name" }) })
    );
  });

  it("hands back the candidates to choose from when several share the name", async () => {
    mocks.employee.findUnique.mockResolvedValue(EMPLOYEE);
    mocks.candidate.findMany.mockResolvedValue([candidateRow("cand-a"), candidateRow("cand-b")]);

    const result = await attachResumeFromMatchingCandidate("emp-1");

    expect(result.attached).toBe(false);
    if (result.attached) throw new Error("unreachable");
    expect(result.reason).toBe("Several candidates share this name");
    expect(result.candidates?.map((c) => [c.id, c.hasResume, c.matchedBy])).toEqual([
      ["cand-a", true, "name"],
      ["cand-b", true, "name"],
    ]);
    expect(mocks.document.create).not.toHaveBeenCalled();
  });

  it("reports no match, with an empty list, when nobody shares the name either", async () => {
    mocks.employee.findUnique.mockResolvedValue(EMPLOYEE);

    const result = await attachResumeFromMatchingCandidate("emp-1");

    expect(result).toEqual({ attached: false, reason: "No matching candidate", candidates: [] });
  });

  it("uses the candidate HR picked without matching", async () => {
    mocks.employee.findUnique.mockResolvedValue(EMPLOYEE);
    mocks.candidate.findUnique.mockResolvedValue({
      id: "cand-picked",
      firstName: "Alexandra",
      lastName: "Hire",
      resumeUrl: "/api/resumes/cand-picked",
    });

    const result = await attachResumeFromMatchingCandidate("emp-1", "cand-picked");

    expect(result).toEqual({ attached: true });
    expect(mocks.candidate.findFirst).not.toHaveBeenCalled();
    expect(mocks.candidate.findMany).not.toHaveBeenCalled();
    expect(mocks.document.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: "Resume — Alexandra Hire" }) })
    );
  });
});

describe("listResumeCandidates", () => {
  it("lists same-name candidates and marks a FileBlob-only resume as present", async () => {
    mocks.employee.findUnique.mockResolvedValue(EMPLOYEE);
    mocks.candidate.findMany.mockResolvedValue([
      candidateRow("cand-blob", { resumeUrl: null }),
      candidateRow("cand-none", { resumeUrl: null }),
    ]);
    mocks.fileBlob.findMany.mockResolvedValue([{ filename: "resume-cand-blob.pdf" }]);

    const rows = await listResumeCandidates("emp-1");

    expect(rows.map((c) => [c.id, c.hasResume])).toEqual([
      ["cand-blob", true],
      ["cand-none", false],
    ]);
    expect(rows[0].positionTitle).toBe("Retention Specialist");
  });

  it("searches first and last name when the query has two words", async () => {
    mocks.candidate.findMany.mockResolvedValue([candidateRow("cand-s", { firstName: "Sandra" })]);

    const rows = await listResumeCandidates("emp-1", "sandra hire");

    expect(rows.map((c) => c.matchedBy)).toEqual(["search"]);
    expect(mocks.candidate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { firstName: { contains: "sandra", mode: "insensitive" } },
            { lastName: { contains: "hire", mode: "insensitive" } },
          ],
        },
        take: 20,
      })
    );
    expect(mocks.employee.findUnique).not.toHaveBeenCalled();
  });
});

