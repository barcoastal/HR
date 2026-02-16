import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

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
