import ExcelJS from "exceljs";
import { parseCsv } from "./parse-csv";

export type ParsedUpload = { fileType: "csv" | "xlsx"; headers: string[]; rows: string[][] };

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const v = value as unknown as Record<string, unknown>;
    if (Array.isArray(v.richText)) return (v.richText as { text: string }[]).map((t) => t.text).join("");
    if ("text" in v) return String(v.text ?? "");
    if ("result" in v) return cellToString(v.result as ExcelJS.CellValue);
    if ("error" in v) return "";
    return String(value);
  }
  return String(value);
}

async function parseXlsx(buffer: Buffer): Promise<{ headers: string[]; rows: string[][] }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return { headers: [], rows: [] };
  const all: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as ExcelJS.CellValue[];
    all.push(values.slice(1).map(cellToString).map((s) => s.trim()));
  });
  const headers = all.shift() ?? [];
  while (headers.length && headers[headers.length - 1] === "") headers.pop();
  const width = headers.length;
  const rows = all
    .filter((r) => r.some((c) => c !== ""))
    .map((r) => { const out = r.slice(0, width); while (out.length < width) out.push(""); return out; });
  return { headers, rows };
}

/** Sniff CSV vs XLSX (zip magic or extension) and return headers + string rows. */
export async function parseUpload(buffer: Buffer, fileName: string): Promise<ParsedUpload> {
  const isZip = buffer.length > 1 && buffer[0] === 0x50 && buffer[1] === 0x4b;
  if (isZip || fileName.toLowerCase().endsWith(".xlsx")) {
    const { headers, rows } = await parseXlsx(buffer);
    return { fileType: "xlsx", headers, rows };
  }
  const { headers, rows } = parseCsv(buffer.toString("utf8"));
  return { fileType: "csv", headers, rows };
}
