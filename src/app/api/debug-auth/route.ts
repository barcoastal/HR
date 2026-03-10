import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function GET(req: Request) {
  const url = new URL(req.url);

  // ?fix=1 will create the Jobing platform if missing
  if (url.searchParams.get("fix") === "1") {
    const apiKey = process.env.NOLIG_API_KEY;
    if (apiKey) {
      await db.recruitmentPlatform.upsert({
        where: { name: "Jobing" },
        create: {
          name: "Jobing",
          type: "JOB_BOARD",
          monthlyCost: 0,
          status: "ACTIVE",
          apiKey,
          connectedAt: new Date(),
        },
        update: { apiKey, status: "ACTIVE" },
      });
    }
  }

  // ?test=api will test the Jobing API directly
  if (url.searchParams.get("test") === "api") {
    const apiKey = process.env.NOLIG_API_KEY || "";
    const company = process.env.NOLIG_COMPANY || "coastal-debt-resolve";
    const apiUrl = `https://pro.jobing.com/api/applicants/bulk?company=${company}&page=1`;
    try {
      const res = await fetch(apiUrl, {
        headers: { Authorization: `Bearer token=${apiKey}`, Accept: "application/json" },
      });
      const text = await res.text();
      return NextResponse.json({
        status: res.status,
        url: apiUrl,
        bodyLength: text.length,
        bodyPreview: text.slice(0, 500),
        headers: Object.fromEntries(res.headers.entries()),
      });
    } catch (err) {
      return NextResponse.json({ error: String(err) });
    }
  }

  const platforms = await db.recruitmentPlatform.findMany({
    select: { id: true, name: true, status: true, apiKey: true, totalSynced: true },
  });
  const candidateCount = await db.candidate.count();
  return NextResponse.json({
    platforms: platforms.map(p => ({ ...p, apiKey: p.apiKey ? p.apiKey.slice(0, 8) + "..." : null })),
    candidateCount,
    env: {
      NOLIG_API_KEY: process.env.NOLIG_API_KEY ? process.env.NOLIG_API_KEY.slice(0, 8) + "..." : "NOT SET",
      NOLIG_COMPANY: process.env.NOLIG_COMPANY || "NOT SET",
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;
    const log: string[] = [];

    log.push(`Received: email="${email}", password="${password}"`);

    const user = await db.user.findUnique({
      where: { email },
      include: { employee: true },
    });

    if (!user) {
      log.push("User NOT FOUND in database");
      const allUsers = await db.user.findMany({ select: { email: true } });
      log.push(`All users: ${JSON.stringify(allUsers)}`);
      return NextResponse.json({ success: false, log });
    }

    log.push(`Found user: id=${user.id}, email=${user.email}, role=${user.role}`);
    log.push(`Has passwordHash: ${!!user.passwordHash}`);

    if (!user.passwordHash) {
      log.push("No password hash stored!");
      return NextResponse.json({ success: false, log });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    log.push(`bcrypt.compare result: ${valid}`);

    log.push(`NEXTAUTH_URL: ${process.env.NEXTAUTH_URL || "NOT SET"}`);
    log.push(`NEXTAUTH_SECRET: ${process.env.NEXTAUTH_SECRET ? "SET (length " + process.env.NEXTAUTH_SECRET.length + ")" : "NOT SET"}`);

    return NextResponse.json({ success: valid, log });
  } catch (e: unknown) {
    const err = e as Error;
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
