"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { countExportRows } from "@/lib/import-export/export-loaders";
import { isExportEntityKey, type ExportEntityKey } from "@/lib/import-export/export-registry";

export type ExportOption = { value: string; label: string };
export type ExportOptions = { departments: ExportOption[]; positions: ExportOption[] };

async function requireExportAccess() {
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN" && role !== "HR") throw new Error("Forbidden");
  return session;
}

/** Choices for the registry's `optionsFrom` filters (department for People, position for Candidates). */
export async function getExportOptions(): Promise<ExportOptions> {
  await requireExportAccess();
  const [departments, positions] = await Promise.all([
    db.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.position.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);
  return {
    departments: departments.map((d) => ({ value: d.id, label: d.name })),
    positions: positions.map((p) => ({ value: p.id, label: p.title })),
  };
}

/** Live "N rows match" for the builder. Same `where` the download will use. */
export async function previewExportCount(entity: ExportEntityKey, filters: Record<string, string>): Promise<number> {
  await requireExportAccess();
  if (!isExportEntityKey(entity)) throw new Error("Unknown export entity");
  return countExportRows(entity, filters);
}
