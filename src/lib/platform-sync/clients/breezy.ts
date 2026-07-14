import type { PlatformClient, MockCandidate, CandidatePage } from "../types";

const BREEZY_BASE_URL = "https://api.breezy.hr/v3";
const PAGE_SIZE = 50;

/**
 * Breezy HR client — bridges Indeed & LinkedIn through Breezy's native integrations.
 *
 * Connection flow:
 *  1. User creates Breezy HR account (free tier)
 *  2. Connects Indeed & LinkedIn inside Breezy (native, no API needed)
 *  3. Enters Breezy email + password in HR platform settings
 *  4. We authenticate via POST /v3/signin → get access_token
 *  5. Sync candidates & post jobs via Breezy API
 *
 * Credentials stored:
 *  - apiKey: Breezy access_token (refreshed on each sync)
 *  - accountIdentifier: company_id
 *  - refreshToken: stores email::password for re-authentication
 */
export class BreezyHRClient implements PlatformClient {
  readonly platformName = "Breezy HR";

  async validateCredentials(apiKey: string): Promise<boolean> {
    if (!apiKey) return false;
    // apiKey is the access_token from signin
    if (apiKey.length > 10) return true;
    return false;
  }

  async fetchCandidates(accessToken?: string): Promise<MockCandidate[]> {
    if (!accessToken) return [];

    // accessToken format: TOKEN::COMPANY_ID
    const [token, companyId] = parseAccessToken(accessToken);
    if (!token || !companyId) return [];

    const positions = await listPositions(token, companyId);
    const all: MockCandidate[] = [];

    for (const pos of positions) {
      const candidates = await listCandidates(token, companyId, pos._id);
      for (const summary of candidates) {
        const detail = await getCandidateDetail(token, companyId, pos._id, summary._id);
        const mapped = mapBreezyCandidate(detail || summary, pos.name, companyId, pos._id);
        if (mapped) all.push(mapped);
      }
    }

    return all;
  }

  async fetchCandidatesPaginated(
    accessToken: string,
    cursor?: string | null,
    opts?: { knownEmails?: Set<string> }
  ): Promise<CandidatePage> {
    const [token, companyId] = parseAccessToken(accessToken);
    if (!token || !companyId) {
      throw new Error("Invalid token format. Expected TOKEN::COMPANY_ID");
    }

    // cursor format: "positionIndex" — one position per page
    const positions = await listPositions(token, companyId);
    if (positions.length === 0) {
      return { candidates: [], nextCursor: null, totalEstimate: 0 };
    }

    let posIdx = 0;
    if (cursor) {
      posIdx = parseInt(cursor, 10);
    }

    if (posIdx >= positions.length) {
      return { candidates: [], nextCursor: null, totalEstimate: 0 };
    }

    const pos = positions[posIdx];
    const candidates = await listCandidates(token, companyId, pos._id);
    const mapped: MockCandidate[] = [];
    const knownEmails = opts?.knownEmails;
    for (const summary of candidates) {
      // Skip the detail fetch for candidates we already have in the DB.
      // Detail is needed for resume URL + a few extras that aren't in the
      // listing payload; for known candidates the summary is enough and we
      // save one API call (which is the difference between staying inside
      // Breezy's rate limit and getting 429'd halfway through a sync).
      const email = (summary.email_address || "").toLowerCase().trim();
      const isKnown = email && knownEmails?.has(email);
      const detail = isKnown
        ? null
        : await getCandidateDetail(token, companyId, pos._id, summary._id);
      const m = mapBreezyCandidate(detail || summary, pos.name, companyId, pos._id);
      if (m) mapped.push(m);
    }

    const nextIdx = posIdx + 1;
    return {
      candidates: mapped,
      nextCursor: nextIdx < positions.length ? String(nextIdx) : null,
      totalEstimate: 0,
    };
  }
}

/**
 * Wrap fetch with Breezy-specific rate-limit handling. Breezy's published
 * limit is ~5 req/sec; in practice they throw 429 on bursts during sync. We
 * sleep on 429 (honoring Retry-After when present) and retry a few times,
 * and add a small base spacer so back-to-back requests don't burst.
 */
const BREEZY_BASE_DELAY_MS = 250;
const BREEZY_MAX_RETRIES = 6;

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function breezyFetch(url: string, init: RequestInit): Promise<Response> {
  await sleep(BREEZY_BASE_DELAY_MS);
  for (let attempt = 0; attempt < BREEZY_MAX_RETRIES; attempt++) {
    const res = await fetch(url, init);
    if (res.status !== 429) return res;
    const retryAfterHeader = res.headers.get("retry-after");
    const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;
    // Exponential backoff with jitter, floor of 2s, capped at 30s.
    const backoffMs = !isNaN(retryAfterSec) && retryAfterSec > 0
      ? retryAfterSec * 1000
      : Math.min(2_000 * Math.pow(1.5, attempt) + Math.random() * 500, 30_000);
    console.warn(`[breezy] 429 on ${url} — waiting ${Math.round(backoffMs)}ms (attempt ${attempt + 1}/${BREEZY_MAX_RETRIES})`);
    await sleep(backoffMs);
  }
  // Final retry — return whatever Breezy gives us, callers handle the error.
  return fetch(url, init);
}

async function getCandidateDetail(
  accessToken: string,
  companyId: string,
  positionId: string,
  candidateId: string
): Promise<BreezyCandidate | null> {
  try {
    const res = await breezyFetch(
      `${BREEZY_BASE_URL}/company/${companyId}/position/${positionId}/candidate/${candidateId}`,
      { headers: { Authorization: accessToken } }
    );
    if (!res.ok) return null;
    return (await res.json()) as BreezyCandidate;
  } catch {
    return null;
  }
}

// --- Breezy API functions ---

export async function breezySignIn(
  email: string,
  password: string
): Promise<{ accessToken: string; error?: string }> {
  const res = await fetch(`${BREEZY_BASE_URL}/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return {
      accessToken: "",
      error: data?.error?.message || `Sign in failed (${res.status})`,
    };
  }

  const data = await res.json();
  return { accessToken: data.access_token };
}

export async function getBreezyCompanies(
  accessToken: string
): Promise<{ id: string; name: string }[]> {
  const res = await breezyFetch(`${BREEZY_BASE_URL}/companies`, {
    headers: { Authorization: accessToken },
  });

  if (!res.ok) return [];
  const data = await res.json();
  return (data || []).map((c: { _id: string; name: string }) => ({
    id: c._id,
    name: c.name,
  }));
}

async function listPositions(
  accessToken: string,
  companyId: string
): Promise<BreezyPosition[]> {
  // No state filter — pull all positions so candidates from draft/archived
  // postings still surface.
  const res = await breezyFetch(
    `${BREEZY_BASE_URL}/company/${companyId}/positions`,
    { headers: { Authorization: accessToken } }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Breezy listPositions failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function listCandidates(
  accessToken: string,
  companyId: string,
  positionId: string
): Promise<BreezyCandidate[]> {
  const res = await breezyFetch(
    `${BREEZY_BASE_URL}/company/${companyId}/position/${positionId}/candidates`,
    { headers: { Authorization: accessToken } }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Breezy listCandidates failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return res.json();
}

// --- Job posting ---

// Breezy accepts only these enum values for position.type
const BREEZY_TYPE_MAP: Record<string, string> = {
  "full-time": "fullTime",
  fulltime: "fullTime",
  full_time: "fullTime",
  "part-time": "partTime",
  parttime: "partTime",
  part_time: "partTime",
  contract: "contract",
  contractor: "contract",
  temporary: "temporary",
  temp: "temporary",
  intern: "temporary",
  internship: "temporary",
  other: "other",
};

function mapBreezyType(raw?: string): string {
  if (!raw) return "fullTime";
  const key = raw.trim().toLowerCase().replace(/\s+/g, "-");
  return BREEZY_TYPE_MAP[key] || "other";
}

const HQ_LOCATION = {
  city: "Fort Lauderdale",
  state: "FL",
  country: "US",
  zip: "33309",
  street: "6700 N Andrews Ave ste 500, Fort Lauderdale, FL 33309, USA",
};

/**
 * Build a Breezy location object. Indeed requires a real address on every
 * job, so we always emit country+city+state, defaulting to the Coastal Debt
 * HQ.
 *
 * IMPORTANT (verified against the live API 2026-07-14): the create-position
 * endpoint validates `country` and `state` as plain 2-letter STRING codes
 * ("US", "FL") and rejects the { id, name } object form its read API
 * returns. Breezy normalizes the strings into objects server-side.
 *
 * Accepted user input (`location` string from the post-job form):
 *   - "" / undefined → HQ address, on-site (NOT remote — an empty field used
 *     to mark the job remote, which strips the address Indeed needs)
 *   - "Remote" / "Anywhere" → HQ address, is_remote: true
 *   - "Fort Lauderdale, FL" → city: "Fort Lauderdale", state: "FL"
 *   - "Miami, FL, US" → city: "Miami", state: "FL", country: "US"
 *   - any single token → treated as a city, state defaults to FL
 */
export function buildBreezyLocation(raw?: string) {
  const trimmed = (raw || "").trim();
  const isRemote = /remote|anywhere|worldwide/i.test(trimmed);

  let city = HQ_LOCATION.city;
  let state = HQ_LOCATION.state;
  let country = HQ_LOCATION.country;
  let zip: string | undefined;

  if (trimmed && !isRemote) {
    const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
    city = parts[0] || HQ_LOCATION.city;
    // Real position data contains "FL 33309"-style state tokens — Breezy's
    // validator only accepts the bare 2-letter code, so split the zip out.
    const stateToken = (parts[1] || HQ_LOCATION.state).toUpperCase();
    const stateMatch = stateToken.match(/^([A-Z]{2})(?:\s+(\d{5}(?:-\d{4})?))?$/);
    state = stateMatch ? stateMatch[1] : stateToken;
    zip = stateMatch?.[2];
    country = (parts[2] || HQ_LOCATION.country).toUpperCase();
  }

  const isHq = city === HQ_LOCATION.city && state === HQ_LOCATION.state;

  return {
    name: `${city}, ${state}`,
    country,
    city,
    state,
    is_remote: isRemote,
    ...(isHq ? { zip: zip || HQ_LOCATION.zip } : zip ? { zip } : {}),
    // Street-level address gives Breezy's Indeed feed a complete location.
    ...(isHq ? { streetAddress: { location: HQ_LOCATION.street, custom: "" } } : {}),
  };
}

export async function postJobToBreezy(data: {
  accessToken: string;
  companyId: string;
  title: string;
  description?: string;
  requirements?: string;
  department?: string;
  location?: string;
  salary?: string;
  type?: string;
  /** Initial state. Defaults to "draft" so positions don't go live accidentally. */
  publishState?: "draft" | "published";
}): Promise<{ success: boolean; positionId?: string; error?: string }> {
  const body: Record<string, unknown> = {
    name: data.title,
    description: [
      data.description || "",
      data.requirements ? `\n\nRequirements:\n${data.requirements}` : "",
    ]
      .filter(Boolean)
      .join(""),
    type: mapBreezyType(data.type),
    // Indeed requires country + city + state on every job, otherwise it
    // refuses to syndicate. Default everything to the Coastal Debt HQ
    // (Fort Lauderdale, FL, US); parse the user-provided location when one
    // is supplied.
    location: buildBreezyLocation(data.location),
  };

  if (data.department) body.department = data.department;

  try {
    const res = await fetch(
      `${BREEZY_BASE_URL}/company/${data.companyId}/positions`,
      {
        method: "POST",
        headers: {
          Authorization: data.accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg =
        err?.error?.message || err?.message || `Failed (${res.status})`;
      console.error(`[breezy] create position failed: ${msg}`);
      return { success: false, error: msg };
    }

    const result = await res.json();
    const positionId = result._id;

    if (data.publishState === "published") {
      const publishRes = await fetch(
        `${BREEZY_BASE_URL}/company/${data.companyId}/position/${positionId}/state`,
        {
          method: "PUT",
          headers: {
            Authorization: data.accessToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ state: "published" }),
        }
      );
      if (!publishRes.ok) {
        const err = await publishRes.json().catch(() => ({}));
        const msg =
          err?.error?.message || err?.message || `Publish failed (${publishRes.status})`;
        console.error(`[breezy] publish position ${positionId} failed: ${msg}`);
        // Position was created; surface partial success so caller can still
        // record the externalId and show the publish error.
        return { success: false, positionId, error: msg };
      }
    }

    return { success: true, positionId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to post job",
    };
  }
}

/**
 * Update fields on an existing Breezy position (PUT). Used to repair
 * positions created before the location-format fix, which Breezy stored
 * with no address.
 */
export async function updateBreezyPosition(data: {
  accessToken: string;
  companyId: string;
  positionId: string;
  fields: Record<string, unknown>;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${BREEZY_BASE_URL}/company/${data.companyId}/position/${data.positionId}`,
      {
        method: "PUT",
        headers: {
          Authorization: data.accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data.fields),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err?.error?.message || `Failed (${res.status})` };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update" };
  }
}

export async function updateBreezyPositionState(data: {
  accessToken: string;
  companyId: string;
  positionId: string;
  state: "published" | "draft" | "archived" | "closed";
}): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(
      `${BREEZY_BASE_URL}/company/${data.companyId}/position/${data.positionId}/state`,
      {
        method: "PUT",
        headers: {
          Authorization: data.accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ state: data.state }),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err?.error?.message || `Failed (${res.status})` };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to update" };
  }
}

// --- Webhook setup ---

export async function setupBreezyWebhook(data: {
  accessToken: string;
  companyId: string;
  webhookUrl: string;
  events?: string[];
}): Promise<{ success: boolean; webhookId?: string; error?: string }> {
  try {
    const res = await fetch(
      `${BREEZY_BASE_URL}/company/${data.companyId}/webhook_endpoints`,
      {
        method: "POST",
        headers: {
          Authorization: data.accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: data.webhookUrl,
          events: data.events || ["candidate.created", "candidate.updated"],
        }),
      }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err?.error?.message || `Failed (${res.status})` };
    }

    const result = await res.json();
    return { success: true, webhookId: result._id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to setup webhook",
    };
  }
}

// --- Types ---

type BreezyPosition = {
  _id: string;
  name: string;
  state: string;
  department?: string;
  location?: { name?: string };
};

type BreezyCandidate = {
  _id: string;
  name: string;
  email_address?: string;
  phone_number?: string;
  headline?: string;
  summary?: string;
  // Breezy returns source as { id, name } on detail, but legacy responses
  // may still return a plain string — accept both.
  source?: string | { id?: string; name?: string } | null;
  tags?: string[];
  stage?: { name?: string };
  social_profiles?: { type: string; url: string }[];
  creation_date?: string;
  origin?: string;
  resume?: { url?: string; pdf_url?: string; file_name?: string } | null;
};

/**
 * Normalize Breezy's source field into a friendly board name.
 * Real-world values: "indeed-sponsored-jobs", "ziprecruiter", "linkedin",
 * "careers", "referral", etc. `origin` is the candidate's lifecycle stage
 * (e.g. "applied", "sourced") — NOT the source, so we ignore it.
 */
function resolveBreezySource(raw: BreezyCandidate["source"]): string {
  const rawStr = typeof raw === "string"
    ? raw
    : (raw && (raw.name || raw.id)) || "";
  const lower = rawStr.toLowerCase();
  if (!lower) return "Breezy HR";
  if (lower.includes("indeed")) return "Indeed";
  if (lower.includes("linkedin")) return "LinkedIn";
  if (lower.includes("ziprecruiter") || lower.includes("zip-recruiter")) return "ZipRecruiter";
  if (lower.includes("glassdoor")) return "Glassdoor";
  if (lower.includes("monster")) return "Monster";
  if (lower.includes("careerbuilder")) return "CareerBuilder";
  if (lower.includes("simplyhired")) return "SimplyHired";
  if (lower.includes("dice")) return "Dice";
  if (lower.includes("google")) return "Google for Jobs";
  if (lower.includes("facebook")) return "Facebook";
  if (lower.includes("careers") || lower.includes("career-page")) return "Careers Page";
  if (lower.includes("referral")) return "Referral";
  if (lower.includes("sourced")) return "Sourced";
  // Fall back to title-cased version of whatever Breezy gave us.
  return rawStr
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function mapBreezyCandidate(
  c: BreezyCandidate,
  positionTitle: string,
  _companyId: string,
  positionId: string
): MockCandidate | null {
  if (!c.email_address) return null;

  const nameParts = (c.name || "").trim().split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";
  if (!firstName && !lastName) return null;

  const linkedinProfile = c.social_profiles?.find((p) =>
    p.type === "linkedin" || p.url?.includes("linkedin.com")
  );

  const displaySource = resolveBreezySource(c.source);

  const notes = [
    `Via Breezy HR (${displaySource})`,
    c.stage?.name ? `Stage: ${c.stage.name}` : "",
    c.headline || "",
    c.creation_date ? `Applied: ${c.creation_date.slice(0, 10)}` : "",
  ]
    .filter(Boolean)
    .join(". ");

  // Breezy candidate detail exposes resume.pdf_url (preferred) or resume.url —
  // direct download links served from Breezy/CDN.
  const resumeUrl = c.resume?.pdf_url || c.resume?.url || undefined;

  return {
    firstName,
    lastName,
    email: c.email_address,
    phone: c.phone_number || undefined,
    linkedinUrl: linkedinProfile?.url || undefined,
    skills: c.tags || [],
    experience: c.headline || undefined,
    notes: notes || undefined,
    source: displaySource,
    resumeUrl,
    jobAppliedTo: positionTitle || undefined,
    appliedAt: c.creation_date || undefined,
    externalPlatform: "BREEZY",
    externalPositionId: positionId,
  };
}

function parseAccessToken(token: string): [string, string] {
  const idx = token.indexOf("::");
  if (idx === -1) return [token, ""];
  return [token.slice(0, idx), token.slice(idx + 2)];
}
