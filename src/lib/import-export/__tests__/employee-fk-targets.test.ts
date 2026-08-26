import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { EMPLOYEE_FK_TARGETS } from "@/lib/import-export/employee-fk-targets";

type Fk = { model: string; field: string; nullable: boolean };

/** Every `field Employee[?] @relation(fields: [x], …)` line in the schema, model by model. */
function employeeForeignKeysFromSchema(): Fk[] {
  const schema = readFileSync(path.resolve(__dirname, "../../../../prisma/schema.prisma"), "utf8");
  const out: Fk[] = [];
  const modelRe = /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g;
  let m: RegExpExecArray | null;
  while ((m = modelRe.exec(schema))) {
    const [, model, body] = m;
    for (const raw of body.split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("//")) continue;
      const rel = line.match(/^\w+\s+Employee(\?)?\s+@relation\(([^)]*)\)/);
      if (!rel) continue;
      const fields = rel[2].match(/fields:\s*\[(\w+)\]/);
      if (!fields) continue;
      out.push({ model, field: fields[1], nullable: rel[1] === "?" });
    }
  }
  return out;
}

const byName = (a: Fk, b: Fk) => `${a.model}.${a.field}`.localeCompare(`${b.model}.${b.field}`);

describe("EMPLOYEE_FK_TARGETS", () => {
  it("lists exactly the employee foreign keys declared in prisma/schema.prisma", () => {
    const expected = employeeForeignKeysFromSchema().sort(byName);
    const actual = EMPLOYEE_FK_TARGETS.map(({ model, field, nullable }) => ({ model, field, nullable })).sort(byName);
    expect(actual).toEqual(expected);
    expect(actual).toHaveLength(49);
  });

  it("names the Prisma delegate for every model (lower-camel model name)", () => {
    for (const t of EMPLOYEE_FK_TARGETS) {
      expect(t.delegate).toBe(t.model.charAt(0).toLowerCase() + t.model.slice(1));
    }
  });

  it("has no duplicate entries", () => {
    const keys = EMPLOYEE_FK_TARGETS.map((t) => `${t.model}.${t.field}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
