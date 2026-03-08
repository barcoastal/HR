"use server";

import { db } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { revalidatePath } from "next/cache";

const RESUMES_DIR = path.join(process.cwd(), "data", "resumes");

async function ensureDir() {
  if (!existsSync(RESUMES_DIR)) {
    await mkdir(RESUMES_DIR, { recursive: true });
  }
}

async function downloadResumePdf(
  resumeUrl: string,
  candidateId: string
): Promise<boolean> {
  try {
    const apiKey = process.env.NOLIG_API_KEY || "";
    const res = await fetch(resumeUrl, {
      headers: { Authorization: `Bearer token=${apiKey}` },
    });

    if (!res.ok) return false;

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("pdf") && !contentType.includes("octet-stream")) {
      return false;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 100) return false; // Too small to be a real PDF

    const filePath = path.join(RESUMES_DIR, `${candidateId}.pdf`);
    await writeFile(filePath, buffer);
    return true;
  } catch {
    return false;
  }
}

export async function batchDownloadResumes(): Promise<{
  total: number;
  downloaded: number;
  alreadyLocal: number;
  failed: number;
}> {
  await ensureDir();

  // Get all candidates with Jobing resume URLs that aren't already local
  const candidates = await db.candidate.findMany({
    where: {
      resumeUrl: { not: null },
    },
    select: { id: true, resumeUrl: true },
  });

  let downloaded = 0;
  let alreadyLocal = 0;
  let failed = 0;

  for (const c of candidates) {
    if (!c.resumeUrl) continue;

    // Skip if already stored locally
    if (c.resumeUrl.startsWith("/api/resumes/")) {
      alreadyLocal++;
      continue;
    }

    // Skip if local file already exists
    const localPath = path.join(RESUMES_DIR, `${c.id}.pdf`);
    if (existsSync(localPath)) {
      // Update URL to local
      await db.candidate.update({
        where: { id: c.id },
        data: { resumeUrl: `/api/resumes/${c.id}` },
      });
      alreadyLocal++;
      continue;
    }

    const ok = await downloadResumePdf(c.resumeUrl, c.id);
    if (ok) {
      await db.candidate.update({
        where: { id: c.id },
        data: { resumeUrl: `/api/resumes/${c.id}` },
      });
      downloaded++;
    } else {
      failed++;
    }
  }

  revalidatePath("/cv");
  return { total: candidates.length, downloaded, alreadyLocal, failed };
}

/** Download a single candidate's resume from Jobing and store locally */
export async function downloadSingleResume(
  candidateId: string,
  jobingResumeUrl: string
): Promise<boolean> {
  await ensureDir();
  const ok = await downloadResumePdf(jobingResumeUrl, candidateId);
  if (ok) {
    await db.candidate.update({
      where: { id: candidateId },
      data: { resumeUrl: `/api/resumes/${candidateId}` },
    });
  }
  return ok;
}
