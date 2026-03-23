import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

function extractNameFromEmail(email: string): { firstName: string; lastName: string } {
  const local = email.split("@")[0];
  // Remove numbers and special chars, try to find name patterns
  // e.g. "chevaughnwolfe4vd7p_chc" → "chevaughn wolfe"
  // e.g. "destinydavis857jk4ts_ykw" → "destiny davis"

  // Common pattern: firstnamelastname followed by random chars
  // Try to split camelCase or find two words
  const cleaned = local.replace(/[0-9_\-\.]+.*$/, ""); // Remove everything from first number onwards

  if (!cleaned || cleaned.length < 2) {
    return { firstName: local.split(/[0-9_@]/)[0] || email, lastName: "" };
  }

  // Try to find where lastName starts (common names pattern)
  // Look for a second uppercase or common name boundary
  const match = cleaned.match(/^([a-z]+?)([A-Z][a-z]+)$/);
  if (match) {
    return {
      firstName: match[1].charAt(0).toUpperCase() + match[1].slice(1),
      lastName: match[2],
    };
  }

  // Try common first name lengths (4-8 chars) + rest is last name
  // Use a simple heuristic: if cleaned is long enough, split roughly in half
  if (cleaned.length >= 6) {
    // Look for doubled consonants or vowel-consonant boundaries
    for (let i = 3; i < cleaned.length - 2; i++) {
      const before = cleaned.slice(0, i);
      const after = cleaned.slice(i);
      // Common name boundary patterns
      if (after.length >= 3 && before.length >= 3) {
        return {
          firstName: before.charAt(0).toUpperCase() + before.slice(1),
          lastName: after.charAt(0).toUpperCase() + after.slice(1),
        };
      }
    }
  }

  return {
    firstName: cleaned.charAt(0).toUpperCase() + cleaned.slice(1),
    lastName: "",
  };
}

function looksLikeDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(value) || /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(value);
}

export async function POST() {
  const session = await requireApiAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Find candidates where firstName looks like a date
    const candidates = await db.candidate.findMany({
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    let fixed = 0;
    const updates: { id: string; firstName: string; lastName: string }[] = [];

    for (const c of candidates) {
      if (looksLikeDate(c.firstName) || (!c.firstName && !c.lastName) || c.firstName === c.email) {
        const { firstName, lastName } = extractNameFromEmail(c.email);
        updates.push({ id: c.id, firstName, lastName });
      }
    }

    // Batch update
    for (const u of updates) {
      await db.candidate.update({
        where: { id: u.id },
        data: { firstName: u.firstName, lastName: u.lastName },
      });
      fixed++;
    }

    revalidatePath("/cv");

    return NextResponse.json({
      totalCandidates: candidates.length,
      fixed,
      message: `Fixed ${fixed} candidates with date/missing names`,
    });
  } catch (error) {
    console.error("[Fix Names] Failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
