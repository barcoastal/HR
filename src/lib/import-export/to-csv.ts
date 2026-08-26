/**
 * RFC 4180 CSV writer.
 *
 * - Fields are separated by commas and records by CRLF (every record,
 *   including the last, is terminated).
 * - A field is wrapped in double quotes when it contains a comma, a double
 *   quote, CR or LF; embedded quotes are doubled.
 * - The output starts with a UTF-8 BOM so Excel opens it with the right
 *   encoding without an import wizard.
 * - `null` / `undefined` become empty fields; numbers are written as-is.
 */

export type CsvCell = string | number | null | undefined;

const BOM = "﻿";
const NEEDS_QUOTING = /[",\r\n]/;

function escapeCell(cell: CsvCell): string {
  if (cell === null || cell === undefined) return "";
  const s = typeof cell === "number" ? String(cell) : cell;
  return NEEDS_QUOTING.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function formatRecord(cells: CsvCell[]): string {
  return cells.map(escapeCell).join(",") + "\r\n";
}

export function toCsv(headers: string[], rows: CsvCell[][]): string {
  let out = BOM + formatRecord(headers);
  for (const row of rows) out += formatRecord(row);
  return out;
}
