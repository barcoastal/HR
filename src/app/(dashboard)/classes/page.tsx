import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth-helpers";
import { canAccessRecruitment } from "@/lib/permissions";
import { getClassPermissions, getClassPositionOptions, listRecruitmentClasses } from "@/lib/actions/recruitment-classes";
import { dateKey } from "@/lib/time-zone";
import { PageHeader } from "@/components/ui/page-header";
import { ClassesList } from "@/components/classes/classes-list";
import { ClassFormDialog } from "@/components/classes/class-form-dialog";
import type { UserRole } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function ClassesPage() {
  const session = await requireAuth();
  if (!canAccessRecruitment((session.user?.role || "EMPLOYEE") as UserRole)) redirect("/login?error=unauthorized");

  const [classes, permissions, positions] = await Promise.all([
    listRecruitmentClasses(),
    getClassPermissions(),
    getClassPositionOptions(),
  ]);

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <PageHeader
        title="Classes"
        description="Start-date classes for each role and where every candidate stands: Green is cleared to start, Yellow is in process, Red is not moving forward."
        action={permissions.canManage ? <ClassFormDialog positions={positions} /> : undefined}
      />
      <ClassesList classes={classes} todayKey={dateKey(new Date())} />
    </div>
  );
}
