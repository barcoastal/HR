import { EMPLOYEE_FIELDS } from "./employee-fields";
import type { ColumnMapping, FieldKey, RowData, RowError } from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(s: string): boolean {
  return EMAIL_RE.test(s.trim());
}

/** Lowercased, Gmail-style dots/+tags stripped; "" when not an address or a pending placeholder. */
export function normalizeEmail(raw: string | null | undefined): string {
  if (!raw) return "";
  const email = raw.trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return "";
  const [local, domain] = email.split("@");
  if (domain === "pending.local") return "";
  const cleaned = local.replace(/\./g, "").split("+")[0];
  return `${cleaned}@${domain}`;
}

/** Last ten digits, or "" when there are fewer than ten. */
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

/** Stored form of a phone: digits with an optional leading "+". */
export function cleanPhone(raw: string): string {
  const trimmed = raw.trim();
  const plus = trimmed.startsWith("+") ? "+" : "";
  return plus + trimmed.replace(/\D/g, "");
}

export function normalizeName(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Unordered "a|b" keys for first+last and preferred+last. */
export function nameKeys(first: string | null | undefined, last: string | null | undefined, preferred?: string | null): string[] {
  const l = normalizeName(last);
  if (!l) return [];
  const keys: string[] = [];
  const f = normalizeName(first);
  if (f) keys.push([f, l].sort().join("|"));
  const p = normalizeName(preferred);
  if (p && p !== f) keys.push([p, l].sort().join("|"));
  return keys;
}

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function ymd(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y.toString().padStart(4, "0")}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}`;
}

function fullYear(y: number): number {
  if (y >= 100) return y;
  return y < 70 ? 2000 + y : 1900 + y;
}

/** Accepts ISO, M/D/YYYY, M/D/YY, "Month D, YYYY", "D Month YYYY" and Excel serials → "YYYY-MM-DD". */
export function parseDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (m) return ymd(+m[1], +m[2], +m[3]);

  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) return ymd(fullYear(+m[3]), +m[1], +m[2]);

  m = s.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m && MONTHS[m[1].toLowerCase()]) return ymd(+m[3], MONTHS[m[1].toLowerCase()], +m[2]);

  m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\.?,?\s+(\d{4})$/);
  if (m && MONTHS[m[2].toLowerCase()]) return ymd(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);

  if (/^\d{4,6}$/.test(s)) {
    const serial = +s;
    if (serial > 0 && serial < 200000) {
      const epoch = Date.UTC(1899, 11, 30);
      const d = new Date(epoch + serial * 86400000);
      return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }
  }
  return null;
}

/** Collect mapped, non-empty cells. When two columns feed one field the first non-empty wins. */
export function applyMapping(raw: string[], mapping: ColumnMapping): RowData {
  const data: RowData = {};
  mapping.forEach((field, i) => {
    if (field === "skip") return;
    const value = (raw[i] ?? "").trim();
    if (!value) return;
    if (data[field] === undefined) data[field] = value;
  });
  return data;
}

/** Cleans every field by type and reports problems. Invalid values are dropped from `data`. */
export function validateRow(input: RowData): { data: RowData; errors: RowError[] } {
  const data: RowData = {};
  const errors: RowError[] = [];

  for (const field of EMPLOYEE_FIELDS) {
    const key = field.key as FieldKey;
    const value = (input[key] ?? "").trim();
    if (!value) {
      if (field.required) errors.push({ field: key, message: `${field.label} is required` });
      continue;
    }
    switch (field.type) {
      case "email": {
        const email = value.toLowerCase();
        if (!isValidEmail(email)) errors.push({ field: key, message: "Not a valid email address" });
        else data[key] = email;
        break;
      }
      case "phone": {
        const phone = cleanPhone(value);
        if (phone.replace(/\D/g, "").length < 7) errors.push({ field: key, message: "Not a valid phone number" });
        else data[key] = phone;
        break;
      }
      case "date": {
        const date = parseDate(value);
        if (!date) errors.push({ field: key, message: "Unrecognized date" });
        else data[key] = date;
        break;
      }
      case "enum": {
        const upper = value.toUpperCase().replace(/[\s-]+/g, "_");
        const allowed = field.enumValues ?? [];
        if (!allowed.includes(upper)) errors.push({ field: key, message: `${field.label} must be one of ${allowed.join(", ")}` });
        else data[key] = upper;
        break;
      }
      default:
        data[key] = value;
    }
  }
  return { data, errors };
}
