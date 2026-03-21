import { redirect } from "next/navigation";
import { getOrCreateWorkspace } from "@/lib/actions/chat-workspace";

export default async function ChatPage() {
  const workspace = await getOrCreateWorkspace();
  const general = workspace.channels.find((c) => c.slug === "general");

  if (general) {
    redirect(`/chat/${general.id}`);
  }

  if (workspace.channels.length > 0) {
    redirect(`/chat/${workspace.channels[0].id}`);
  }

  return (
    <div className="flex items-center justify-center h-full text-gray-500">
      No channels available. Create one to get started.
    </div>
  );
}
