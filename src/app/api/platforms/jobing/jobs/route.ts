import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const BASE_URL = "https://pro.jobing.com/api";

function getApiKey() {
  return process.env.NOLIG_API_KEY || "";
}

function getCompany() {
  return process.env.NOLIG_COMPANY || "coastal-debt-resolve";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "NOLIG_API_KEY not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(`${BASE_URL}/jobs?company=${getCompany()}`, {
      headers: {
        Authorization: `Bearer token=${apiKey}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Jobing API returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json(
    { error: "Job creation via API is not supported. Use pro.jobing.com directly." },
    { status: 501 }
  );
}
