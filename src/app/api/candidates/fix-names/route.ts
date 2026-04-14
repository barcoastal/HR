import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireApiAdmin } from "@/lib/auth-helpers";

function looksLikeDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(value) || /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(value);
}

function extractNameFromEmail(email: string): { firstName: string; lastName: string } {
  const local = email.split("@")[0];

  // Remove trailing random chars: e.g. "chevaughnwolfe4vd7p_chc" → "chevaughnwolfe"
  // Pattern: name part followed by numbers/underscores/random
  const cleaned = local
    .replace(/_[a-z0-9]+$/i, "")  // remove _xyz suffix
    .replace(/\d+[a-z]*$/i, "")   // remove trailing numbers+chars
    .replace(/\d+/g, "");          // remove remaining numbers

  if (!cleaned || cleaned.length < 2) {
    // Fallback: just capitalize whatever we have
    const fallback = local.replace(/[0-9_\-\.@]+/g, "");
    return {
      firstName: fallback.charAt(0).toUpperCase() + fallback.slice(1),
      lastName: "",
    };
  }

  // Try common patterns:
  // 1. "firstname.lastname" or "firstname_lastname"
  if (cleaned.includes(".") || cleaned.includes("-")) {
    const parts = cleaned.split(/[\.\-]/);
    return {
      firstName: parts[0].charAt(0).toUpperCase() + parts[0].slice(1),
      lastName: parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" "),
    };
  }

  // 2. Try to find a natural split point for "firstnamelastname"
  // Common first names are 3-8 chars, look for common last name starts
  const commonLastNameStarts = [
    "smith", "john", "wil", "brown", "jones", "davis", "garcia",
    "rodriguez", "martin", "thompson", "white", "harris", "clark",
    "lewis", "robinson", "walker", "hall", "allen", "young", "king",
    "wright", "lopez", "hill", "scott", "green", "adams", "baker",
    "nelson", "carter", "mitchell", "perez", "roberts", "turner",
    "phillips", "campbell", "parker", "evans", "edwards", "collins",
    "stewart", "sanchez", "morris", "rogers", "reed", "cook",
    "morgan", "bell", "murphy", "bailey", "rivera", "cooper",
    "richardson", "cox", "howard", "ward", "torres", "peterson",
    "gray", "ramirez", "james", "watson", "brooks", "kelly",
    "sanders", "price", "bennett", "wood", "barnes", "ross",
    "henderson", "coleman", "jenkins", "perry", "powell", "long",
    "patterson", "hughes", "flores", "washington", "butler",
    "simmons", "foster", "gonzales", "bryant", "alexander",
    "russell", "griffin", "diaz", "hayes", "myers", "ford",
    "hamilton", "graham", "sullivan", "wallace", "woods", "cole",
    "west", "jordan", "owens", "reynolds", "fisher", "ellis",
    "harrison", "gibson", "mcdonald", "cruz", "marshall",
    "ortiz", "gomez", "murray", "freeman", "wells", "webb",
    "simpson", "stevens", "tucker", "porter", "hunter", "hicks",
    "crawford", "henry", "boyd", "mason", "morales", "kennedy",
    "warren", "dixon", "ramos", "reyes", "burns", "gordon",
    "shaw", "holmes", "rice", "robertson", "hunt", "black",
    "daniels", "palmer", "mills", "nichols", "grant", "knight",
    "ferguson", "rose", "stone", "hawkins", "dunn", "perkins",
    "hudson", "spencer", "gardner", "stephens", "payne", "pierce",
    "berry", "matthews", "arnold", "wagner", "willis", "ray",
    "watkins", "olson", "carroll", "duncan", "snyder", "hart",
    "cunningham", "bradley", "lane", "andrews", "ruiz", "harper",
    "fox", "riley", "armstrong", "carpenter", "weaver", "greene",
    "lawrence", "elliott", "chavez", "sims", "austin", "peters",
    "kelley", "franklin", "lawson", "fields", "gutierrez", "ryan",
    "schmidt", "carr", "vasquez", "castillo", "wheeler", "chapman",
    "oliver", "montgomery", "richards", "williamson", "johnston",
    "banks", "meyer", "bishop", "mccoy", "howell", "alvarez",
    "morrison", "hansen", "fernandez", "garza", "harvey", "little",
    "burton", "stanley", "nguyen", "george", "jacobs", "reid",
    "kim", "fuller", "lynch", "dean", "gilbert", "garrett",
    "romero", "welch", "larson", "frazier", "burke", "hanson",
    "barrios", "wolfe", "holmes", "albert", "shannon",
  ];

  const lower = cleaned.toLowerCase();

  // Try to match a last name at various positions
  for (let i = 3; i <= Math.min(cleaned.length - 3, 10); i++) {
    const possibleLast = lower.slice(i);
    for (const ln of commonLastNameStarts) {
      if (possibleLast.startsWith(ln) && possibleLast.length >= 3) {
        const first = cleaned.slice(0, i);
        const last = cleaned.slice(i);
        return {
          firstName: first.charAt(0).toUpperCase() + first.slice(1),
          lastName: last.charAt(0).toUpperCase() + last.slice(1),
        };
      }
    }
  }

  // Fallback: split roughly at 40-50% mark
  if (cleaned.length >= 6) {
    const mid = Math.ceil(cleaned.length * 0.45);
    return {
      firstName: cleaned.slice(0, mid).charAt(0).toUpperCase() + cleaned.slice(1, mid),
      lastName: cleaned.slice(mid).charAt(0).toUpperCase() + cleaned.slice(mid + 1),
    };
  }

  return {
    firstName: cleaned.charAt(0).toUpperCase() + cleaned.slice(1),
    lastName: "",
  };
}

export async function GET() {
  return run();
}

export async function POST() {
  return run();
}

async function run() {
  const session = await requireApiAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const candidates = await db.candidate.findMany({
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    let fixed = 0;
    const CHUNK_SIZE = 100;
    const updates: { id: string; firstName: string; lastName: string }[] = [];

    for (const c of candidates) {
      if (looksLikeDate(c.firstName) || c.firstName === "" || c.firstName === c.email) {
        const { firstName, lastName } = extractNameFromEmail(c.email);
        updates.push({ id: c.id, firstName, lastName: lastName || c.lastName || "" });
      }
    }

    // Batch update
    for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
      const chunk = updates.slice(i, i + CHUNK_SIZE);
      for (const u of chunk) {
        await db.candidate.update({
          where: { id: u.id },
          data: { firstName: u.firstName, lastName: u.lastName },
        });
        fixed++;
      }
    }

    revalidatePath("/cv");

    return NextResponse.json({
      totalCandidates: candidates.length,
      fixed,
      message: `Fixed ${fixed} candidates with date/missing names`,
      samples: updates.slice(0, 5).map(u => `${u.firstName} ${u.lastName}`),
    });
  } catch (error) {
    console.error("[Fix Names] Failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
