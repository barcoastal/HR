import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const settings = await db.companySettings.findUnique({
      where: { id: "singleton" },
    });

    if (settings?.faviconUrl) {
      // Extract filename from URL like /api/branding/favicon-xxx.png
      const filename = settings.faviconUrl.split("/").pop();
      if (filename) {
        const filePath = path.join(process.cwd(), "data", "branding", path.basename(filename));
        const buffer = await readFile(filePath);
        const ext = filename.split(".").pop()?.toLowerCase() || "ico";
        const mimeMap: Record<string, string> = {
          ico: "image/x-icon",
          png: "image/png",
          svg: "image/svg+xml",
          jpg: "image/jpeg",
          webp: "image/webp",
        };
        return new NextResponse(buffer, {
          headers: {
            "Content-Type": mimeMap[ext] || "image/x-icon",
            "Cache-Control": "public, max-age=3600",
          },
        });
      }
    }
  } catch {
    // Fall through to default
  }

  // Default: return nothing, browser will use default
  return new NextResponse(null, { status: 404 });
}
