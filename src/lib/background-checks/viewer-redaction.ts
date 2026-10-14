// Server-only: strip Candidate background-check / adverse-action fields for
// anyone but a Super Admin before a candidate record leaves the server
// (server action return values, API responses, props to client components).

import { getSession } from "@/lib/auth-helpers";
import { redactBackgroundCheck } from "@/lib/document-access";

async function viewerRole(): Promise<string | null> {
  return (await getSession())?.user?.role ?? null;
}

export async function redactCandidateForViewer<T extends object>(candidate: T): Promise<T>;
export async function redactCandidateForViewer<T extends object>(candidate: T | null): Promise<T | null>;
export async function redactCandidateForViewer<T extends object>(candidate: T | null): Promise<T | null> {
  if (!candidate) return candidate;
  return redactBackgroundCheck(candidate, await viewerRole());
}

export async function redactCandidatesForViewer<T extends object>(candidates: T[]): Promise<T[]> {
  const role = await viewerRole();
  return candidates.map((candidate) => redactBackgroundCheck(candidate, role));
}

/** For rows that embed a candidate (`{ candidate: {...} }`), e.g. interviews or signing requests. */
export async function redactNestedCandidatesForViewer<T extends { candidate?: object | null }>(rows: T[]): Promise<T[]> {
  const role = await viewerRole();
  return rows.map((row) =>
    row.candidate ? { ...row, candidate: redactBackgroundCheck(row.candidate, role) } : row
  );
}
