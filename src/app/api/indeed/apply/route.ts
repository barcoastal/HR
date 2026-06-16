import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

// Indeed Apply webhook — receives candidate applications from Indeed
// POST /api/indeed/apply
export async function POST(req: NextRequest) {
  const body = await req.text();

  // Verify Indeed signature if secret is configured
  const indeedSecret = process.env.INDEED_APPLY_SECRET;
  if (indeedSecret) {
    const signature = req.headers.get("X-Indeed-Signature") || "";
    const expected = crypto
      .createHmac("sha1", indeedSecret)
      .update(body)
      .digest("hex");

    if (signature !== expected) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let data: IndeedApplication;
  try {
    data = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const applicant = data.applicant;
  if (!applicant?.email) {
    return NextResponse.json({ error: "Missing applicant email" }, { status: 400 });
  }

  try {
    // Do Not Call: silently swallow re-applications from blocked phones/emails.
    const { findDoNotCallMatch } = await import("@/lib/actions/candidate-applications");
    const dnc = await findDoNotCallMatch(applicant.phoneNumber, applicant.email);
    if (dnc) {
      return NextResponse.json({ success: true, candidateId: null, status: "dnc" });
    }

    // Check if candidate already exists
    const existing = await db.candidate.findUnique({
      where: { email: applicant.email },
    });

    if (existing) {
      // Update with Indeed data if they exist
      await db.candidate.update({
        where: { id: existing.id },
        data: {
          source: existing.source || "Indeed",
          notes: existing.notes
            ? `${existing.notes}\n\nRe-applied via Indeed on ${new Date().toISOString()}`
            : `Applied via Indeed on ${new Date().toISOString()}`,
        },
      });
      return NextResponse.json({ success: true, candidateId: existing.id, status: "updated" });
    }

    // Save resume file if provided
    let resumeText: string | null = null;
    if (applicant.resume?.text) {
      resumeText = applicant.resume.text;
    } else if (applicant.resume?.html) {
      // Strip HTML tags for plain text
      resumeText = applicant.resume.html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    }

    // Extract skills from resume JSON if available
    let skills: string[] = [];
    if (applicant.resume?.json?.skills) {
      skills = applicant.resume.json.skills.map(
        (s: { name?: string; raw?: string }) => s.name || s.raw || ""
      ).filter(Boolean);
    }

    // Find matching position by job ID
    let positionId: string | null = null;
    if (data.job?.jobId) {
      const position = await db.position.findUnique({ where: { id: data.job.jobId } });
      if (position) positionId = position.id;
    }

    // Build notes
    const notesParts: string[] = [];
    if (applicant.coverletter) notesParts.push(`Cover Letter:\n${applicant.coverletter}`);
    if (data.job?.jobTitle) notesParts.push(`Applied for: ${data.job.jobTitle}`);

    const candidate = await db.candidate.create({
      data: {
        firstName: applicant.firstName || applicant.fullName?.split(" ")[0] || "Unknown",
        lastName: applicant.lastName || applicant.fullName?.split(" ").slice(1).join(" ") || "",
        email: applicant.email,
        phone: applicant.phoneNumber || null,
        skills: skills.length > 0 ? JSON.stringify(skills) : null,
        resumeText,
        source: "Indeed",
        positionId,
        inPipeline: !!positionId,
        status: positionId ? "NEW" : "NEW",
        notes: notesParts.join("\n\n") || null,
        linkedinUrl: applicant.linkedInProfileUrl || null,
      },
    });

    // Save resume file to storage if base64 data provided
    if (applicant.resume?.file?.data && applicant.resume?.file?.fileName) {
      try {
        const { writeFile, mkdir } = await import("fs/promises");
        const path = await import("path");
        const dir = path.join(process.cwd(), "public", "uploads", "resumes");
        await mkdir(dir, { recursive: true });
        const ext = path.extname(applicant.resume.file.fileName) || ".pdf";
        const filename = `indeed-${candidate.id}${ext}`;
        const buffer = Buffer.from(applicant.resume.file.data, "base64");
        await writeFile(path.join(dir, filename), buffer);

        await db.candidate.update({
          where: { id: candidate.id },
          data: { resumeUrl: `/uploads/resumes/${filename}` },
        });
      } catch {
        // Resume file save failed — candidate is still created
      }
    }

    revalidatePath("/cv");
    return NextResponse.json({ success: true, candidateId: candidate.id, status: "created" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Indeed Apply types
type IndeedApplication = {
  applicant?: {
    fullName?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phoneNumber?: string;
    coverletter?: string;
    linkedInProfileUrl?: string;
    resume?: {
      text?: string;
      html?: string;
      file?: {
        fileName?: string;
        contentType?: string;
        data?: string; // base64 encoded
      };
      json?: {
        skills?: { name?: string; raw?: string }[];
        positions?: { title?: string; org?: string }[];
        educations?: { degree?: string; school?: string }[];
      };
    };
  };
  job?: {
    jobTitle?: string;
    jobId?: string;
    jobCompanyName?: string;
    jobUrl?: string;
  };
};
