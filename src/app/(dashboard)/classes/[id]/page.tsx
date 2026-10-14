import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth-helpers";
import { canAccessRecruitment } from "@/lib/permissions";
import { getClassPermissions, getClassPositionOptions, getRecruitmentClass } from "@/lib/actions/recruitment-classes";
import { dateKey } from "@/lib/time-zone";
import { ClassDetailView } from "@/components/classes/class-detail-view";
import type { UserRole } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  if (!canAccessRecruitment((session.user?.role || "EMPLOYEE") as UserRole)) redirect("/login?error=unauthorized");

  const { id } = await params;
  const [cls, permissions, positions] = await Promise.all([
    getRecruitmentClass(id),
    getClassPermissions(),
    getClassPositionOptions(),
  ]);
  if (!cls) notFound();

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <ClassDetailView cls={cls} permissions={permissions} positions={positions} todayKey={dateKey(new Date())} />
    </div>
  );
}
