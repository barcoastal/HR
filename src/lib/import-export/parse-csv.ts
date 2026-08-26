function detectDelimiter(firstLine: string): string {
  const candidates = [",", ";", "\t"];
  let best = ",";
  let bestCount = -1;
  for (const d of candidates) {
    const count = firstLine.split(d).length - 1;
    if (count > bestCount) { best = d; bestCount = count; }
  }
  return best;
}

function splitRecords(text: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === delimiter) { record.push(field); field = ""; continue; }
    if (ch === "\r") { continue; }
    if (ch === "\n") { record.push(field); records.push(record); record = []; field = ""; continue; }
    field += ch;
  }
  if (field.length > 0 || record.length > 0) { record.push(field); records.push(record); }
  return records;
}

export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const cleaned = text.replace(/^﻿/, "");
  if (!cleaned.trim()) return { headers: [], rows: [] };
  const firstLine = cleaned.split(/\r?\n/, 1)[0];
  const delimiter = detectDelimiter(firstLine);
  const records = splitRecords(cleaned, delimiter);
  const headers = (records.shift() ?? []).map((h) => h.trim());
  const width = headers.length;
  const rows = records
    .map((r) => r.map((c) => c.trim()))
    .filter((r) => r.some((c) => c !== ""))
    .map((r) => {
      const out = r.slice(0, width);
      while (out.length < width) out.push("");
      return out;
    });
  return { headers, rows };
}
