import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireApiAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(request: NextRequest) {
  const session = await requireApiAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "File type not allowed. Accepted: png, jpg, webp" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 5MB" },
      { status: 400 }
    );
  }

  const filename = `${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await db.fileBlob.create({
    data: {
      filename,
      mimeType: file.type,
      size: buffer.length,
      data: buffer,
    },
  });

  return NextResponse.json({
    url: `/api/onboarding-docs/${filename}`,
    name: file.name,
  });
}
