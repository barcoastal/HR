import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { randomUUID } from "crypto";
import path from "path";

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/webp",
]);

const EXT_MAP: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
  "image/webp": "webp",
};

const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const type = formData.get("type") as string | null; // "logo" or "favicon"

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "File type not allowed. Accepted: PNG, JPG, SVG, ICO, WebP" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 2MB" },
      { status: 400 }
    );
  }

  const ext = EXT_MAP[file.type] || "png";
  const prefix = type === "favicon" ? "favicon" : "logo";
  const filename = `${prefix}-${randomUUID()}.${ext}`;
  const dir = path.join(process.cwd(), "data", "branding");

  await mkdir(dir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), buffer);

  return NextResponse.json({
    url: `/api/branding/${filename}`,
    name: file.name,
  });
}
