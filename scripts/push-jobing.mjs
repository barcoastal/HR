#!/usr/bin/env node
// Fetch all Jobing candidates + resumes locally, push to Railway
// Usage: node scripts/push-jobing.mjs

const API_KEY = "a224fab0474242946bd241d0a6c3e103";
const COMPANY = "coastal-debt-resolve";
const BASE = "https://pro.jobing.com/api";
const RAILWAY_URL = "https://hr.coastaldebt-tools.com";

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer token=${API_KEY}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function main() {
  // 1. Get jobs
  console.log("=== Fetching jobs ===");
  const jobsData = await fetchJSON(`${BASE}/jobs?company=${COMPANY}`);
  const jobs = jobsData.results || [];
  const jobMap = {};
  for (const j of jobs) jobMap[j.id] = j.title;
  console.log(`Found ${jobs.length} jobs`);

  // 2. Fetch all applicants (bulk pages)
  console.log("=== Fetching bulk applicants ===");
  const allApplicants = [];
  const seenEmails = new Set();
  let page = 1;

  while (page <= 100) {
    try {
      const data = await fetchJSON(
        `${BASE}/applicants/bulk?company=${COMPANY}&page=${page}`
      );
      const applicants = data.results || (Array.isArray(data) ? data : []);
      if (applicants.length === 0) break;
      console.log(`  Page ${page}: ${applicants.length} applicants`);

      for (const a of applicants) {
        const email = (a.email || "").toLowerCase().trim();
        if (!email || seenEmails.has(email)) continue;
        seenEmails.add(email);
        allApplicants.push(a);
      }
      page++;
    } catch {
      break;
    }
  }

  // 3. Fetch per-job applicants
  console.log("=== Fetching per-job applicants ===");
  for (const job of jobs) {
    if (!job.applicants) continue;
    try {
      const data = await fetchJSON(job.applicants);
      const applicants = Array.isArray(data)
        ? data
        : data.results || data.applicants || [];
      let added = 0;
      for (const a of applicants) {
        const email = (a.email || "").toLowerCase().trim();
        if (!email || seenEmails.has(email)) continue;
        seenEmails.add(email);
        allApplicants.push(a);
        added++;
      }
      if (added > 0) console.log(`  ${job.title}: +${added} new`);
    } catch {
      // skip
    }
  }

  console.log(`Total unique applicants: ${allApplicants.length}`);

  // 4. Build candidates with resume PDFs
  console.log("=== Downloading resumes ===");
  const candidates = [];
  let downloaded = 0;
  let failed = 0;

  for (let i = 0; i < allApplicants.length; i++) {
    const a = allApplicants[i];
    const email = (a.email || "").toLowerCase().trim();
    const jobTitle = jobMap[a.job_id] || "";
    const resumeUrl = a.resume || a.resume_url || "";

    const c = {
      firstName: a.first_name || "",
      lastName: a.last_name || "",
      email,
      phone: a.phone || undefined,
      skills: [],
      experience: jobTitle ? `Applied for: ${jobTitle}` : undefined,
      notes: a.referer ? `Referrer: ${a.referer}` : undefined,
      source: "pro.jobing",
      jobAppliedTo: jobTitle || undefined,
      resumeUrl: resumeUrl || undefined,
    };

    if (resumeUrl) {
      try {
        const res = await fetch(resumeUrl, {
          headers: { Authorization: `Bearer token=${API_KEY}` },
        });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length >= 100) {
            c.resumeBase64 = buf.toString("base64");
            downloaded++;
          } else {
            failed++;
          }
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    candidates.push(c);

    if ((i + 1) % 50 === 0) {
      console.log(
        `  Progress: ${i + 1}/${allApplicants.length} (${downloaded} resumes downloaded, ${failed} failed)`
      );
    }
  }

  console.log(
    `\nResumes: ${downloaded} downloaded, ${failed} failed out of ${allApplicants.length}`
  );

  // 5. Push to Railway in chunks (request body can be huge with base64 PDFs)
  console.log("\n=== Pushing to Railway ===");
  const CHUNK_SIZE = 50;
  let totalCreated = 0;
  let totalResumes = 0;

  for (let i = 0; i < candidates.length; i += CHUNK_SIZE) {
    const chunk = candidates.slice(i, i + CHUNK_SIZE);
    const chunkNum = Math.floor(i / CHUNK_SIZE) + 1;
    const totalChunks = Math.ceil(candidates.length / CHUNK_SIZE);

    console.log(`  Chunk ${chunkNum}/${totalChunks} (${chunk.length} candidates)...`);

    const isFirstChunk = i === 0;
    const res = await fetch(`${RAILWAY_URL}/api/candidates/resync-jobing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidates: chunk, deleteExisting: isFirstChunk }),
    });

    const result = await res.json();
    console.log(
      `    Created: ${result.step3_created}, Resumes: ${result.resumesDownloaded}, Errors: ${(result.errors || []).length}`
    );

    if (result.errors?.length > 0) {
      console.log(`    First errors: ${result.errors.slice(0, 3).join(", ")}`);
    }

    totalCreated += result.step3_created || 0;
    totalResumes += result.resumesDownloaded || 0;
  }

  console.log(`\n=== Done ===`);
  console.log(`Total created: ${totalCreated}`);
  console.log(`Total resumes saved: ${totalResumes}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
