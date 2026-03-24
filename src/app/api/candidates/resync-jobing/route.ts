import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { JobingClient } from "@/lib/platform-sync/clients/jobing";

const RESUMES_DIR = path.join(process.cwd(), "data", "resumes");

export async function GET() {
  return runFetch();
}

export async function POST(request: Request) {
  // If body has candidates array, use push mode (data fetched externally)
  try {
    const body = await request.json();
    if (body.candidates && Array.isArray(body.candidates)) {
      return runPush(body.candidates);
    }
  } catch {
    // No JSON body — fall through to normal fetch mode
  }
  return runFetch();
}

// Normal mode: fetch from Jobing API directly
async function runFetch() {
  const apiKey = process.env.NOLIG_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "NOLIG_API_KEY not configured" }, { status: 500 });
  }

  const company = process.env.NOLIG_COMPANY || "coastal-debt-resolve";
  await mkdir(RESUMES_DIR, { recursive: true });

  try {
    const testRes = await fetch(
      `https://pro.jobing.com/api/jobs?company=${company}`,
      {
        headers: { Authorization: `Bearer token=${apiKey}`, Accept: "application/json" },
        cache: "no-store",
      }
    );
    const testData = testRes.ok ? await testRes.json() : null;
    const jobCount = testData?.results?.length || 0;
    console.log(`[Resync Jobing] API test: status=${testRes.status}, jobs=${jobCount}`);

    const deleted = await db.candidate.deleteMany({
      where: {
        OR: [
          { source: { contains: "jobing" } },
          { source: { contains: "pro.jobing" } },
        ],
      },
    });

    const client = new JobingClient();
    const candidates = await client.fetchCandidates(apiKey);
    console.log(`[Resync Jobing] Fetched ${candidates.length} candidates from API`);

    const result = await insertCandidates(candidates, apiKey);

    revalidatePath("/cv");

    return NextResponse.json({
      mode: "fetch",
      apiTest: { status: testRes.status, jobCount },
      step1_deleted: deleted.count,
      ...result,
    });
  } catch (error) {
    console.error("[Resync Jobing] Failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}

// Push mode: candidates + resume data provided externally (for when Jobing blocks server IPs)
async function runPush(
  candidates: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    skills?: string[];
    experience?: string;
    notes?: string;
    source?: string;
    resumeUrl?: string;
    jobAppliedTo?: string;
    resumeBase64?: string; // base64-encoded PDF
  }[]
) {
  await mkdir(RESUMES_DIR, { recursive: true });

  try {
    const deleted = await db.candidate.deleteMany({
      where: {
        OR: [
          { source: { contains: "jobing" } },
          { source: { contains: "pro.jobing" } },
        ],
      },
    });

    let created = 0;
    let resumesDownloaded = 0;
    let resumesFailed = 0;
    const seenEmails = new Set<string>();
    const errors: string[] = [];

    for (const c of candidates) {
      const email = c.email.toLowerCase().trim();
      if (!email || seenEmails.has(email)) continue;
      seenEmails.add(email);

      const existing = await db.candidate.findUnique({ where: { email } });
      if (existing) continue;

      try {
        const candidate = await db.candidate.create({
          data: {
            firstName: c.firstName || "",
            lastName: c.lastName || "",
            email,
            phone: c.phone || null,
            skills: c.skills ? JSON.stringify(c.skills) : null,
            experience: c.experience || null,
            notes: c.notes || null,
            source: c.source || "pro.jobing",
            resumeUrl: null,
            jobAppliedTo: c.jobAppliedTo || null,
            inPipeline: false,
          },
        });
        created++;

        // Save base64 resume if provided
        if (c.resumeBase64) {
          try {
            const buf = Buffer.from(c.resumeBase64, "base64");
            if (buf.length >= 100) {
              const localPath = path.join(RESUMES_DIR, `${candidate.id}.pdf`);
              await writeFile(localPath, buf);
              await db.candidate.update({
                where: { id: candidate.id },
                data: { resumeUrl: `/api/resumes/${candidate.id}` },
              });
              resumesDownloaded++;
            } else {
              resumesFailed++;
            }
          } catch {
            resumesFailed++;
            errors.push(`${email}: resume save failed`);
          }
        }
      } catch (err) {
        errors.push(`${email}: ${err instanceof Error ? err.message : "create failed"}`);
      }
    }

    revalidatePath("/cv");

    return NextResponse.json({
      mode: "push",
      step1_deleted: deleted.count,
      step2_fetched: candidates.length,
      step3_created: created,
      resumesDownloaded,
      resumesFailed,
      errors: errors.slice(0, 20),
    });
  } catch (error) {
    console.error("[Resync Jobing Push] Failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}

// Shared: insert candidates and download resumes
async function insertCandidates(
  candidates: { firstName: string; lastName: string; email: string; phone?: string; skills?: string[]; experience?: string; notes?: string; source?: string; resumeUrl?: string; jobAppliedTo?: string }[],
  apiKey: string
) {
  let created = 0;
  let resumesDownloaded = 0;
  let resumesFailed = 0;
  const seenEmails = new Set<string>();
  const errors: string[] = [];

  for (const c of candidates) {
    const email = c.email.toLowerCase().trim();
    if (seenEmails.has(email)) continue;
    seenEmails.add(email);

    const existing = await db.candidate.findUnique({ where: { email } });
    if (existing) continue;

    try {
      const candidate = await db.candidate.create({
        data: {
          firstName: c.firstName || "",
          lastName: c.lastName || "",
          email,
          phone: c.phone || null,
          skills: c.skills ? JSON.stringify(c.skills) : null,
          experience: c.experience || null,
          notes: c.notes || null,
          source: c.source || "pro.jobing",
          resumeUrl: null,
          jobAppliedTo: c.jobAppliedTo || null,
          inPipeline: false,
        },
      });
      created++;

      if (c.resumeUrl) {
        try {
          const res = await fetch(c.resumeUrl, {
            headers: { Authorization: `Bearer token=${apiKey}` },
          });
          if (res.ok) {
            const buf = Buffer.from(await res.arrayBuffer());
            if (buf.length >= 100) {
              const localPath = path.join(RESUMES_DIR, `${candidate.id}.pdf`);
              await writeFile(localPath, buf);
              await db.candidate.update({
                where: { id: candidate.id },
                data: { resumeUrl: `/api/resumes/${candidate.id}` },
              });
              resumesDownloaded++;
            } else {
              resumesFailed++;
            }
          } else {
            resumesFailed++;
            errors.push(`${email}: resume HTTP ${res.status}`);
          }
        } catch (err) {
          resumesFailed++;
          errors.push(`${email}: ${err instanceof Error ? err.message : "resume download failed"}`);
        }
      }
    } catch (err) {
      errors.push(`${email}: ${err instanceof Error ? err.message : "create failed"}`);
    }
  }

  return {
    step2_fetched: candidates.length,
    step3_created: created,
    resumesDownloaded,
    resumesFailed,
    errors: errors.slice(0, 20),
  };
}
