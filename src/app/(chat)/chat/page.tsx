import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getOrCreateWorkspace } from "@/lib/actions/chat-workspace";
import { getChannels } from "@/lib/actions/chat-channels";
import { getDmThreads } from "@/lib/actions/chat-dms";
import Link from "next/link";

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();
}

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

    // On desktop, redirect to #general
    const headersList = await headers();
    const ua = headersList.get("user-agent") || "";
    const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);

    if (!isMobile) {
      const general = workspace.channels.find((c: any) => c.slug === "general");
      if (general) redirect(`/chat/${general.id}`);
      if (workspace.channels.length > 0) redirect(`/chat/${workspace.channels[0].id}`);
    }

    // Mobile: show channel list
    const channelList = await getChannels(workspace.id) as any[];
    const dmList = await getDmThreads(workspace.id) as any[];

    return (
      <div className="h-full flex flex-col bg-white">
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">HT Platform</h1>
              <p className="text-xs text-gray-500">Team Chat</p>
            </div>
            <Link href="/" className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600">
              ← HR
            </Link>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Channels */}
          <div className="px-4 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Channels</p>
            <div className="space-y-0.5">
              {channelList.map((c: any) => (
                <Link
                  key={c.id}
                  href={`/chat/${c.id}`}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <span className="w-9 h-9 rounded-xl bg-[#5b3cdd]/10 flex items-center justify-center text-[#5b3cdd] text-sm font-semibold">
                    #
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{c.name}</p>
                    {c.description && (
                      <p className="text-[11px] text-gray-500 truncate">{c.description}</p>
                    )}
                  </div>
                  <span className="text-[11px] text-gray-400">{c._count?.members || 0}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* DMs */}
          {dmList.length > 0 && (
            <div className="px-4 pt-4 pb-8">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Direct Messages</p>
              <div className="space-y-0.5">
                {dmList.map((dm: any) => {
                  const otherMembers = dm.members.map((m: any) => m.employee);
                  const displayName = otherMembers.map((m: any) => m.firstName).join(", ");
                  const firstMember = otherMembers[0];
                  const lastMsg = dm.messages?.[0];

                  return (
                    <Link
                      key={dm.id}
                      href={`/chat/${dm.id}?type=dm`}
                      className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      {firstMember?.profilePhoto ? (
                        <img src={firstMember.profilePhoto} alt="" className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-[#5b3cdd] flex items-center justify-center text-white text-xs font-semibold">
                          {firstMember ? getInitials(firstMember.firstName, firstMember.lastName) : "?"}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{displayName}</p>
                        {lastMsg && (
                          <p className="text-[11px] text-gray-500 truncate">{lastMsg.contentPlain}</p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  } catch (error: any) {
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
