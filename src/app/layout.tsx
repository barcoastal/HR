import type { Metadata } from "next";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { TopBar } from "@/components/layout/top-bar";
import "./globals.css";

export const metadata: Metadata = {
  title: "PeopleHub - HR Management",
  description: "Internal HR management platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex-1 md:ml-64">
              <TopBar />
              <main className="p-4 pb-24 md:p-6 md:pb-6">{children}</main>
            </div>
          </div>
          <MobileNav />
        </ThemeProvider>
      </body>
    </html>
  );
}
