import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database (clean slate)...");

  // Clear everything
  await prisma.platformSyncLog.deleteMany();
  await prisma.platformCostEntry.deleteMany();
  await prisma.recruitmentPlatform.deleteMany();
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

  // --- Recruitment Platforms ---
  const now = new Date();
  const platformData = [
    { name: "LinkedIn Recruiter", type: "PREMIUM" as const, monthlyCost: 825, status: "ACTIVE" as const, apiKey: "li-demo-key-2024" },
    { name: "Indeed", type: "PREMIUM" as const, monthlyCost: 300, status: "ACTIVE" as const, apiKey: "indeed-demo-key-2024" },
    { name: "Handshake", type: "NICHE" as const, monthlyCost: 150, status: "ACTIVE" as const, apiKey: null },
    { name: "EmployFL", type: "NICHE" as const, monthlyCost: 0, status: "ACTIVE" as const, apiKey: null },
    { name: "Facebook Jobs", type: "SOCIAL" as const, monthlyCost: 50, status: "PAUSED" as const, apiKey: null },
  ];

  for (const pd of platformData) {
    const platform = await prisma.recruitmentPlatform.create({
      data: {
        name: pd.name,
        type: pd.type,
        monthlyCost: pd.monthlyCost,
        status: pd.status,
        apiKey: pd.apiKey,
        connectedAt: pd.apiKey ? now : undefined,
      },
    });

    // Create 3 months of cost entries
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      await prisma.platformCostEntry.create({
        data: {
          platformId: platform.id,
          year: d.getFullYear(),
          month: d.getMonth() + 1,
          cost: pd.monthlyCost,
        },
      });
    }
  }

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
