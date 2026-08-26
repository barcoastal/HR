import { describe, it, expect } from "vitest";
import { toCsv } from "@/lib/import-export/to-csv";

const BOM = "﻿";

describe("toCsv", () => {
  it("starts with a UTF-8 BOM and writes the header row", () => {
    const out = toCsv(["First", "Last"], []);
    expect(out.startsWith(BOM)).toBe(true);
    expect(out).toBe(`${BOM}First,Last\r\n`);
  });

  it("writes one CRLF-terminated line per row with plain fields untouched", () => {
    const out = toCsv(["A", "B"], [["1", "2"], ["x", "y"]]);
    expect(out).toBe(`${BOM}A,B\r\n1,2\r\nx,y\r\n`);
    // no bare LF anywhere
    expect(out.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("quotes fields containing commas", () => {
    const out = toCsv(["Name"], [["Lovelace, Ada"]]);
    expect(out).toBe(`${BOM}Name\r\n"Lovelace, Ada"\r\n`);
  });

  it("escapes embedded quotes by doubling them and wraps the field", () => {
    const out = toCsv(["Bio"], [['Said "hi"']]);
    expect(out).toBe(`${BOM}Bio\r\n"Said ""hi"""\r\n`);
  });

  it("quotes fields containing LF or CR", () => {
    const out = toCsv(["Notes"], [["line one\nline two"], ["a\r\nb"]]);
    expect(out).toBe(`${BOM}Notes\r\n"line one\nline two"\r\n"a\r\nb"\r\n`);
  });

  it("quotes headers using the same rules", () => {
    const out = toCsv(['Say "what", now'], [["v"]]);
    expect(out).toBe(`${BOM}"Say ""what"", now"\r\nv\r\n`);
  });

  it("renders null and undefined as empty fields", () => {
    const out = toCsv(["A", "B", "C"], [[null, undefined, "x"], ["y", null, undefined]]);
    expect(out).toBe(`${BOM}A,B,C\r\n,,x\r\ny,,\r\n`);
  });

  it("renders numbers as-is, including zero and decimals", () => {
    const out = toCsv(["N", "F"], [[0, 1.5], [42, -3]]);
    expect(out).toBe(`${BOM}N,F\r\n0,1.5\r\n42,-3\r\n`);
  });

  it("leaves fields with only spaces or other punctuation unquoted", () => {
    const out = toCsv(["A"], [["hello world"], ["a;b"], ["tab\there"]]);
    expect(out).toBe(`${BOM}A\r\nhello world\r\na;b\r\ntab\there\r\n`);
  });
});
