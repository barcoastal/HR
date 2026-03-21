// src/lib/chat/use-chat-store.ts
"use client";

import { create } from "zustand";
import type { MessagePayload, ServerEvent } from "./ws-types";

interface ChannelInfo {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  topic: string | null;
  isPrivate: boolean;
  isDefault: boolean;
  memberCount: number;
  isStarred: boolean;
  isMuted: boolean;
  unreadCount: number;
}

interface DmThreadInfo {
  id: string;
  isGroup: boolean;
  members: Array<{
    id: string;
    firstName: string;
    lastName: string;
    profilePhoto: string | null;
  }>;
  lastMessage?: {
    content: string;
    createdAt: string;
    authorId: string;
  };
}

interface ChatState {
  // Workspace
  workspaceId: string | null;
  workspaceName: string | null;

  // Channels
  channels: ChannelInfo[];
  activeChannelId: string | null;
  activeChannelType: "channel" | "dm";

  // Messages
  messages: Map<string, MessagePayload[]>;
  hasMore: Map<string, boolean>;

  // DMs
  dmThreads: DmThreadInfo[];

  // Typing
  typingUsers: Map<string, Set<string>>;

  // Actions
  setWorkspace: (id: string, name: string) => void;
  setChannels: (channels: ChannelInfo[]) => void;
  setActiveChannel: (id: string, type: "channel" | "dm") => void;
  setMessages: (channelId: string, messages: MessagePayload[], hasMore: boolean) => void;
  addMessage: (channelId: string, message: MessagePayload) => void;
  updateMessage: (channelId: string, messageId: string, content: string) => void;
  removeMessage: (channelId: string, messageId: string) => void;
  setDmThreads: (threads: DmThreadInfo[]) => void;
  handleServerEvent: (event: ServerEvent) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  workspaceId: null,
  workspaceName: null,
  channels: [],
  activeChannelId: null,
  activeChannelType: "channel",
  messages: new Map(),
  hasMore: new Map(),
  dmThreads: [],
  typingUsers: new Map(),

  setWorkspace: (id, name) => set({ workspaceId: id, workspaceName: name }),

  setChannels: (channels) => set({ channels }),

  setActiveChannel: (id, type) => set({ activeChannelId: id, activeChannelType: type }),

  setMessages: (channelId, messages, hasMore) =>
    set((state) => {
      const newMessages = new Map(state.messages);
      newMessages.set(channelId, messages);
      const newHasMore = new Map(state.hasMore);
      newHasMore.set(channelId, hasMore);
      return { messages: newMessages, hasMore: newHasMore };
    }),

  addMessage: (channelId, message) =>
    set((state) => {
      const newMessages = new Map(state.messages);
      const existing = newMessages.get(channelId) || [];
      if (!existing.some((m) => m.id === message.id)) {
        newMessages.set(channelId, [...existing, message]);
      }
      return { messages: newMessages };
    }),

  updateMessage: (channelId, messageId, content) =>
    set((state) => {
      const newMessages = new Map(state.messages);
      const existing = newMessages.get(channelId);
      if (existing) {
        newMessages.set(
          channelId,
          existing.map((m) =>
            m.id === messageId ? { ...m, content, contentPlain: content } : m
          )
        );
      }
      return { messages: newMessages };
    }),

  removeMessage: (channelId, messageId) =>
    set((state) => {
      const newMessages = new Map(state.messages);
      const existing = newMessages.get(channelId);
      if (existing) {
        newMessages.set(
          channelId,
          existing.filter((m) => m.id !== messageId)
        );
      }
      return { messages: newMessages };
    }),

  setDmThreads: (threads) => set({ dmThreads: threads }),

  handleServerEvent: (event) => {
    const state = get();
    switch (event.type) {
      case "message:new":
        state.addMessage(event.channelId, event.message);
        break;
      case "message:update":
        state.updateMessage(event.channelId, event.messageId, event.content);
        break;
      case "message:delete":
        state.removeMessage(event.channelId, event.messageId);
        break;
      case "typing": {
        set((s) => {
          const newTyping = new Map(s.typingUsers);
          const users = new Set(newTyping.get(event.channelId) || []);
          users.add(event.userId);
          newTyping.set(event.channelId, users);
          setTimeout(() => {
            set((s2) => {
              const t = new Map(s2.typingUsers);
              const u = new Set(t.get(event.channelId) || []);
              u.delete(event.userId);
              t.set(event.channelId, u);
              return { typingUsers: t };
            });
          }, 3000);
          return { typingUsers: newTyping };
        });
        break;
      }
    }
  },
}));
