"use client";

import { useEffect, useCallback, createContext, useContext } from "react";
import { useChatStore } from "@/lib/chat/use-chat-store";
import { useWebSocket } from "@/lib/chat/ws-client";
import { updateLastRead } from "@/lib/actions/chat-channels";
import type { MessagePayload, ServerEvent, ClientEvent } from "@/lib/chat/ws-types";

interface ChatContextValue {
  send: (event: ClientEvent) => void;
  isConnected: boolean;
}

const ChatContext = createContext<ChatContextValue>({ send: () => {}, isConnected: false });

export function useChatContext() {
  return useContext(ChatContext);
}

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

  // Set active channel and initial messages
  useEffect(() => {
    setActiveChannel(channelId, channelType);
    setMessages(channelId, initialMessages, hasMore);
  }, [channelId, channelType, initialMessages, hasMore]);

  // Subscribe to channel on WS + mark as read
  useEffect(() => {
    if (isConnected) {
      send({ type: "subscribe", channelId });

      // Mark channel as read
      if (channelType === "channel") {
        updateLastRead(channelId).catch(() => {});
      }

      return () => {
        send({ type: "unsubscribe", channelId });
      };
    }
  }, [isConnected, channelId, send, channelType]);

  return (
    <ChatContext.Provider value={{ send, isConnected }}>
      {children}
    </ChatContext.Provider>
  );
}
