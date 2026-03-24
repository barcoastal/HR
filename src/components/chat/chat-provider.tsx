"use client";

import { useEffect, useCallback, createContext, useContext } from "react";
import { useSession } from "next-auth/react";
import { useChatStore } from "@/lib/chat/use-chat-store";
import { useWebSocket } from "@/lib/chat/ws-client";
import { updateLastRead } from "@/lib/actions/chat-channels";
import type { MessagePayload, ServerEvent, ClientEvent } from "@/lib/chat/ws-types";

function playNotificationSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    gain.gain.value = 0.1;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
}

function showBrowserNotification(title: string, body: string) {
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "/api/favicon" });
  }
}

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
  const { data: session } = useSession();
  const currentEmployeeId = (session?.user as { employeeId?: string } | undefined)?.employeeId;

  const onEvent = useCallback(
    (event: ServerEvent) => {
      if (
        event.type === "message:new" &&
        event.message.authorId !== currentEmployeeId
      ) {
        playNotificationSound();
        showBrowserNotification(
          `${event.message.author.firstName} ${event.message.author.lastName}`,
          event.message.contentPlain || event.message.content
        );
      }
      handleServerEvent(event);
    },
    [handleServerEvent, currentEmployeeId]
  );

  const { send, isConnected } = useWebSocket(onEvent);

  // Request browser notification permission on first load
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

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
