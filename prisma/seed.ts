import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";
import path from "node:path";

const dbPath = "file:" + path.join(__dirname, "dev.db");
const adapter = new PrismaBetterSqlite3({ url: dbPath });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database (clean slate)...");

  // Clear everything
  await prisma.feedReaction.deleteMany();
  await prisma.feedComment.deleteMany();
  await prisma.postAttachment.deleteMany();
  await prisma.feedPost.deleteMany();
  await prisma.review.deleteMany();
  await prisma.reviewCycle.deleteMany();
  await prisma.employeeTask.deleteMany();
  await prisma.checklistItem.deleteMany();
  await prisma.onboardingChecklist.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.document.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.position.deleteMany();
  await prisma.user.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.team.deleteMany();
  await prisma.department.deleteMany();

  // --- Admin user (no linked employee — pure system admin) ---
  const adminHash = await bcrypt.hash("admin123", 10);

  await prisma.user.create({
    data: {
      email: "admin@coastalhr.io",
      passwordHash: adminHash,
      role: "ADMIN",
    },
  });

  console.log("Done! Login with admin@coastalhr.io / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
