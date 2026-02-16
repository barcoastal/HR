import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { TopBar } from "@/components/layout/top-bar";
import { PulseSurveyWrapper } from "@/components/pulse/pulse-survey-wrapper";
import { Suspense } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 md:ml-64">
        <TopBar />
        <main className="p-4 pb-24 md:p-6 md:pb-6">{children}</main>
      </div>
      <MobileNav />
      <Suspense fallback={null}>
        <PulseSurveyWrapper />
      </Suspense>
    </div>
  );
}
