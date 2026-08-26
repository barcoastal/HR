import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { parseUpload } from "@/lib/import-export/parse-file";

describe("parseUpload", () => {
  it("parses csv buffers", async () => {
    const r = await parseUpload(Buffer.from("First,Last\nAda,Lovelace\n", "utf8"), "people.csv");
    expect(r.fileType).toBe("csv");
    expect(r.headers).toEqual(["First", "Last"]);
    expect(r.rows).toEqual([["Ada", "Lovelace"]]);
  });

  it("parses the first sheet of an xlsx, formatting dates and skipping blank rows", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("People");
    ws.addRow(["First", "Last", "Start"]);
    ws.addRow(["Ada", "Lovelace", new Date(Date.UTC(2024, 2, 1))]);
    ws.addRow([]);
    ws.addRow(["Alan", "Turing", 45352]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const r = await parseUpload(buffer, "people.xlsx");
    expect(r.fileType).toBe("xlsx");
    expect(r.headers).toEqual(["First", "Last", "Start"]);
    expect(r.rows).toEqual([["Ada", "Lovelace", "2024-03-01"], ["Alan", "Turing", "45352"]]);
  });
});
