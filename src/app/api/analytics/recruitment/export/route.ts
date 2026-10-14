import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getRecruiterScope, requireApiAuth } from "@/lib/auth-helpers";
import { audit } from "@/lib/audit";
import { toCsv } from "@/lib/import-export/to-csv";
import { buildReportTables, isReportTableKey, parseMetricsFilters, toIsoDay } from "@/lib/recruitment-metrics";
import { loadRecruitmentMetrics } from "@/lib/recruitment-metrics-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Same roles as the Analytics pages (requireManagerOrAdmin).
const ANALYTICS_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "HR", "MANAGER"]);

const CONTENT_TYPES = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

/**
 * GET /api/analytics/recruitment/export?format=xlsx&range=90d&source=…
 * GET /api/analytics/recruitment/export?format=csv&table=funnel&range=ytd
 *
 * Downloads the Recruitment analytics report for the same filters the page
 * uses: every table as one XLSX sheet, or a single table as CSV. Scoped
 * recruiters only ever get their own candidates.
 */
export async function GET(req: Request) {
  const session = await requireApiAuth();
  if (!session || !ANALYTICS_ROLES.has(session.user?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const params = Object.fromEntries(url.searchParams);
  const format = params.format ?? "xlsx";
  if (format !== "csv" && format !== "xlsx") {
    return NextResponse.json({ error: "Format must be csv or xlsx" }, { status: 400 });
  }
  const table = params.table;
  if (format === "csv" && !isReportTableKey(table)) {
    return NextResponse.json({ error: "Choose a table to export as CSV" }, { status: 400 });
  }

  const filters = parseMetricsFilters(params);
  const scope = await getRecruiterScope();
  const { metrics, labels } = await loadRecruitmentMetrics(filters, scope);
  const tables = buildReportTables(metrics, labels);

  const stamp = `${toIsoDay(metrics.filters.from)}_to_${toIsoDay(metrics.filters.to)}`;
  let body: BodyInit;
  let filename: string;

  if (format === "csv") {
    const t = tables.find((x) => x.key === table)!;
    body = toCsv(t.headers, t.rows);
    filename = `recruitment-${t.key}-${stamp}.csv`;
  } else {
    const wb = new ExcelJS.Workbook();
    wb.creator = "HR";
    wb.created = new Date();
    for (const t of tables) {
      const ws = wb.addWorksheet(t.title.slice(0, 31)); // Excel caps sheet names at 31 chars
      ws.columns = t.headers.map((h, i) => ({
        header: h,
        key: `c${i}`,
        width: i === 0 && t.key === "summary" ? 48 : Math.min(40, Math.max(12, h.length + 4)),
      }));
      ws.addRows(t.rows);
      ws.getRow(1).font = { bold: true };
      ws.views = [{ state: "frozen", ySplit: 1 }];
      if (t.key !== "summary" && t.headers.length > 0) {
        ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: t.headers.length } };
      }
    }
    const buffer = await wb.xlsx.writeBuffer();
    body = new Uint8Array(buffer as ArrayBuffer);
    filename = `recruitment-report-${stamp}.xlsx`;
  }

  await audit({
    action: "data.exported",
    entityType: "export",
    entityId: "recruitment-report",
    details: {
      entity: "recruitment-report",
      format,
      table: format === "csv" ? table : "all",
      filters: Object.fromEntries(new URLSearchParams(url.searchParams)),
      scopedToRecruiter: !!scope,
    },
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
