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

    try {
      // accessToken format: TOKEN::COMPANY_ID
      const [token, companyId] = parseAccessToken(accessToken);
      if (!token || !companyId) return [];

      // Get all published positions
      const positions = await listPositions(token, companyId);
      const all: MockCandidate[] = [];

      for (const pos of positions) {
        const candidates = await listCandidates(token, companyId, pos._id);
        for (const c of candidates) {
          const mapped = mapBreezyCandidate(c, pos.name);
          if (mapped) all.push(mapped);
        }
      }

      return all;
    } catch {
      return [];
    }
  }

  async fetchCandidatesPaginated(
    accessToken: string,
    cursor?: string | null
  ): Promise<CandidatePage> {
    const [token, companyId] = parseAccessToken(accessToken);
    if (!token || !companyId) {
      throw new Error("Invalid token format. Expected TOKEN::COMPANY_ID");
    }

    // cursor format: "positionIndex:candidatePage" or null for start
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
    const mapped = candidates
      .map((c) => mapBreezyCandidate(c, pos.name))
      .filter((c): c is MockCandidate => c !== null);

    const nextIdx = posIdx + 1;
    return {
      candidates: mapped,
      nextCursor: nextIdx < positions.length ? String(nextIdx) : null,
      totalEstimate: 0,
    };
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
  const res = await fetch(`${BREEZY_BASE_URL}/companies`, {
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
  const res = await fetch(
    `${BREEZY_BASE_URL}/company/${companyId}/positions?state=published`,
    { headers: { Authorization: accessToken } }
  );
  if (!res.ok) return [];
  return res.json();
}

async function listCandidates(
  accessToken: string,
  companyId: string,
  positionId: string
): Promise<BreezyCandidate[]> {
  const res = await fetch(
    `${BREEZY_BASE_URL}/company/${companyId}/position/${positionId}/candidates`,
    { headers: { Authorization: accessToken } }
  );
  if (!res.ok) return [];
  return res.json();
}

// --- Job posting ---

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
}): Promise<{ success: boolean; positionId?: string; error?: string }> {
  const body: Record<string, unknown> = {
    name: data.title,
    description: [
      data.description || "",
      data.requirements ? `\n\nRequirements:\n${data.requirements}` : "",
    ]
      .filter(Boolean)
      .join(""),
    type: data.type || "fullTime",
    location: { name: data.location || "Remote" },
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
      return { success: false, error: err?.error?.message || `Failed (${res.status})` };
    }

    const result = await res.json();
    const positionId = result._id;

    // Publish the position so it goes live on Indeed/LinkedIn
    await fetch(
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

    return { success: true, positionId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to post job",
    };
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
  source?: string;
  tags?: string[];
  stage?: { name?: string };
  social_profiles?: { type: string; url: string }[];
  creation_date?: string;
  origin?: string;
};

function mapBreezyCandidate(
  c: BreezyCandidate,
  positionTitle: string
): MockCandidate | null {
  if (!c.email_address) return null;

  const nameParts = (c.name || "").trim().split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";
  if (!firstName && !lastName) return null;

  const linkedinProfile = c.social_profiles?.find((p) =>
    p.type === "linkedin" || p.url?.includes("linkedin.com")
  );

  const source = c.origin || c.source || "Breezy HR";
  const displaySource = source.toLowerCase().includes("indeed")
    ? "Indeed"
    : source.toLowerCase().includes("linkedin")
      ? "LinkedIn"
      : source;

  const notes = [
    `Via Breezy HR (${displaySource})`,
    c.stage?.name ? `Stage: ${c.stage.name}` : "",
    c.headline || "",
    c.creation_date ? `Applied: ${c.creation_date.slice(0, 10)}` : "",
  ]
    .filter(Boolean)
    .join(". ");

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
    jobAppliedTo: positionTitle || undefined,
    appliedAt: c.creation_date || undefined,
  };
}

function parseAccessToken(token: string): [string, string] {
  const idx = token.indexOf("::");
  if (idx === -1) return [token, ""];
  return [token.slice(0, idx), token.slice(idx + 2)];
}
