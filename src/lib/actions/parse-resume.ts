"use server";

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

type ParsedResume = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  skills: string[];
  experience: string;
  linkedinUrl: string;
  summary: string;
  resumeText: string;
};

export async function parseResume(
  formData: FormData
): Promise<{ data: ParsedResume; resumeText: string }> {
  const file = formData.get("file") as File;
  if (!file) throw new Error("No file provided");

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64,
            },
          },
          {
            type: "text",
            text: `Extract structured data from this resume PDF. Return ONLY valid JSON with these fields (use empty string if not found, empty array for skills):

{
  "firstName": "",
  "lastName": "",
  "email": "",
  "phone": "",
  "skills": [],
  "experience": "",
  "linkedinUrl": "",
  "summary": "",
  "resumeText": ""
}

For "experience", provide a brief summary like "5 years in software engineering" or the most recent job title and years.
For "skills", extract a list of technical and professional skills mentioned.
For "summary", write a 1-2 sentence professional summary.
For "resumeText", include the full plain text content of the resume.`,
          },
        ],
      },
    ],
  });

  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";

  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Failed to parse structured data from resume");
  }

  const parsed: ParsedResume = JSON.parse(jsonMatch[0]);

  return { data: parsed, resumeText: parsed.resumeText };
}
