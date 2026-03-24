import { requireAuth } from "@/lib/auth-helpers";
import { getChannelById } from "@/lib/actions/chat-channels";
import { getMessages } from "@/lib/actions/chat-messages";
import { ChannelView } from "@/components/chat/channel-view";
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

  const serializedMessages = messages.map((m: any) => ({
    id: m.id,
    channelId: m.channelId,
    dmThreadId: m.dmThreadId,
    parentId: m.parentId,
    authorId: m.authorId,
    content: m.content,
    contentPlain: m.contentPlain,
    createdAt: m.createdAt.toISOString(),
    author: m.author,
    attachments: (m.attachments || []).map((a: any) => ({
      id: a.id,
      fileName: a.fileName,
      fileType: a.fileType,
      fileSize: a.fileSize,
      url: a.url,
      thumbnailUrl: a.thumbnailUrl,
    })),
  }));

  return (
    <ChatProvider
      channelId={channelId}
      channelType={isDm ? "dm" : "channel"}
      initialMessages={serializedMessages}
      hasMore={hasMore}
    >
      <ChannelView
        channelId={channelId}
        channelType={isDm ? "dm" : "channel"}
        channelName={channel?.name ?? "Direct Message"}
        channelTopic={channel?.topic ?? undefined}
        memberCount={channel?._count.members ?? 0}
        isPrivate={channel?.isPrivate ?? false}
        isDm={isDm}
        members={(channel?.members ?? []).map((m: any) => ({
          id: m.employee.id,
          firstName: m.employee.firstName,
          lastName: m.employee.lastName,
          profilePhoto: m.employee.profilePhoto,
          jobTitle: m.employee.jobTitle,
        }))}
      />
    </ChatProvider>
  );
}
