import { requireAuth } from "@/lib/auth-helpers";
import { ChatSidebar } from "@/components/chat/chat-sidebar";

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar: hidden on mobile, shown on desktop */}
      <div className="hidden md:flex">
        <ChatSidebar />
      </div>
      <main className="flex-1 flex flex-col min-w-0 w-full">{children}</main>
    </div>
  );
}
