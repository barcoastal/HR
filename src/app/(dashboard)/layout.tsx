import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { TopBar } from "@/components/layout/top-bar";
import { PulseSurveyWrapper } from "@/components/pulse/pulse-survey-wrapper";
import { getCompanySettings } from "@/lib/actions/company-settings";
import { getSession } from "@/lib/auth-helpers";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settings, session] = await Promise.all([
    getCompanySettings(),
    getSession(),
  ]);

  // Is the current user listed as a recruiter in company settings?
  let isRecruiter = false;
  const empId = session?.user?.employeeId;
  if (empId) {
    try {
      const ids: string[] = JSON.parse(settings.recruiterIds || "[]");
      isRecruiter = ids.includes(empId);
    } catch {
      isRecruiter = false;
    }
  }

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden">
      <Sidebar logoUrl={settings.logoUrl} companyName={settings.companyName} isRecruiter={isRecruiter} />
      <div className="flex-1 md:ml-64 min-w-0 max-w-full">
        <TopBar />
        <main className="p-4 pb-28 md:p-8 md:pb-8 max-w-full overflow-x-hidden">{children}</main>
      </div>
      <MobileNav isRecruiter={isRecruiter} />
      <Suspense fallback={null}>
        <PulseSurveyWrapper />
      </Suspense>
    </div>
  );
}
