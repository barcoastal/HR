import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { requireApiAuth } from "@/lib/auth-helpers";
import { db } from "@/lib/db";

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".zip": "application/zip",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const session = await requireApiAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const callerEmployeeId = session.user?.employeeId ?? null;
  const callerRole = session.user?.role;
  const isAdmin = callerRole === "SUPER_ADMIN" || callerRole === "ADMIN";

  const { filename } = await params;

  // Prevent path traversal
  const safeName = path.basename(filename);
  const filepath = path.join(process.cwd(), "data", "chat-uploads", safeName);

  // Verify the caller is a member of the channel/DM where this file was
  // posted. The attachment URL stored on the message is
  // /api/chat/files/{filename}, so we look it up by URL.
  if (!isAdmin) {
    if (!callerEmployeeId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const attachment = await db.chatAttachment.findFirst({
      where: { url: { endsWith: `/${safeName}` } },
      select: {
        message: { select: { channelId: true, dmThreadId: true } },
      },
    });
    if (!attachment?.message) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { channelId, dmThreadId } = attachment.message;
    let isMember = false;
    if (channelId) {
      const member = await db.channelMember.findFirst({
        where: { channelId, employeeId: callerEmployeeId },
        select: { id: true },
      });
      isMember = !!member;
      if (!isMember) {
        const channel = await db.channel.findUnique({
          where: { id: channelId },
          select: { isPrivate: true },
        });
        if (channel && !channel.isPrivate) isMember = true;
      }
    } else if (dmThreadId) {
      const dm = await db.dmMember.findFirst({
        where: { dmThreadId, employeeId: callerEmployeeId },
        select: { id: true },
      });
      isMember = !!dm;
    }
    if (!isMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    const buffer = await readFile(filepath);
    const ext = path.extname(safeName).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
