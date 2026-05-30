import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureValidToken } from "@/lib/actions/platform-sync";

const CRON_SECRET = process.env.CRON_SECRET || "";
const BREEZY_BASE_URL = "https://api.breezy.hr/v3";

/**
 * GET /api/cron/probe-candidate?secret=...&q=name
 * Returns: candidate row + whether the FileBlob exists for the local URL +
 * raw Breezy candidate detail (with resume field) so we can see why a
 * resume isn't showing.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("secret") !== CRON_SECRET || !CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const q = url.searchParams.get("q");
  if (!q) return NextResponse.json({ error: "pass ?q=" }, { status: 400 });

  const candidate = await db.candidate.findFirst({
    where: {
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        { firstName: { contains: q.split(/\s+/)[0], mode: "insensitive" } },
        { lastName: { contains: q.split(/\s+/).slice(-1)[0], mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      source: true,
      resumeUrl: true,
      createdAt: true,
      position: { select: { id: true, title: true } },
    },
  });
  if (!candidate) return NextResponse.json({ error: "no match" }, { status: 404 });

  let blob: { exists: boolean; size?: number; mimeType?: string } = { exists: false };
  if (candidate.resumeUrl?.startsWith("/api/resumes/")) {
    const filename = `resume-${candidate.id}.pdf`;
    const found = await db.fileBlob.findUnique({
      where: { filename },
      select: { size: true, mimeType: true },
    });
    blob = { exists: !!found, size: found?.size, mimeType: found?.mimeType };
  } else if (candidate.resumeUrl?.startsWith("/api/onboarding-docs/")) {
    const filename = candidate.resumeUrl.split("/").pop() || "";
    const found = await db.fileBlob.findUnique({
      where: { filename },
      select: { size: true, mimeType: true },
    });
    blob = { exists: !!found, size: found?.size, mimeType: found?.mimeType };
  }

  // Look up the candidate on Breezy by email to see what their resume field
  // looks like over there.
  let breezy: unknown = null;
  try {
    const platform = await db.recruitmentPlatform.findFirst({ where: { name: "Breezy HR" } });
    if (platform) {
      const tk = await ensureValidToken(platform.id);
      if (tk.valid && tk.accessToken) {
        const [token, companyId] = tk.accessToken.split("::");
        const posRes = await fetch(`${BREEZY_BASE_URL}/company/${companyId}/positions`, {
          headers: { Authorization: token },
        });
        const positions = posRes.ok ? ((await posRes.json()) as { _id: string; name: string }[]) : [];
        let foundDetail: unknown = null;
        let foundOn: { positionId: string; positionName: string; candidateId: string } | null = null;
        outer: for (const p of positions) {
          const cr = await fetch(
            `${BREEZY_BASE_URL}/company/${companyId}/position/${p._id}/candidates`,
            { headers: { Authorization: token } },
          );
          if (!cr.ok) continue;
          const list = (await cr.json()) as { _id: string; email_address?: string }[];
          for (const c of list) {
            if ((c.email_address || "").toLowerCase() === candidate.email.toLowerCase()) {
              const dr = await fetch(
                `${BREEZY_BASE_URL}/company/${companyId}/position/${p._id}/candidate/${c._id}`,
                { headers: { Authorization: token } },
              );
              if (dr.ok) {
                foundDetail = await dr.json();
                foundOn = { positionId: p._id, positionName: p.name, candidateId: c._id };
              }
              break outer;
            }
          }
        }
        breezy = { foundOn, resume: (foundDetail as { resume?: unknown })?.resume ?? null };
      }
    }
  } catch (err) {
    breezy = { error: String(err) };
  }

  return NextResponse.json({ candidate, blob, breezy });
}
