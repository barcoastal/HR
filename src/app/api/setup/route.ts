import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export async function GET() {
  const log: string[] = [];

  try {
    log.push("1. Testing database connection...");
    const userCount = await db.user.count();
    log.push(`   Users in database: ${userCount}`);

    const allUsers = await db.user.findMany({
      select: { id: true, email: true, role: true, passwordHash: true },
    });
    log.push(`   Existing users: ${JSON.stringify(allUsers.map(u => ({ email: u.email, role: u.role, hasHash: !!u.passwordHash })))}`);

    log.push("2. Creating/updating admin user...");
    const hash = await bcrypt.hash("admin123", 10);
    log.push(`   Generated hash: ${hash}`);

    const admin = await db.user.upsert({
      where: { email: "admin" },
      update: { passwordHash: hash, role: "ADMIN" },
      create: { email: "admin", passwordHash: hash, role: "ADMIN" },
    });
    log.push(`   Admin user ID: ${admin.id}`);

    log.push("3. Verifying login would work...");
    const found = await db.user.findUnique({ where: { email: "admin" } });
    if (!found) {
      log.push("   FAIL: User not found after upsert!");
    } else {
      log.push(`   Found user: ${found.email}, role: ${found.role}`);
      const valid = await bcrypt.compare("admin123", found.passwordHash!);
      log.push(`   Password check: ${valid ? "PASS" : "FAIL"}`);
    }

    log.push("4. DONE - Try logging in with admin / admin123");

    return NextResponse.json({ success: true, log }, { status: 200 });
  } catch (e: unknown) {
    const err = e as Error;
    log.push(`ERROR: ${err.message}`);
    log.push(err.stack || "");
    return NextResponse.json({ success: false, log }, { status: 500 });
  }
}
