import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  // Only allow proxying from pro.jobing.com for security
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("jobing.com")) {
      return NextResponse.json({ error: "Invalid resume URL" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const apiKey = process.env.NOLIG_API_KEY || "";
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer token=${apiKey}`,
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch resume: ${res.status}` },
        { status: res.status }
      );
    }

    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const contentDisposition = res.headers.get("content-disposition");
    const body = await res.arrayBuffer();

    const headers: Record<string, string> = {
      "Content-Type": contentType,
    };
    if (contentDisposition) {
      headers["Content-Disposition"] = contentDisposition;
    } else {
      headers["Content-Disposition"] = "attachment; filename=resume.pdf";
    }

    return new NextResponse(body, { headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
