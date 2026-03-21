import { requireAuth } from "@/lib/auth-helpers";
import { getChannelById } from "@/lib/actions/chat-channels";
import { getMessages } from "@/lib/actions/chat-messages";
import { ChannelHeader } from "@/components/chat/channel-header";
import { MessageList } from "@/components/chat/message-list";
import { MessageInput } from "@/components/chat/message-input";
import { ChatProvider } from "@/components/chat/chat-provider";

interface Props {
  params: Promise<{ channelId: string }>;
  searchParams: Promise<{ type?: string }>;
}

export default async function ChannelPage({ params, searchParams }: Props) {
  await requireAuth();
  const { channelId } = await params;
  const { type } = await searchParams;
  const isDm = type === "dm";

  const channel = isDm ? null : await getChannelById(channelId);
  const { messages, hasMore } = await getMessages(channelId, {
    type: isDm ? "dm" : "channel",
  });

  const serializedMessages = messages.map((m) => ({
    id: m.id,
    channelId: m.channelId,
    dmThreadId: m.dmThreadId,
    parentId: m.parentId,
    authorId: m.authorId,
    content: m.content,
    contentPlain: m.contentPlain,
    createdAt: m.createdAt.toISOString(),
    author: m.author,
  }));

  return (
    <ChatProvider
      channelId={channelId}
      channelType={isDm ? "dm" : "channel"}
      initialMessages={serializedMessages}
      hasMore={hasMore}
    >
      <div className="flex flex-col h-full">
        <ChannelHeader
          name={channel?.name ?? "Direct Message"}
          topic={channel?.topic ?? undefined}
          memberCount={channel?._count.members ?? 0}
          isPrivate={channel?.isPrivate ?? false}
          isDm={isDm}
        />
        <MessageList />
        <MessageInput
          channelId={channelId}
          channelType={isDm ? "dm" : "channel"}
          channelName={channel?.name ?? "Direct Message"}
        />
      </div>
    </ChatProvider>
  );
}
