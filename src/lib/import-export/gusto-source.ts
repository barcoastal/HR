import { db } from "@/lib/db";
import {
  fetchGustoEmployeeHomeAddresses,
  fetchGustoEmployees,
  type GustoEmployee,
  type GustoHomeAddress,
} from "@/lib/gusto";
import type { GustoPerson } from "@/lib/gusto-sync/types";
import { autoDetectMapping } from "./employee-fields";
import { applyMapping, validateRow } from "./normalize";

/**
 * Column carrying the Gusto employee uuid. It is not a registry field, so autoDetectMapping sends it
 * to "skip"; linkGustoIds reads it back from the raw rows after the batch is committed.
 */
export const GUSTO_ID_HEADER = "Gusto ID";

/** Registry labels, verbatim, so every column auto-maps without the admin touching the mapping step. */
export const GUSTO_IMPORT_HEADERS = [
  "First name", "Middle name", "Last name", "Preferred name",
  "Email", "Personal email", "Phone",
  "Job title", "Department", "Manager",
  "Start date", "Birthday",
  "Address", "City", "State", "ZIP code", "Country",
  GUSTO_ID_HEADER,
] as const;

export type GustoImportRows = {
  headers: string[];
  rows: string[][];
  /** Rows produced — everyone in Gusto who is not terminated. */
  total: number;
  /** Terminated people left out of the batch. */
  skippedTerminated: number;
};

const ADDRESS_CONCURRENCY = 5;

const clean = (value: string | null | undefined): string => (value ?? "").trim();

function fullName(e: GustoEmployee): string {
  return `${clean(e.first_name)} ${clean(e.last_name)}`.trim();
}

function primaryJob(e: GustoEmployee) {
  const jobs = Array.isArray(e.jobs) ? e.jobs : [];
  return jobs.find((j) => j.primary) ?? jobs[0];
}

function activeAddress(list: GustoHomeAddress[] | undefined): GustoHomeAddress | undefined {
  if (!list || list.length === 0) return undefined;
  return list.find((a) => a.active) ?? list[0];
}

function streetLine(address: GustoHomeAddress | undefined): string {
  if (!address) return "";
  const street1 = clean(address.street_1);
  const street2 = clean(address.street_2);
  return street1 && street2 ? `${street1}, ${street2}` : street1 || street2;
}

function byLastThenFirst(a: GustoEmployee, b: GustoEmployee): number {
  return clean(a.last_name).localeCompare(clean(b.last_name)) || clean(a.first_name).localeCompare(clean(b.first_name));
}

/**
 * Pure: Gusto people plus their home addresses → the header/row grid an import batch stores.
 * Terminated people are dropped and counted; everything else tolerates missing fields.
 */
export function gustoEmployeesToRows(
  employees: GustoEmployee[],
  addresses: Map<string, GustoHomeAddress[]>,
): GustoImportRows {
  const byUuid = new Map(employees.map((e) => [e.uuid, e]));
  const active = employees.filter((e) => !e.terminated).sort(byLastThenFirst);

  const rows = active.map((e): string[] => {
    const workEmail = clean(e.work_email);
    const homeEmail = clean(e.email);
    const email = workEmail || homeEmail;
    const personalEmail = workEmail && homeEmail && workEmail.toLowerCase() !== homeEmail.toLowerCase() ? homeEmail : "";

    const firstName = clean(e.first_name);
    const preferred = clean(e.preferred_first_name);
    const preferredName = preferred.toLowerCase() === firstName.toLowerCase() ? "" : preferred;

    const manager = e.manager_uuid ? byUuid.get(e.manager_uuid) : undefined;
    const job = primaryJob(e);
    const address = activeAddress(addresses.get(e.uuid));

    return [
      firstName,
      clean(e.middle_initial),
      clean(e.last_name),
      preferredName,
      email,
      personalEmail,
      clean(e.phone),
      clean(job?.title),
      clean(e.department),
      manager ? fullName(manager) : "",
      clean(job?.hire_date),
      clean(e.date_of_birth),
      streetLine(address),
      clean(address?.city),
      clean(address?.state),
      clean(address?.zip),
      clean(address?.country),
      e.uuid,
    ];
  });

  return {
    headers: [...GUSTO_IMPORT_HEADERS],
    rows,
    total: rows.length,
    skippedTerminated: employees.length - active.length,
  };
}

/**
 * Pure: the import grid as per-person row data, run through the same auto-mapping and cleaning an
 * uploaded Gusto batch gets (lowercased emails, digit-only phones, ISO dates), keyed by Gusto uuid.
 * Values the cleaner rejects are dropped, exactly as they would be in an import.
 */
export function gustoRowsToPeople(grid: GustoImportRows): GustoPerson[] {
  const mapping = autoDetectMapping(grid.headers);
  const idColumn = grid.headers.indexOf(GUSTO_ID_HEADER);
  const people: GustoPerson[] = [];
  for (const raw of grid.rows) {
    const gustoId = idColumn >= 0 ? clean(raw[idColumn]) : "";
    if (!gustoId) continue;
    people.push({ gustoId, data: validateRow(applyMapping(raw, mapping)).data });
  }
  return people;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Everyone in Gusto as import rows. Home addresses need one request per person, so they are
 * fetched with a small concurrency cap; a person whose addresses cannot be read simply gets
 * blank address columns rather than failing the whole pull.
 */
export async function buildGustoImportRows(): Promise<GustoImportRows> {
  const fetched = await fetchGustoEmployees();
  const employees = Array.isArray(fetched) ? fetched : [];
  const active = employees.filter((e) => !e.terminated);

  const addressLists = await mapWithConcurrency(active, ADDRESS_CONCURRENCY, async (e) => {
    try {
      return await fetchGustoEmployeeHomeAddresses(e.uuid);
    } catch (err) {
      console.warn(`[gusto import] home addresses unavailable for ${e.uuid}:`, err instanceof Error ? err.message : err);
      return [] as GustoHomeAddress[];
    }
  });
  const addresses = new Map(active.map((e, i) => [e.uuid, addressLists[i]]));

  return gustoEmployeesToRows(employees, addresses);
}

/**
 * After a Gusto batch is committed, stamp each person it created or updated with the uuid from
 * the "Gusto ID" column so payroll can be linked later. People already linked keep their id, and
 * a uuid that is already linked to someone else (unique violation) is skipped. Returns how many
 * people were linked.
 */
export async function linkGustoIds(batchId: string): Promise<number> {
  const batch = await db.importBatch.findUnique({
    where: { id: batchId },
    select: {
      headers: true,
      rows: { where: { resultEmployeeId: { not: null } }, select: { raw: true, resultEmployeeId: true } },
    },
  });
  if (!batch) return 0;
  const column = (batch.headers as string[]).indexOf(GUSTO_ID_HEADER);
  if (column < 0) return 0;

  let linked = 0;
  for (const row of batch.rows) {
    const gustoId = clean((row.raw as string[])[column]);
    if (!gustoId || !row.resultEmployeeId) continue;
    try {
      const { count } = await db.employee.updateMany({
        where: { id: row.resultEmployeeId, gustoEmployeeId: null },
        data: { gustoEmployeeId: gustoId },
      });
      linked += count;
    } catch (err) {
      if ((err as { code?: string } | null)?.code === "P2002") continue;
      throw err;
    }
  }
  return linked;
}
