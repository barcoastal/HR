import { buildGustoImportRows, gustoRowsToPeople } from "@/lib/import-export/gusto-source";
import type { GustoPerson } from "./types";

export type GustoPeopleSnapshot = { people: GustoPerson[]; fetchedAt: string };

const TTL_MS = 5 * 60 * 1000;

let cache: { promise: Promise<GustoPeopleSnapshot>; at: number } | null = null;

/**
 * Everyone in Gusto (home addresses included) as import-shaped row data. The pull is one request
 * per person for addresses, so it is kept in module memory for five minutes — paging through
 * people or opening a few profiles reuses one fetch. Concurrent callers share the in-flight promise;
 * a failed pull is dropped so the next caller retries.
 */
export function loadGustoPeople(): Promise<GustoPeopleSnapshot> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.promise;

  const promise = buildGustoImportRows().then((grid) => ({
    people: gustoRowsToPeople(grid),
    fetchedAt: new Date().toISOString(),
  }));
  const entry = { promise, at: now };
  cache = entry;
  promise.catch(() => {
    if (cache === entry) cache = null;
  });
  return promise;
}

export function clearGustoPeopleCache(): void {
  cache = null;
}
