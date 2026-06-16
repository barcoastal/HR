import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth-helpers";
import { getRecruiterManagerData } from "@/lib/actions/recruiter-manager";
import { RecruiterManagerView } from "@/components/recruiter-manager/recruiter-manager-view";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default async function RecruiterManagerPage() {
  const session = await requireAuth();
  if (session.user?.role !== "SUPER_ADMIN") {
    redirect("/");
  }

  const data = await getRecruiterManagerData();

  return (
    <div className="max-w-[1600px] mx-auto py-8 px-4">
      <PageHeader
        title="Recruiter Manager"
        description="See what each recruiter is working on and move candidates between recruiters."
      />
      <RecruiterManagerView data={data} />
    </div>
  );
}
