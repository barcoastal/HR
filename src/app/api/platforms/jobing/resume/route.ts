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
      // Jobing API resume endpoint may return 500 — return clear error
      return NextResponse.json(
        { error: `Jobing resume endpoint returned ${res.status}. View the resume directly on pro.jobing.com.` },
        { status: 502 }
      );
    }

    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const body = await res.arrayBuffer();

    const headers: Record<string, string> = {
      "Content-Type": contentType,
    };
    // Use inline disposition so PDFs can be viewed in iframe
    headers["Content-Disposition"] = "inline; filename=resume.pdf";

    return new NextResponse(body, { headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
