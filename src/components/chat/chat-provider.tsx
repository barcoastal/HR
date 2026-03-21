"use client";

import { useEffect, useCallback } from "react";
import { useChatStore } from "@/lib/chat/use-chat-store";
import { useWebSocket } from "@/lib/chat/ws-client";
import type { MessagePayload, ServerEvent } from "@/lib/chat/ws-types";

interface Props {
  channelId: string;
  channelType: "channel" | "dm";
  initialMessages: MessagePayload[];
  hasMore: boolean;
  children: React.ReactNode;
}

export function ChatProvider({
  channelId,
  channelType,
  initialMessages,
  hasMore,
  children,
}: Props) {
  const { setActiveChannel, setMessages, handleServerEvent } = useChatStore();

  const onEvent = useCallback(
    (event: ServerEvent) => {
      handleServerEvent(event);
    },
    [handleServerEvent]
  );

  const { send, isConnected } = useWebSocket(onEvent);

  useEffect(() => {
    setActiveChannel(channelId, channelType);
    setMessages(channelId, initialMessages, hasMore);
  }, [channelId, channelType, initialMessages, hasMore]);

  useEffect(() => {
    if (isConnected) {
      send({ type: "subscribe", channelId });
      return () => {
        send({ type: "unsubscribe", channelId });
      };
    }
  }, [isConnected, channelId, send]);

  return <>{children}</>;
}
