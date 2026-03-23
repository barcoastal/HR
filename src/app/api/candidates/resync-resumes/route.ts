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

function fetchOpts(apiKey: string): RequestInit {
  return {
    headers: {
      Authorization: `Bearer token=${apiKey}`,
      Accept: "application/json",
    },
    cache: "no-store",
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
    // Step 1: Fetch ALL applicants from Jobing
    const allApplicants: any[] = [];

    // Bulk endpoint
    let page = 1;
    while (true) {
      try {
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
        if (applicants.length < 50) break;
      } catch {
        break;
      }
    }

    // Per-job endpoint
    try {
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
    } catch {}

    // Step 2: Build email → resume URL map
    const resumeMap = new Map<string, string>();
    for (const a of allApplicants) {
      const email = (a.email || "").toLowerCase().trim();
      const resumeUrl = a.resume || a.resume_url;
      if (email && resumeUrl) {
        resumeMap.set(email, resumeUrl);
      }
    }

    // Step 3: Find Jobing candidates in DB
    const candidates = await db.candidate.findMany({
      where: {
        OR: [
          { source: { contains: "jobing" } },
          { source: { contains: "pro.jobing" } },
        ],
      },
      select: { id: true, email: true, resumeUrl: true },
    });

    let downloaded = 0;
    let alreadyExists = 0;
    let noResumeUrl = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const c of candidates) {
      const localPath = path.join(RESUMES_DIR, `${c.id}.pdf`);

      // Skip if file exists on disk
      if (existsSync(localPath)) {
        alreadyExists++;
        continue;
      }

      // Find resume URL from Jobing data
      const resumeUrl = resumeMap.get(c.email.toLowerCase().trim());
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
          errors.push(`${c.email}: HTTP ${res.status}`);
          failed++;
          continue;
        }

        const contentType = res.headers.get("content-type") || "";
        const buf = Buffer.from(await res.arrayBuffer());

        if (buf.length < 100) {
          errors.push(`${c.email}: file too small (${buf.length} bytes)`);
          failed++;
          continue;
        }

        await writeFile(localPath, buf);

        // Ensure resumeUrl points to local
        if (c.resumeUrl !== `/api/resumes/${c.id}`) {
          await db.candidate.update({
            where: { id: c.id },
            data: { resumeUrl: `/api/resumes/${c.id}` },
          });
        }

        downloaded++;
      } catch (err) {
        errors.push(`${c.email}: ${err instanceof Error ? err.message : "failed"}`);
        failed++;
      }
    }

    revalidatePath("/cv");

    return NextResponse.json({
      jobingApplicantsFromApi: allApplicants.length,
      resumeUrlsFound: resumeMap.size,
      dbCandidates: candidates.length,
      downloaded,
      alreadyExists,
      noResumeUrl,
      failed,
      sampleResumeUrls: Array.from(resumeMap.entries()).slice(0, 3).map(([email, url]) => ({ email, url })),
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    console.error("[Resync Resumes] Failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
