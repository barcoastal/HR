import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { TopBar } from "@/components/layout/top-bar";
import { PulseSurveyWrapper } from "@/components/pulse/pulse-survey-wrapper";
import { getCompanySettings } from "@/lib/actions/company-settings";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getCompanySettings();

  return (
    <div className="flex min-h-screen w-full overflow-x-hidden">
      <Sidebar logoUrl={settings.logoUrl} companyName={settings.companyName} />
      <div className="flex-1 md:ml-64 min-w-0 max-w-full">
        <TopBar />
        <main className="p-4 pb-28 md:p-8 md:pb-8 max-w-full overflow-x-hidden">{children}</main>
      </div>
      <MobileNav />
      <Suspense fallback={null}>
        <PulseSurveyWrapper />
      </Suspense>
    </div>
  );
}
