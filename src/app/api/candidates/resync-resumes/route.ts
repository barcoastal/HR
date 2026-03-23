import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { revalidatePath } from "next/cache";

const BASE_URL = "https://pro.jobing.com/api";
const RESUMES_DIR = path.join(process.cwd(), "data", "resumes");

function getCompany() {
  return process.env.NOLIG_COMPANY || "coastal-debt-resolve";
}

function fetchOpts(token: string): RequestInit {
  return {
    headers: {
      Authorization: `Bearer token=${token}`,
      Accept: "application/json",
    },
  };
}

export async function GET() {
  return run();
}

export async function POST() {
  return run();
}

async function run() {
  const apiKey = process.env.NOLIG_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "NOLIG_API_KEY not configured" }, { status: 500 });
  }

  await mkdir(RESUMES_DIR, { recursive: true });

  try {
    // Step 1: Fetch all applicants from Jobing to get resume URLs
    const allApplicants: any[] = [];
    let page = 1;

    while (true) {
      const res = await fetch(
        `${BASE_URL}/applicants/bulk?company=${getCompany()}&page=${page}`,
        fetchOpts(apiKey)
      );
      if (!res.ok) break;

      const data = await res.json();
      const applicants = Array.isArray(data) ? data : data.results || data.applicants || [];
      if (applicants.length === 0) break;

      allApplicants.push(...applicants);
      page++;
      if (applicants.length < 50) break; // No more pages
    }

    // Also fetch per-job applicants
    const jobsRes = await fetch(`${BASE_URL}/jobs?company=${getCompany()}`, fetchOpts(apiKey));
    if (jobsRes.ok) {
      const jobs = await jobsRes.json();
      const jobList = Array.isArray(jobs) ? jobs : jobs.results || jobs.jobs || [];
      for (const job of jobList) {
        const jobId = job.id || job._id;
        if (!jobId) continue;
        try {
          const res = await fetch(
            `${BASE_URL}/jobs/${jobId}/applicants?company=${getCompany()}`,
            fetchOpts(apiKey)
          );
          if (res.ok) {
            const data = await res.json();
            const applicants = Array.isArray(data) ? data : data.results || data.applicants || [];
            allApplicants.push(...applicants);
          }
        } catch {}
      }
    }

    // Step 2: Build email → resumeUrl map
    const resumeMap = new Map<string, string>();
    for (const a of allApplicants) {
      const email = a.email?.toLowerCase();
      const resumeUrl = a.resume || a.resume_url;
      if (email && resumeUrl) {
        resumeMap.set(email, resumeUrl);
      }
    }

    // Step 3: Find Jobing candidates in DB that need resumes
    const candidates = await db.candidate.findMany({
      where: {
        source: { contains: "jobing" },
      },
      select: { id: true, email: true, resumeUrl: true },
    });

    let downloaded = 0;
    let alreadyExists = 0;
    let noResumeUrl = 0;
    let failed = 0;

    for (const c of candidates) {
      const localPath = path.join(RESUMES_DIR, `${c.id}.pdf`);

      // Skip if file already exists on disk
      if (existsSync(localPath)) {
        alreadyExists++;
        continue;
      }

      // Find resume URL from Jobing data
      const resumeUrl = resumeMap.get(c.email.toLowerCase());
      if (!resumeUrl) {
        noResumeUrl++;
        continue;
      }

      // Download the PDF
      try {
        const res = await fetch(resumeUrl, {
          headers: { Authorization: `Bearer token=${apiKey}` },
        });

        if (!res.ok) {
          failed++;
          continue;
        }

        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 100) {
          failed++;
          continue;
        }

        await writeFile(localPath, buf);

        // Update resumeUrl to local path
        await db.candidate.update({
          where: { id: c.id },
          data: { resumeUrl: `/api/resumes/${c.id}` },
        });

        downloaded++;
      } catch {
        failed++;
      }
    }

    revalidatePath("/cv");

    return NextResponse.json({
      jobingApplicants: allApplicants.length,
      resumeUrlsFound: resumeMap.size,
      candidates: candidates.length,
      downloaded,
      alreadyExists,
      noResumeUrl,
      failed,
    });
  } catch (error) {
    console.error("[Resync Resumes] Failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
