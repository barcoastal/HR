import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fileBlob: { findUnique: vi.fn() },
  document: { findFirst: vi.fn(), create: vi.fn() },
  employee: { findUnique: vi.fn() },
  candidate: { findFirst: vi.fn() },
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
} from "@/lib/hire-resume";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.fileBlob.findUnique.mockResolvedValue(null);
  mocks.document.findFirst.mockResolvedValue(null);
  mocks.document.create.mockResolvedValue({ id: "doc-1" });
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
});
