import { NextResponse } from "next/server";

const CRON_SECRET = process.env.CRON_SECRET || "";
const BG_CHECK_BASE = "https://app.backgroundchecks.com/api";
const BG_CHECK_API_KEY = process.env.BACKGROUND_CHECK_API_KEY || "";

/**
 * GET /api/cron/bg-pdf-probe?secret=...&reportKey=...
 * Probe every known PDF-style endpoint on backgroundchecks.com for the
 * given report_key. Temporary diagnostic — returns response status,
 * content-type, byte count, and a body preview for each candidate path.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!BG_CHECK_API_KEY) {
    return NextResponse.json({ error: "BACKGROUND_CHECK_API_KEY not configured" }, { status: 500 });
  }
  const reportKey = url.searchParams.get("reportKey");
  if (!reportKey) return NextResponse.json({ error: "pass ?reportKey=..." }, { status: 400 });

  const paths = [
    // /api/reports/{key}/...
    `/reports/${reportKey}/pdf`,
    `/reports/${reportKey}/status`,
    `/reports/${reportKey}/view`,
    // candidate / order patterns
    `/orders/${reportKey}`,
    `/orders/${reportKey}/report`,
    `/orders/${reportKey}/pdf`,
    `/applicants/${reportKey}/report`,
    // ID-keyed reports
    `/report/${reportKey}`,
    `/report/${reportKey}/pdf`,
    // search by reportKey
    `/reports?report_key=${reportKey}`,
  ];

  type Result = { path: string; status: number; contentType: string | null; bytes: number; bodyPreview?: string; location?: string | null };
  const out: Result[] = [];

  for (const path of paths) {
    const full = `${BG_CHECK_BASE}${path}?api_token=${BG_CHECK_API_KEY}`;
    try {
      const res = await fetch(full, {
        method: "GET",
        headers: { Accept: "application/pdf,application/json,*/*" },
        redirect: "manual",
      });
      const ct = res.headers.get("content-type") || "";
      const buf = await res.arrayBuffer();
      const result: Result = {
        path,
        status: res.status,
        contentType: ct,
        bytes: buf.byteLength,
        location: res.headers.get("location"),
      };
      if (buf.byteLength < 600) {
        try {
          result.bodyPreview = Buffer.from(buf).toString("utf-8").slice(0, 500);
        } catch {
          /* binary */
        }
      } else if (ct.includes("pdf") || ct.includes("octet-stream")) {
        result.bodyPreview = `<binary ${buf.byteLength} bytes — first bytes: ${Buffer.from(buf).slice(0, 8).toString("hex")}>`;
      }
      out.push(result);
    } catch (err) {
      out.push({ path, status: 0, contentType: null, bytes: 0, bodyPreview: String(err) });
    }
  }

  return NextResponse.json({ reportKey, probes: out });
}
