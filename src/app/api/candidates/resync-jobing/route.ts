import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { JobingClient } from "@/lib/platform-sync/clients/jobing";

const RESUMES_DIR = path.join(process.cwd(), "data", "resumes");

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
    // Step 1: Delete ALL existing Jobing candidates
    const deleted = await db.candidate.deleteMany({
      where: {
        OR: [
          { source: { contains: "jobing" } },
          { source: { contains: "pro.jobing" } },
        ],
      },
    });

    // Step 2: Fetch fresh from Jobing API
    const client = new JobingClient();
    const candidates = await client.fetchCandidates(apiKey);

    // Step 3: Create candidates and download resumes
    let created = 0;
    let resumesDownloaded = 0;
    let resumesFailed = 0;
    const seenEmails = new Set<string>();
    const errors: string[] = [];

    for (const c of candidates) {
      const email = c.email.toLowerCase().trim();
      if (seenEmails.has(email)) continue;
      seenEmails.add(email);

      // Check if email exists (could be from another source)
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

        // Download resume PDF if available
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

    revalidatePath("/cv");

    return NextResponse.json({
      step1_deleted: deleted.count,
      step2_fetched: candidates.length,
      step3_created: created,
      resumesDownloaded,
      resumesFailed,
      errors: errors.slice(0, 20),
    });
  } catch (error) {
    console.error("[Resync Jobing] Failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
