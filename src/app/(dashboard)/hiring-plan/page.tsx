import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth-helpers";
import { getHiringPlan } from "@/lib/actions/hiring-plan";
import { getEmployees } from "@/lib/actions/employees";
import { HiringPlanEditor } from "@/components/hiring-plan/hiring-plan-editor";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default async function HiringPlanPage() {
  const session = await requireAuth();
  const role = session.user?.role;
  if (role !== "SUPER_ADMIN" && role !== "ADMIN") {
    redirect("/");
  }

  const [plan, employees] = await Promise.all([
    getHiringPlan(),
    getEmployees({ status: "ACTIVE" }),
  ]);

  return (
    <div className="max-w-[1600px] mx-auto py-8 px-4">
      <PageHeader
        title="Hiring Plan"
        description="Map out the team you want — fill the slots with current employees or leave them as TBH to track open roles."
      />
      <HiringPlanEditor
        initialData={plan}
        employees={employees.map((e) => ({
          id: e.id,
          firstName: e.firstName,
          lastName: e.lastName,
          jobTitle: e.jobTitle,
        }))}
      />
    </div>
  );
}
