import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureValidToken } from "@/lib/actions/platform-sync";

const CRON_SECRET = process.env.CRON_SECRET || "";
const BREEZY_BASE_URL = "https://api.breezy.hr/v3";

/**
 * GET /api/cron/joshua-resume?secret=...&q=name
 * One-shot lookup for a specific candidate by name → returns our stored
 * resumeUrl + the Breezy resume metadata so we can see what link could
 * theoretically be pulled. Diagnostic.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("secret") !== CRON_SECRET || !CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const q = url.searchParams.get("q") || "Joshua Metayer";

  const candidate = await db.candidate.findFirst({
    where: {
      OR: [
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
      position: { select: { title: true } },
    },
  });
  if (!candidate) return NextResponse.json({ error: `No candidate matching "${q}"` }, { status: 404 });

  // If our stored URL is already local, just return that and we're done.
  if (candidate.resumeUrl?.startsWith("/api/")) {
    const filename = candidate.resumeUrl.split("/").pop() || "";
    const blob = await db.fileBlob.findUnique({
      where: { filename },
      select: { id: true, size: true, mimeType: true },
    });
    return NextResponse.json({
      candidate,
      conclusion: "local",
      localUrl: candidate.resumeUrl,
      blobOnFile: !!blob,
      blob,
    });
  }

  // Otherwise we need to dig into Breezy for a working download URL.
  const platform = await db.recruitmentPlatform.findFirst({ where: { name: "Breezy HR" } });
  if (!platform) return NextResponse.json({ error: "Breezy not connected" });
  await db.recruitmentPlatform.update({
    where: { id: platform.id },
    data: { tokenExpiresAt: new Date(0) },
  });
  const tokenResult = await ensureValidToken(platform.id);
  if (!tokenResult.valid || !tokenResult.accessToken) {
    return NextResponse.json({ error: tokenResult.error || "No token" });
  }
  const [token, companyId] = tokenResult.accessToken.split("::");

  // Walk positions/candidates to find a match by email.
  const posRes = await fetch(`${BREEZY_BASE_URL}/company/${companyId}/positions`, {
    headers: { Authorization: token },
  });
  const positions = posRes.ok ? ((await posRes.json()) as { _id: string; name: string }[]) : [];

  type Cand = { _id: string; email_address?: string; resume?: { url?: string; file_name?: string; _id?: string }; name?: string };
  let foundOn: { positionId: string; positionName: string; candidateId: string; resume: Cand["resume"] } | null = null;
  for (const p of positions) {
    if (foundOn) break;
    const cr = await fetch(`${BREEZY_BASE_URL}/company/${companyId}/position/${p._id}/candidates`, {
      headers: { Authorization: token },
    });
    if (!cr.ok) continue;
    const list = (await cr.json()) as Cand[];
    const match = list.find((c) =>
      (c.email_address || "").toLowerCase() === candidate.email.toLowerCase(),
    );
    if (!match) continue;
    const dr = await fetch(`${BREEZY_BASE_URL}/company/${companyId}/position/${p._id}/candidate/${match._id}`, {
      headers: { Authorization: token },
    });
    if (!dr.ok) continue;
    const detail = (await dr.json()) as Cand;
    foundOn = {
      positionId: p._id,
      positionName: p.name,
      candidateId: match._id,
      resume: detail.resume,
    };
  }

  if (!foundOn) {
    return NextResponse.json({ candidate, conclusion: "not-found-on-breezy" });
  }

  // Try downloading the resume — same exact path the proxy uses.
  const resumeApiUrl = `${BREEZY_BASE_URL}/company/${companyId}/position/${foundOn.positionId}/candidate/${foundOn.candidateId}/resume`;
  let downloadStatus = 0;
  let downloadBodyPreview: string | null = null;
  let downloadContentType: string | null = null;
  try {
    const dlr = await fetch(resumeApiUrl, {
      headers: { Authorization: token },
      redirect: "manual",
    });
    downloadStatus = dlr.status;
    downloadContentType = dlr.headers.get("content-type");
    const buf = await dlr.arrayBuffer();
    downloadBodyPreview = buf.byteLength < 400
      ? Buffer.from(buf).toString("utf-8")
      : `${buf.byteLength} bytes (looks like ${dlr.headers.get("content-type")})`;
  } catch (err) {
    downloadBodyPreview = String(err);
  }

  return NextResponse.json({
    candidate,
    foundOnBreezy: foundOn,
    resumeApiUrl,
    download: { status: downloadStatus, contentType: downloadContentType, preview: downloadBodyPreview },
  });
}
