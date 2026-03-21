import { redirect } from "next/navigation";
import { getOrCreateWorkspace } from "@/lib/actions/chat-workspace";

export default async function ChatPage() {
  try {
    const workspace = await getOrCreateWorkspace();
    if (!workspace) {
      return (
        <div className="flex items-center justify-center h-full text-gray-500">
          Unable to initialize workspace.
        </div>
      );
    }
    const general = workspace.channels.find((c: any) => c.slug === "general");

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
  } catch (error: any) {
    // Re-throw redirect errors (Next.js uses thrown errors for redirects)
    if (error?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    return (
      <div className="flex items-center justify-center h-full text-red-500 p-8">
        <div className="text-center">
          <p className="font-semibold mb-2">Failed to load chat</p>
          <p className="text-sm text-gray-500">{error?.message || "Unknown error"}</p>
        </div>
      </div>
    );
  }
}
