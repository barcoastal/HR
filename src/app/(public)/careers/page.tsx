import { db } from "@/lib/db";
import { CareersPage } from "@/components/careers/careers-page";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Careers — Coastal Debt Resolve",
  description: "Join our team and help small businesses break free from debt. View open positions and apply today.",
};

export default async function Careers() {
  const positions = await db.position.findMany({
    where: { status: "OPEN", published: true },
    include: { department: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <CareersPage
      positions={positions.map((p) => ({
        id: p.id,
        title: p.title,
        department: p.department?.name || null,
        description: p.description,
        requirements: p.requirements,
        salary: p.salary,
        location: p.location,
        type: p.type,
        createdAt: p.createdAt.toISOString(),
      }))}
    />
  );
}
