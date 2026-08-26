import { describe, it, expect } from "vitest";
import { parseCsv } from "@/lib/import-export/parse-csv";

describe("parseCsv", () => {
  it("parses a simple comma file", () => {
    const r = parseCsv("First,Last\nAda,Lovelace\nAlan,Turing\n");
    expect(r.headers).toEqual(["First", "Last"]);
    expect(r.rows).toEqual([["Ada", "Lovelace"], ["Alan", "Turing"]]);
  });
  it("handles quoted fields with commas, escaped quotes and embedded newlines", () => {
    const r = parseCsv('Name,Bio\n"Lovelace, Ada","Said ""hi""\nthen left"\n');
    expect(r.rows).toEqual([["Lovelace, Ada", 'Said "hi"\nthen left']]);
  });
  it("strips a BOM and accepts CRLF", () => {
    const r = parseCsv("﻿A,B\r\n1,2\r\n");
    expect(r.headers).toEqual(["A", "B"]);
    expect(r.rows).toEqual([["1", "2"]]);
  });
  it("auto-detects semicolon and tab delimiters", () => {
    expect(parseCsv("A;B\n1;2\n").rows).toEqual([["1", "2"]]);
    expect(parseCsv("A\tB\n1\t2\n").rows).toEqual([["1", "2"]]);
  });
  it("drops blank rows and pads short rows", () => {
    const r = parseCsv("A,B,C\n1,2\n\n,,\n4,5,6,7\n");
    expect(r.rows).toEqual([["1", "2", ""], ["4", "5", "6"]]);
  });
  it("returns empty for empty input", () => {
    expect(parseCsv("")).toEqual({ headers: [], rows: [] });
  });
});
