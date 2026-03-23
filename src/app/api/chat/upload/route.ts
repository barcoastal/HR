import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth-helpers";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const MAX_SIZE = 25 * 1024 * 1024; // 25MB

export async function POST(req: NextRequest) {
  const session = await requireApiAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large. Maximum 25MB" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const uploadDir = path.join(process.cwd(), "data", "chat-uploads");
  await mkdir(uploadDir, { recursive: true });

  const ext = path.extname(file.name) || "";
  const filename = `${randomUUID()}${ext}`;
  await writeFile(path.join(uploadDir, filename), buffer);

  return NextResponse.json({
    url: `/api/chat/files/${filename}`,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
  });
}
