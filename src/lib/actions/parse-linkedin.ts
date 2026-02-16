"use server";

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

type ParsedProfile = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  skills: string[];
  experience: string;
  linkedinUrl: string;
  summary: string;
};

export async function parseLinkedIn(
  url: string
): Promise<{ data: ParsedProfile }> {
  if (!url.includes("linkedin.com/in/")) {
    throw new Error("Please provide a valid LinkedIn profile URL");
  }

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (!res.ok) {
    throw new Error("Could not fetch LinkedIn profile");
  }

  const html = await res.text();

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `Extract structured candidate data from this LinkedIn profile HTML. Return ONLY valid JSON with these fields (use empty string if not found, empty array for skills):

{
  "firstName": "",
  "lastName": "",
  "email": "",
  "phone": "",
  "skills": [],
  "experience": "",
  "linkedinUrl": "",
  "summary": ""
}

For "experience", provide a brief summary like "5 years in software engineering" or the most recent job title and duration.
For "skills", extract professional and technical skills mentioned.
For "summary", write a 1-2 sentence professional summary based on the profile.
For "linkedinUrl", use the canonical profile URL.

LinkedIn profile HTML:
${html.slice(0, 50000)}`,
      },
    ],
  });

  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";

  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to extract profile data");
  }

  const data: ParsedProfile = JSON.parse(jsonMatch[0]);
  data.linkedinUrl = data.linkedinUrl || url;

  return { data };
}
