import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/auth-helpers";
import { parseUpload } from "@/lib/import-export/parse-file";
import { createBatchFromUpload, rebuildBatchRows } from "@/lib/import-export/batch-service";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await requireApiAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  const name = file.name.toLowerCase();
  if (!name.endsWith(".csv") && !name.endsWith(".xlsx")) {
    return NextResponse.json({ error: "Only .csv and .xlsx files are supported" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let parsed;
  try {
    parsed = await parseUpload(buffer, file.name);
  } catch (err) {
    console.error("[imports] parse failed", err);
    return NextResponse.json({ error: "Could not read that file" }, { status: 400 });
  }
  if (parsed.headers.length === 0) return NextResponse.json({ error: "The file has no header row" }, { status: 400 });
  if (parsed.rows.length === 0) return NextResponse.json({ error: "The file has no data rows" }, { status: 400 });

  const id = await createBatchFromUpload({ ...parsed, fileName: file.name, uploadedById: session.user.id });
  await rebuildBatchRows(id);
  return NextResponse.json({ id });
}
