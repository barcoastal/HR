import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  const session = await requireApiAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { candidates } = await req.json();

    if (!Array.isArray(candidates) || candidates.length === 0) {
      return NextResponse.json({ error: "No candidates provided" }, { status: 400 });
    }

    // Filter valid candidates
    const valid = candidates.filter(
      (c: any) => c.email && c.firstName
    );

    // Get all existing emails in one query
    const existingEmails = new Set(
      (
        await db.candidate.findMany({
          where: { email: { in: valid.map((c: any) => c.email) } },
          select: { email: true },
        })
      ).map((c) => c.email)
    );

    const skipped = valid
      .filter((c: any) => existingEmails.has(c.email))
      .map((c: any) => c.email);
    const toCreate = valid.filter((c: any) => !existingEmails.has(c.email));

    // Deduplicate by email within the batch
    const seen = new Set<string>();
    const uniqueToCreate = toCreate.filter((c: any) => {
      const email = c.email.toLowerCase().trim();
      if (seen.has(email)) return false;
      seen.add(email);
      return true;
    });

    // DNC block: filter out rows whose phone or email matches a Do-Not-Call
    // candidate before we even queue them for batch insert.
    const { findDoNotCallMatch } = await import("@/lib/actions/candidate-applications");
    const dncFiltered: any[] = [];
    const dncSkipped: string[] = [];
    for (const c of uniqueToCreate) {
      const hit = await findDoNotCallMatch(c.phone, c.email);
      if (hit) {
        dncSkipped.push(`${c.email} (DNC: ${hit.firstName} ${hit.lastName})`);
      } else {
        dncFiltered.push(c);
      }
    }
    skipped.push(...dncSkipped);

    // Batch create in chunks of 500
    let created = 0;
    const errors: string[] = [];
    const CHUNK_SIZE = 500;

    for (let i = 0; i < dncFiltered.length; i += CHUNK_SIZE) {
      const chunk = dncFiltered.slice(i, i + CHUNK_SIZE);
      try {
        const result = await db.candidate.createMany({
          data: chunk.map((c: any) => {
            // If firstName looks like a date, extract name from email
            let firstName = c.firstName;
            let lastName = c.lastName || "";
            if (/^\d{4}-\d{2}-\d{2}/.test(firstName) || /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(firstName)) {
              const local = c.email.split("@")[0].replace(/[0-9_\-\.]+.*$/, "");
              if (local.length >= 3) {
                // Try to split into first+last
                const mid = Math.ceil(local.length * 0.45);
                firstName = local.slice(0, mid);
                firstName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
                const rest = local.slice(mid);
                lastName = rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : "";
              } else {
                firstName = local || c.email.split("@")[0];
              }
            }
            return {
            firstName,
            lastName,
            email: c.email.toLowerCase().trim(),
            phone: c.phone || null,
            skills: c.skills
              ? JSON.stringify(
                  c.skills
                    .split(/[,;]/)
                    .map((s: string) => s.trim())
                    .filter(Boolean)
                )
              : null,
            experience: c.experience || null,
            source: c.source || null,
            linkedinUrl: c.linkedinUrl || null,
            notes: c.notes || null,
            inPipeline: false,
          };
          }),
          skipDuplicates: true,
        });
        created += result.count;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        errors.push(
          `Batch ${Math.floor(i / CHUNK_SIZE) + 1} failed: ${message}`
        );
      }
    }

    revalidatePath("/cv");

    return NextResponse.json({
      created,
      skipped,
      errors,
      total: valid.length,
    });
  } catch (error) {
    console.error("[Import] Failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Import failed",
      },
      { status: 500 }
    );
  }
}
