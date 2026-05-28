import { NextRequest, NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

const RESUMES_DIR = path.join(process.cwd(), "data", "resumes");

type ParsedResume = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  skills: string[];
  experience: string;
  linkedinUrl: string;
  summary: string;
  resumeText: string;
};

async function parsePdfWithClaude(base64: string): Promise<ParsedResume> {
  const anthropic = new Anthropic();
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
          {
            type: "text",
            text: `Extract structured data from this resume. Return ONLY valid JSON (no prose, no markdown) with these fields; use "" if not present and [] for skills.

{
  "firstName": "",
  "lastName": "",
  "email": "",
  "phone": "",
  "skills": [],
  "experience": "",
  "linkedinUrl": "",
  "summary": "",
  "resumeText": ""
}

For "experience" provide a short summary like "5 years — senior software engineer".
For "resumeText" include the plain text of the entire resume.`,
          },
        ],
      },
    ],
  });
  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Parser returned no JSON");
  return JSON.parse(jsonMatch[0]) as ParsedResume;
}

export async function POST(request: NextRequest) {
  const session = await requireApiAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const positionId = (formData.get("positionId") as string) || "";
  const positionName = (formData.get("positionName") as string) || "Unassigned";
  const source = (formData.get("source") as string) || "bulk-upload";

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDFs are supported" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length < 100) return NextResponse.json({ error: "PDF too small" }, { status: 400 });

  let parsed: ParsedResume;
  try {
    parsed = await parsePdfWithClaude(buffer.toString("base64"));
  } catch (err) {
    return NextResponse.json({ error: `Parse failed: ${err instanceof Error ? err.message : "unknown"}`, filename: file.name }, { status: 200 });
  }

  const rawEmail = (parsed.email || "").trim().toLowerCase();
  if (!rawEmail) {
    // No email → can't dedupe. Skip + return info.
    return NextResponse.json({
      status: "skipped",
      reason: "No email extracted from resume",
      filename: file.name,
      parsed: { firstName: parsed.firstName, lastName: parsed.lastName },
    });
  }

  await mkdir(RESUMES_DIR, { recursive: true });

  // Helper — persist the PDF to FileBlob (source of truth across Railway
  // redeploys) AND mirror to disk for local dev.
  async function persistResume(candidateId: string, pdf: Buffer) {
    const filename = `resume-${candidateId}.pdf`;
    const bytes = new Uint8Array(pdf);
    await db.fileBlob.upsert({
      where: { filename },
      update: { data: bytes, size: bytes.length, mimeType: "application/pdf" },
      create: { filename, data: bytes, size: bytes.length, mimeType: "application/pdf" },
    });
    try {
      await writeFile(path.join(RESUMES_DIR, `${candidateId}.pdf`), pdf);
    } catch {
      // disk mirror is best-effort
    }
  }

  // Dedupe by email
  const existing = await db.candidate.findUnique({ where: { email: rawEmail } });

  if (existing) {
    // Save the new resume PDF — overwrite the old blob/file to keep the latest
    await persistResume(existing.id, buffer);

    // Record the application against this position
    const { recordApplication } = await import("@/lib/actions/candidate-applications");
    await recordApplication({
      candidateId: existing.id,
      positionId: positionId || null,
      positionName,
      source,
      resumeUrl: `/api/resumes/${existing.id}`,
    });

    // Update fields that may have changed — but do NOT touch doNotCall or core identity
    const updates: Record<string, unknown> = {
      resumeUrl: `/api/resumes/${existing.id}`,
      resumeText: parsed.resumeText || existing.resumeText,
    };
    if (!existing.phone && parsed.phone) updates.phone = parsed.phone;
    if (!existing.linkedinUrl && parsed.linkedinUrl) updates.linkedinUrl = parsed.linkedinUrl;
    if (parsed.skills?.length > 0) updates.skills = JSON.stringify(parsed.skills);
    if (parsed.experience) updates.experience = parsed.experience;

    await db.candidate.update({ where: { id: existing.id }, data: updates });

    return NextResponse.json({
      status: "merged",
      candidateId: existing.id,
      doNotCall: existing.doNotCall,
      doNotCallReason: existing.doNotCallReason,
      applicationCount: existing.applicationCount + 1,
      email: rawEmail,
      name: `${existing.firstName} ${existing.lastName}`,
      filename: file.name,
    });
  }

  // New candidate
  const newId = randomUUID();
  await persistResume(newId, buffer);

  const created = await db.candidate.create({
    data: {
      id: newId,
      firstName: parsed.firstName || file.name.replace(/\.pdf$/i, "").slice(0, 80),
      lastName: parsed.lastName || "",
      email: rawEmail,
      phone: parsed.phone || null,
      linkedinUrl: parsed.linkedinUrl || null,
      skills: parsed.skills?.length ? JSON.stringify(parsed.skills) : null,
      experience: parsed.experience || null,
      resumeUrl: `/api/resumes/${newId}`,
      resumeText: parsed.resumeText || null,
      source,
      positionId: positionId || null,
      jobAppliedTo: positionName,
      inPipeline: false,
      applicationCount: 1,
    },
  });

  const { recordApplication } = await import("@/lib/actions/candidate-applications");
  await recordApplication({
    candidateId: created.id,
    positionId: positionId || null,
    positionName,
    source,
    resumeUrl: `/api/resumes/${created.id}`,
  });
  // recordApplication bumps applicationCount to 2; reset to 1 since this is the first
  await db.candidate.update({ where: { id: created.id }, data: { applicationCount: 1 } });

  return NextResponse.json({
    status: "created",
    candidateId: created.id,
    email: rawEmail,
    name: `${created.firstName} ${created.lastName}`,
    filename: file.name,
  });
}
