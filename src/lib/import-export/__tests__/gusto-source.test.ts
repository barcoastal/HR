import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GustoEmployee, GustoHomeAddress } from "@/lib/gusto";

const mocks = vi.hoisted(() => ({
  fetchGustoEmployees: vi.fn(),
  fetchGustoEmployeeHomeAddresses: vi.fn(),
  findUnique: vi.fn(),
  updateMany: vi.fn(),
}));

// gusto.ts and db.ts both open connections at import time; neither is wanted here.
vi.mock("@/lib/gusto", () => ({
  fetchGustoEmployees: mocks.fetchGustoEmployees,
  fetchGustoEmployeeHomeAddresses: mocks.fetchGustoEmployeeHomeAddresses,
}));
vi.mock("@/lib/db", () => ({
  db: {
    importBatch: { findUnique: mocks.findUnique },
    employee: { updateMany: mocks.updateMany },
  },
}));

import {
  buildGustoImportRows,
  gustoEmployeesToRows,
  linkGustoIds,
  GUSTO_ID_HEADER,
  GUSTO_IMPORT_HEADERS,
} from "@/lib/import-export/gusto-source";
import { autoDetectMapping } from "@/lib/import-export/employee-fields";

const person = (uuid: string, p: Partial<GustoEmployee> = {}): GustoEmployee => ({
  uuid,
  first_name: "First",
  last_name: "Last",
  email: `${uuid}@home.example`,
  jobs: [],
  terminated: false,
  ...p,
});

const col = (header: string) => GUSTO_IMPORT_HEADERS.indexOf(header as (typeof GUSTO_IMPORT_HEADERS)[number]);
const cell = (row: string[], header: string) => row[col(header)];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GUSTO_IMPORT_HEADERS", () => {
  it("auto-maps every column to a registry field except the Gusto ID", () => {
    const mapping = autoDetectMapping([...GUSTO_IMPORT_HEADERS]);
    expect(mapping).toEqual([
      "firstName", "middleName", "lastName", "preferredName",
      "email", "personalEmail", "phone",
      "jobTitle", "department", "manager",
      "startDate", "birthday",
      "address", "city", "state", "zipCode", "country",
      "skip",
    ]);
    expect(GUSTO_IMPORT_HEADERS[GUSTO_IMPORT_HEADERS.length - 1]).toBe(GUSTO_ID_HEADER);
  });
});

describe("gustoEmployeesToRows", () => {
  it("fills every column from the employee, primary job, manager and active address", () => {
    const boss = person("boss", { first_name: "Grace", last_name: "Hopper" });
    const ada = person("ada", {
      first_name: "Augusta",
      middle_initial: "A",
      last_name: "Lovelace",
      preferred_first_name: "Ada",
      email: "ada@home.example",
      work_email: "Ada@Corp.example",
      phone: "5551234567",
      date_of_birth: "1815-12-10",
      manager_uuid: "boss",
      department: "Engineering",
      jobs: [
        { title: "Old title", hire_date: "2010-01-01", primary: false },
        { title: "Analytical Engineer", hire_date: "2020-03-15", primary: true },
      ],
    });
    const addresses = new Map<string, GustoHomeAddress[]>([
      ["ada", [
        { street_1: "1 Old Rd", city: "Nowhere", state: "NY", zip: "00000", country: "USA", active: false },
        { street_1: "12 Analytical Way", street_2: "Apt 3", city: "London", state: "LDN", zip: "W1", country: "GBR", active: true },
      ]],
    ]);

    const { headers, rows, total, skippedTerminated } = gustoEmployeesToRows([boss, ada], addresses);
    expect(headers).toEqual([...GUSTO_IMPORT_HEADERS]);
    expect(total).toBe(2);
    expect(skippedTerminated).toBe(0);

    const row = rows.find((r) => cell(r, GUSTO_ID_HEADER) === "ada")!;
    expect(row).toHaveLength(headers.length);
    expect(cell(row, "First name")).toBe("Augusta");
    expect(cell(row, "Middle name")).toBe("A");
    expect(cell(row, "Last name")).toBe("Lovelace");
    expect(cell(row, "Preferred name")).toBe("Ada");
    expect(cell(row, "Email")).toBe("Ada@Corp.example");
    expect(cell(row, "Personal email")).toBe("ada@home.example");
    expect(cell(row, "Phone")).toBe("5551234567");
    expect(cell(row, "Job title")).toBe("Analytical Engineer");
    expect(cell(row, "Department")).toBe("Engineering");
    expect(cell(row, "Manager")).toBe("Grace Hopper");
    expect(cell(row, "Start date")).toBe("2020-03-15");
    expect(cell(row, "Birthday")).toBe("1815-12-10");
    expect(cell(row, "Address")).toBe("12 Analytical Way, Apt 3");
    expect(cell(row, "City")).toBe("London");
    expect(cell(row, "State")).toBe("LDN");
    expect(cell(row, "ZIP code")).toBe("W1");
    expect(cell(row, "Country")).toBe("GBR");
  });

  it("uses the home email as Email when there is no work email, and leaves Personal email blank", () => {
    const [row] = gustoEmployeesToRows([person("p", { email: "p@home.example" })], new Map()).rows;
    expect(cell(row, "Email")).toBe("p@home.example");
    expect(cell(row, "Personal email")).toBe("");
  });

  it("leaves Personal email blank when work and home emails are the same address", () => {
    const [row] = gustoEmployeesToRows(
      [person("p", { email: "p@corp.example", work_email: "P@corp.example" })],
      new Map(),
    ).rows;
    expect(cell(row, "Email")).toBe("P@corp.example");
    expect(cell(row, "Personal email")).toBe("");
  });

  it("drops a preferred name that merely repeats the first name", () => {
    const [row] = gustoEmployeesToRows([person("p", { first_name: "Sam", preferred_first_name: "sam" })], new Map()).rows;
    expect(cell(row, "Preferred name")).toBe("");
  });

  it("skips terminated people and counts them", () => {
    const { rows, total, skippedTerminated } = gustoEmployeesToRows(
      [person("a"), person("b", { terminated: true }), person("c", { terminated: true })],
      new Map(),
    );
    expect(rows.map((r) => cell(r, GUSTO_ID_HEADER))).toEqual(["a"]);
    expect(total).toBe(1);
    expect(skippedTerminated).toBe(2);
  });

  it("orders rows by last name, then first name", () => {
    const { rows } = gustoEmployeesToRows(
      [
        person("z", { first_name: "Zed", last_name: "Young" }),
        person("b", { first_name: "Bea", last_name: "Adams" }),
        person("a", { first_name: "Al", last_name: "Adams" }),
      ],
      new Map(),
    );
    expect(rows.map((r) => cell(r, GUSTO_ID_HEADER))).toEqual(["a", "b", "z"]);
  });

  it("tolerates the partial records the sandbox returns", () => {
    const sparse = {
      uuid: "sparse",
      first_name: "Only",
      last_name: "Names",
      email: null,
      jobs: undefined,
      terminated: undefined,
    } as unknown as GustoEmployee;
    const { rows } = gustoEmployeesToRows([sparse], new Map());
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(cell(row, "First name")).toBe("Only");
    expect(cell(row, "Email")).toBe("");
    expect(cell(row, "Job title")).toBe("");
    expect(cell(row, "Manager")).toBe("");
    expect(cell(row, "Address")).toBe("");
    expect(cell(row, GUSTO_ID_HEADER)).toBe("sparse");
  });

  it("falls back to the first address when none is flagged active", () => {
    const addresses = new Map<string, GustoHomeAddress[]>([
      ["p", [{ street_1: "First St", city: "A" }, { street_1: "Second St", city: "B" }]],
    ]);
    const [row] = gustoEmployeesToRows([person("p")], addresses).rows;
    expect(cell(row, "Address")).toBe("First St");
    expect(cell(row, "City")).toBe("A");
  });
});

describe("buildGustoImportRows", () => {
  it("fetches addresses only for active people, at most five at a time, and blanks the address on failure", async () => {
    const employees = [
      ...Array.from({ length: 12 }, (_, i) => person(`e${i}`, { first_name: `P${i}`, last_name: `L${String(i).padStart(2, "0")}` })),
      person("gone", { terminated: true }),
    ];
    mocks.fetchGustoEmployees.mockResolvedValue(employees);

    let inFlight = 0;
    let maxInFlight = 0;
    mocks.fetchGustoEmployeeHomeAddresses.mockImplementation(async (uuid: string) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 2));
      inFlight--;
      if (uuid === "e3") throw new Error("Gusto API error 500");
      return [{ street_1: `${uuid} street`, active: true }];
    });

    const { rows, total, skippedTerminated } = await buildGustoImportRows();

    expect(mocks.fetchGustoEmployeeHomeAddresses).toHaveBeenCalledTimes(12);
    expect(mocks.fetchGustoEmployeeHomeAddresses).not.toHaveBeenCalledWith("gone");
    expect(maxInFlight).toBeLessThanOrEqual(5);
    expect(maxInFlight).toBeGreaterThan(1);
    expect(total).toBe(12);
    expect(skippedTerminated).toBe(1);

    const byId = new Map(rows.map((r) => [cell(r, GUSTO_ID_HEADER), r]));
    expect(cell(byId.get("e0")!, "Address")).toBe("e0 street");
    expect(cell(byId.get("e3")!, "Address")).toBe("");
  });
});

describe("linkGustoIds", () => {
  it("stamps the Gusto ID from the raw row onto each person the commit produced", async () => {
    const headers = [...GUSTO_IMPORT_HEADERS];
    const raw = (uuid: string) => headers.map((h) => (h === GUSTO_ID_HEADER ? uuid : ""));
    mocks.findUnique.mockResolvedValue({
      headers,
      rows: [
        { raw: raw("g-1"), resultEmployeeId: "emp-1" },
        { raw: raw("g-2"), resultEmployeeId: "emp-2" },
        { raw: raw(""), resultEmployeeId: "emp-3" },
      ],
    });
    mocks.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 }); // emp-2 already linked elsewhere

    await expect(linkGustoIds("batch")).resolves.toBe(1);

    expect(mocks.updateMany).toHaveBeenCalledTimes(2);
    expect(mocks.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: "emp-1", gustoEmployeeId: null },
      data: { gustoEmployeeId: "g-1" },
    });
  });

  it("ignores a uuid that is already linked to someone else and keeps going", async () => {
    const headers = [...GUSTO_IMPORT_HEADERS];
    const raw = (uuid: string) => headers.map((h) => (h === GUSTO_ID_HEADER ? uuid : ""));
    mocks.findUnique.mockResolvedValue({
      headers,
      rows: [
        { raw: raw("dup"), resultEmployeeId: "emp-1" },
        { raw: raw("fresh"), resultEmployeeId: "emp-2" },
      ],
    });
    mocks.updateMany
      .mockRejectedValueOnce(Object.assign(new Error("Unique constraint failed"), { code: "P2002" }))
      .mockResolvedValueOnce({ count: 1 });

    await expect(linkGustoIds("batch")).resolves.toBe(1);
    expect(mocks.updateMany).toHaveBeenCalledTimes(2);
  });

  it("does nothing for a batch without a Gusto ID column", async () => {
    mocks.findUnique.mockResolvedValue({ headers: ["First name", "Last name"], rows: [{ raw: ["A", "B"], resultEmployeeId: "emp-1" }] });
    await expect(linkGustoIds("batch")).resolves.toBe(0);
    expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});
