"use server";

import Anthropic from "@anthropic-ai/sdk";
import { db } from "@/lib/db";

const anthropic = new Anthropic();

export type AIMatch = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  skills: string | null;
  experience: string | null;
  source: string | null;
  inPipeline: boolean;
  score: number;
  reason: string;
};

export async function aiMatchCandidates(positionId: string): Promise<AIMatch[]> {
  const position = await db.position.findUnique({ where: { id: positionId } });
  if (!position) throw new Error("Position not found");

  // Extract keywords from title + requirements
  const text = `${position.title} ${position.requirements || ""}`;
  const keywords = text
    .split(/[\s,;/()]+/)
    .map((w) => w.toLowerCase().replace(/[^a-z0-9+#.]/g, ""))
    .filter((w) => w.length > 2);
  const uniqueKeywords = [...new Set(keywords)];

  // Pre-filter: keyword match in DB
  let candidates;
  if (uniqueKeywords.length > 0) {
    const orConditions = uniqueKeywords.flatMap((kw) => [
      { skills: { contains: kw, mode: "insensitive" as const } },
      { experience: { contains: kw, mode: "insensitive" as const } },
      { resumeText: { contains: kw, mode: "insensitive" as const } },
    ]);
    candidates = await db.candidate.findMany({
      where: {
        status: { notIn: ["HIRED", "REJECTED"] },
        OR: orConditions,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  // Fallback: if keyword search yields < 30, broaden to recent candidates
  if (!candidates || candidates.length < 30) {
    candidates = await db.candidate.findMany({
      where: {
        status: { notIn: ["HIRED", "REJECTED"] },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  if (candidates.length === 0) return [];

  // Build candidate summaries for Claude (no full resumeText to save tokens)
  const candidateSummaries = candidates.map((c) => ({
    id: c.id,
    name: `${c.firstName} ${c.lastName}`,
    skills: c.skills || "",
    experience: c.experience || "",
  }));

  const prompt = `You are a recruitment AI assistant. A company is hiring for this position:

Title: ${position.title}
Description: ${position.description || "N/A"}
Requirements: ${position.requirements || "N/A"}

Below is a JSON array of candidate summaries. Score each candidate from 0-100 on how well they match this position. Consider skill overlap, experience relevance, and seniority fit.

Return ONLY a valid JSON array of objects with these fields:
- "id": the candidate's id (string)
- "score": match score 0-100 (number)
- "reason": 1 sentence explaining the match (string)

Only include candidates with score >= 60. Sort by score descending. Max 30 results.

Candidates:
${JSON.stringify(candidateSummaries)}`;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = responseText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  let scored: { id: string; score: number; reason: string }[];
  try {
    scored = JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }

  // Build a lookup map from DB candidates
  const candidateMap = new Map(candidates.map((c) => [c.id, c]));

  // Enrich with full candidate data, enforce sorting & threshold
  const results: AIMatch[] = scored
    .filter((s) => s.score >= 60 && candidateMap.has(s.id))
    .sort((a, b) => b.score - a.score)
    .slice(0, 30)
    .map((s) => {
      const c = candidateMap.get(s.id)!;
      return {
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        skills: c.skills,
        experience: c.experience,
        source: c.source,
        inPipeline: c.inPipeline,
        score: s.score,
        reason: s.reason,
      };
    });

  return results;
}
