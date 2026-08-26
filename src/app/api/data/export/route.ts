import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireApiAdmin } from "@/lib/auth-helpers";
import { audit } from "@/lib/audit";
import { toCsv } from "@/lib/import-export/to-csv";
import { loadExportRows } from "@/lib/import-export/export-loaders";
import {
  EXPORT_BY_KEY,
  defaultColumnKeys,
  filterParamKeys,
  isExportEntityKey,
  isExportFormat,
  sanitizeExportFilters,
  type ExportColumn,
} from "@/lib/import-export/export-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPES = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

/**
 * GET /api/data/export?entity=people&columns=firstName,lastName&format=csv&status=ACTIVE
 *
 * Every entity, column and filter is checked against the export registry,
 * so the URL can't ask for anything the builder doesn't expose. Columns
 * default to the registry's default set when omitted.
 */
export async function GET(req: Request) {
  const session = await requireApiAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const params = new URL(req.url).searchParams;

  const entity = params.get("entity");
  if (!isExportEntityKey(entity)) return NextResponse.json({ error: "Unknown entity" }, { status: 400 });
  const def = EXPORT_BY_KEY[entity];

  const format = params.get("format") ?? "csv";
  if (!isExportFormat(format)) return NextResponse.json({ error: "Format must be csv or xlsx" }, { status: 400 });

  const columnsParam = params.get("columns");
  const requestedKeys = columnsParam
    ? columnsParam.split(",").map((k) => k.trim()).filter(Boolean)
    : defaultColumnKeys(def);
  const byKey = new Map(def.columns.map((c) => [c.key, c]));
  const unknown = requestedKeys.find((k) => !byKey.has(k));
  if (unknown !== undefined) return NextResponse.json({ error: `Unknown column: ${unknown}` }, { status: 400 });
  // Emit in registry order, de-duplicated, regardless of how the URL listed them.
  const requested = new Set(requestedKeys);
  const columns: ExportColumn[] = def.columns.filter((c) => requested.has(c.key));
  if (columns.length === 0) return NextResponse.json({ error: "Choose at least one column" }, { status: 400 });

  const rawFilters: Record<string, string> = {};
  for (const filter of def.filters) {
    for (const key of filterParamKeys(filter)) {
      const v = params.get(key);
      if (v) rawFilters[key] = v;
    }
  }
  const filters = sanitizeExportFilters(entity, rawFilters);

  const rows = await loadExportRows(entity, filters);
  const headers = columns.map((c) => c.label);
  const data = rows.map((row) => columns.map((c) => row[c.key] ?? null));

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `${entity}-${stamp}.${format}`;

  let body: BodyInit;
  if (format === "csv") {
    body = toCsv(headers, data);
  } else {
    const wb = new ExcelJS.Workbook();
    wb.creator = "HR";
    wb.created = new Date();
    const ws = wb.addWorksheet(def.label.slice(0, 31)); // Excel caps sheet names at 31 chars
    ws.columns = columns.map((c) => ({ header: c.label, key: c.key, width: Math.min(40, Math.max(12, c.label.length + 4)) }));
    ws.addRows(data);
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
    const buffer = await wb.xlsx.writeBuffer();
    body = new Uint8Array(buffer as ArrayBuffer);
  }

  await audit({
    action: "data.exported",
    entityType: "export",
    entityId: entity,
    details: { entity, format, filters, columns: columns.length, rows: rows.length },
  });

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": CONTENT_TYPES[format],
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
