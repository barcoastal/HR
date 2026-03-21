# HT Platform Phase 2: Rich Messaging — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the plain-text chat to a full rich messaging experience with formatting, emoji, reactions, file uploads, message actions, and @mentions.

**Architecture:** Replace the textarea with a TipTap rich text editor. Add Prisma models for Reaction, ChatAttachment, Mention, PinnedMessage, SavedMessage. Add new server actions and WS event types for each feature. Each feature is independent and commits separately.

**Tech Stack:** TipTap (rich text), emoji-mart (emoji picker), Shiki (syntax highlighting), existing Prisma/PostgreSQL + WS infrastructure

**Spec:** `docs/superpowers/specs/2026-03-21-ht-platform-design.md` — Phase 2

---

## File Structure

### New Prisma models (added to schema.prisma)
- `Reaction` — emoji reactions on messages
- `ChatAttachment` — file uploads on messages
- `Mention` — @user, @channel, @here, @everyone mentions
- `PinnedMessage` — pinned messages per channel
- `SavedMessage` — bookmarked messages per user

### New/Modified files
- `src/components/chat/message-input.tsx` — **rewrite**: replace textarea with TipTap editor
- `src/components/chat/message-item.tsx` — **modify**: add reactions bar, message actions toolbar, rich content rendering
- `src/components/chat/emoji-picker.tsx` — **create**: searchable emoji picker component
- `src/components/chat/message-actions.tsx` — **create**: hover toolbar with react, edit, delete, pin, save, copy link
- `src/components/chat/reaction-bar.tsx` — **create**: emoji reaction display + add reaction
- `src/components/chat/file-upload.tsx` — **create**: drag & drop file upload + preview
- `src/components/chat/mention-list.tsx` — **create**: @mention autocomplete dropdown for TipTap
- `src/lib/actions/chat-reactions.ts` — **create**: add/remove reactions
- `src/lib/actions/chat-messages.ts` — **modify**: add pin, save, file upload support
- `src/lib/chat/ws-types.ts` — **modify**: add reaction events
- `src/app/api/chat/upload/route.ts` — **create**: file upload API endpoint
- `prisma/schema.prisma` — **modify**: add Phase 2 models + Employee relations

---

## Task 1: Add Phase 2 Prisma Models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add Reaction, ChatAttachment, Mention, PinnedMessage, SavedMessage models**

Add to Employee model relations (before `@@index` lines):
```prisma
  chatReactions        Reaction[]       @relation("ChatReactions")
  savedMessages        SavedMessage[]
  pinnedMessages       PinnedMessage[]
```

Add to Message model relations:
```prisma
  reactions     Reaction[]
  attachments   ChatAttachment[]
  mentions      Mention[]
  pins          PinnedMessage[]
  savedBy       SavedMessage[]
```

Add new models at the end of schema:
```prisma
model Reaction {
  id        String   @id @default(uuid())
  messageId String
  employeeId String
  emoji     String

  message   Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)
  employee  Employee @relation("ChatReactions", fields: [employeeId], references: [id], onDelete: Cascade)

  @@unique([messageId, employeeId, emoji])
  @@index([messageId])
}

model ChatAttachment {
  id        String   @id @default(uuid())
  messageId String
  fileName  String
  fileType  String
  fileSize  Int
  url       String
  thumbnailUrl String?
  createdAt DateTime @default(now())

  message   Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@index([messageId])
}

model Mention {
  id        String      @id @default(uuid())
  messageId String
  type      MentionType
  targetId  String

  message   Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@index([targetId, type])
  @@index([messageId])
}

enum MentionType {
  USER
  CHANNEL
  HERE
  EVERYONE
  USER_GROUP
}

model PinnedMessage {
  id        String   @id @default(uuid())
  channelId String
  messageId String
  pinnedById String
  pinnedAt  DateTime @default(now())

  channel   Channel  @relation(fields: [channelId], references: [id], onDelete: Cascade)
  message   Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)
  pinnedBy  Employee @relation(fields: [pinnedById], references: [id])

  @@unique([channelId, messageId])
}

model SavedMessage {
  id         String   @id @default(uuid())
  employeeId String
  messageId  String
  savedAt    DateTime @default(now())

  employee   Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  message    Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)

  @@unique([employeeId, messageId])
}
```

Also add `pins PinnedMessage[]` to the Channel model.

- [ ] **Step 2: Push schema**

Run: `npx prisma db push && npx prisma generate`

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(chat): add Phase 2 models — reactions, attachments, mentions, pins, saved"
```

---

## Task 2: Install TipTap & Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install TipTap and related packages**

```bash
cd /Users/baralezrah/hr-platform
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder @tiptap/extension-mention @tiptap/extension-link @tiptap/extension-code-block-lowlight @tiptap/extension-underline @tiptap/pm lowlight @emoji-mart/data @emoji-mart/react
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(chat): install TipTap, emoji-mart, and lowlight dependencies"
```

---

## Task 3: Rich Text Editor (TipTap Message Input)

**Files:**
- Rewrite: `src/components/chat/message-input.tsx`

- [ ] **Step 1: Replace textarea with TipTap editor**

Rewrite `message-input.tsx` to use TipTap with:
- StarterKit (bold, italic, strike, code, codeBlock, bulletList, orderedList, blockquote)
- Placeholder extension ("Message #channel-name")
- Link extension
- Underline extension
- "Aa" button that toggles a formatting toolbar above the editor
- Formatting toolbar: bold, italic, strikethrough, code, code block, bullet list, numbered list, blockquote, link
- Bottom bar: file upload button (placeholder), emoji button (placeholder), @mention button (placeholder), "Aa" toggle, send button
- Enter to send (Shift+Enter for newline)
- Extract plain text from editor for `contentPlain`
- Extract HTML content for `content` field

```tsx
"use client";

import { useCallback, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import LinkExtension from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import { sendMessage } from "@/lib/actions/chat-messages";
import { useChatStore } from "@/lib/chat/use-chat-store";
import type { MessagePayload } from "@/lib/chat/ws-types";

interface Props {
  channelId: string;
  channelType: "channel" | "dm";
  channelName: string;
}

export function MessageInput({ channelId, channelType, channelName }: Props) {
  const [sending, setSending] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const { addMessage } = useChatStore();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: { HTMLAttributes: { class: "chat-code-block" } },
      }),
      Placeholder.configure({
        placeholder: `Message ${channelType === "channel" ? "#" : ""}${channelName}`,
      }),
      LinkExtension.configure({ openOnClick: false }),
      Underline,
    ],
    editorProps: {
      attributes: {
        class: "outline-none px-4 py-3 text-sm min-h-[44px] max-h-[200px] overflow-y-auto prose prose-sm max-w-none",
      },
      handleKeyDown: (_view, event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          handleSubmit();
          return true;
        }
        return false;
      },
    },
  });

  const handleSubmit = useCallback(async () => {
    if (!editor || sending) return;
    const html = editor.getHTML();
    const text = editor.getText().trim();
    if (!text) return;

    setSending(true);
    editor.commands.clearContent();

    const tempId = `temp-${Date.now()}`;
    const optimistic: MessagePayload = {
      id: tempId,
      channelId: channelType === "channel" ? channelId : null,
      dmThreadId: channelType === "dm" ? channelId : null,
      parentId: null,
      authorId: "self",
      content: html,
      contentPlain: text,
      createdAt: new Date().toISOString(),
      author: { id: "self", firstName: "You", lastName: "", profilePhoto: null },
    };
    addMessage(channelId, optimistic);

    try {
      await sendMessage({ channelId, content: html, contentPlain: text, type: channelType });
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
      editor?.commands.focus();
    }
  }, [editor, sending, channelId, channelType, addMessage]);

  if (!editor) return null;

  return (
    <div className="px-5 py-3 border-t border-gray-200 bg-white flex-shrink-0">
      <div className="border border-gray-300 rounded-xl overflow-hidden focus-within:border-[#7C3AED] focus-within:ring-1 focus-within:ring-[#7C3AED]/20 transition-colors">
        {/* Formatting toolbar (toggled) */}
        {showToolbar && (
          <div className="flex items-center gap-1 px-3 py-1.5 border-b border-gray-100">
            <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} label="B" className="font-bold" />
            <ToolbarButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} label="I" className="italic" />
            <ToolbarButton active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} label="S" className="line-through" />
            <ToolbarButton active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} label="U" className="underline" />
            <div className="w-px h-5 bg-gray-200 mx-1" />
            <ToolbarButton active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()} label="<>" className="font-mono text-[10px]" />
            <ToolbarButton active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} label="{}" className="font-mono text-[10px]" />
            <div className="w-px h-5 bg-gray-200 mx-1" />
            <ToolbarButton active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} label="•" />
            <ToolbarButton active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} label="1." />
            <ToolbarButton active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} label="❝" />
          </div>
        )}

        {/* Editor */}
        <EditorContent editor={editor} />

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50/50">
          <div className="flex gap-1">
            <button className="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-[15px]">
              <span className="material-symbols-rounded text-[18px]">attach_file</span>
            </button>
            <button className="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <span className="material-symbols-rounded text-[18px]">mood</span>
            </button>
            <button className="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-xs font-semibold">
              @
            </button>
            <button
              onClick={() => setShowToolbar(!showToolbar)}
              className={`w-7 h-7 rounded flex items-center justify-center transition-colors text-xs font-semibold ${
                showToolbar ? "bg-[#7C3AED]/10 text-[#7C3AED]" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              }`}
            >
              Aa
            </button>
          </div>
          <button
            onClick={handleSubmit}
            disabled={sending}
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-rounded text-[18px]">send</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({ active, onClick, label, className = "" }: { active: boolean; onClick: () => void; label: string; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-7 h-7 rounded flex items-center justify-center text-xs transition-colors ${className} ${
        active ? "bg-[#7C3AED]/10 text-[#7C3AED]" : "text-gray-500 hover:bg-gray-100"
      }`}
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 2: Update sendMessage action to accept contentPlain separately**

Modify `src/lib/actions/chat-messages.ts` — change the `sendMessage` function signature:

```typescript
export async function sendMessage(data: {
  channelId: string;
  content: string;
  contentPlain?: string;  // Add this
  type?: "channel" | "dm";
}) {
  // ... existing code, but use:
  content: data.content,
  contentPlain: data.contentPlain || data.content,
```

- [ ] **Step 3: Add TipTap prose styles**

Add to `src/app/globals.css` (or create `src/styles/chat.css` and import it):

```css
/* TipTap chat editor styles */
.tiptap p.is-editor-empty:first-child::before {
  color: #9ca3af;
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}

.chat-code-block {
  background: #1e1e2e;
  color: #cdd6f4;
  border-radius: 8px;
  padding: 12px 16px;
  font-family: ui-monospace, monospace;
  font-size: 13px;
  margin: 8px 0;
}

.tiptap code {
  background: #f3f4f6;
  border-radius: 4px;
  padding: 2px 4px;
  font-size: 13px;
  color: #e11d48;
}

.tiptap blockquote {
  border-left: 3px solid #7C3AED;
  padding-left: 12px;
  color: #6b7280;
  margin: 8px 0;
}

.tiptap ul, .tiptap ol {
  padding-left: 24px;
  margin: 4px 0;
}

.tiptap a {
  color: #7C3AED;
  text-decoration: underline;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/chat/message-input.tsx src/lib/actions/chat-messages.ts src/app/globals.css
git commit -m "feat(chat): replace textarea with TipTap rich text editor"
```

---

## Task 4: Rich Message Rendering

**Files:**
- Modify: `src/components/chat/message-item.tsx`

- [ ] **Step 1: Update message-item to render HTML content**

Replace the plain text `<p>` with `dangerouslySetInnerHTML` for the `content` field (which now contains HTML from TipTap). Add prose styles for proper rendering.

The message item should render `message.content` (HTML) instead of `message.contentPlain`. Add the `prose` class for styling.

```tsx
{/* Replace the plain text paragraph with: */}
<div
  className="text-sm text-gray-800 mt-0.5 prose prose-sm max-w-none [&>p]:my-0"
  dangerouslySetInnerHTML={{ __html: message.content }}
/>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/chat/message-item.tsx
git commit -m "feat(chat): render rich text HTML in messages"
```

---

## Task 5: Emoji Reactions

**Files:**
- Create: `src/lib/actions/chat-reactions.ts`
- Create: `src/components/chat/reaction-bar.tsx`
- Modify: `src/components/chat/message-item.tsx`
- Modify: `src/lib/chat/ws-types.ts`

- [ ] **Step 1: Create reactions server action**

```typescript
// src/lib/actions/chat-reactions.ts
"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import type { BroadcastEvent } from "@/lib/chat/ws-types";

const WS_SERVER_URL = process.env.WS_SERVER_URL || "http://localhost:3001";
const WS_INTERNAL_SECRET = process.env.WS_INTERNAL_SECRET || "dev-secret";

async function broadcastToWs(event: any) {
  try {
    await fetch(`${WS_SERVER_URL}/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${WS_INTERNAL_SECRET}` },
      body: JSON.stringify(event),
    });
  } catch (error) {
    console.error("Failed to broadcast to WS server:", error);
  }
}

export async function toggleReaction(messageId: string, emoji: string) {
  const session = await requireAuth();
  const employeeId = session.user.employeeId!;

  const message = await db.message.findUnique({ where: { id: messageId }, select: { channelId: true, dmThreadId: true } });
  if (!message) throw new Error("Message not found");
  const channelId = message.channelId || message.dmThreadId;

  const existing = await db.reaction.findUnique({
    where: { messageId_employeeId_emoji: { messageId, employeeId, emoji } },
  });

  if (existing) {
    await db.reaction.delete({ where: { id: existing.id } });
    if (channelId) {
      await broadcastToWs({ type: "reaction:remove", channelId, messageId, emoji, userId: employeeId });
    }
    return { action: "removed" };
  } else {
    await db.reaction.create({ data: { messageId, employeeId, emoji } });
    if (channelId) {
      await broadcastToWs({ type: "reaction:add", channelId, messageId, emoji, userId: employeeId });
    }
    return { action: "added" };
  }
}

export async function getReactions(messageId: string) {
  await requireAuth();
  return db.reaction.findMany({
    where: { messageId },
    include: { employee: { select: { id: true, firstName: true, lastName: true } } },
  });
}
```

- [ ] **Step 2: Add reaction events to ws-types.ts**

Add `reaction:add` and `reaction:remove` to `ServerEvent` if not already there (check existing types).

- [ ] **Step 3: Create reaction-bar component**

```tsx
// src/components/chat/reaction-bar.tsx
"use client";

import { toggleReaction } from "@/lib/actions/chat-reactions";

interface ReactionGroup {
  emoji: string;
  count: number;
  hasReacted: boolean;
}

interface Props {
  messageId: string;
  reactions: ReactionGroup[];
  onReactionToggle?: () => void;
}

export function ReactionBar({ messageId, reactions, onReactionToggle }: Props) {
  if (reactions.length === 0) return null;

  const handleToggle = async (emoji: string) => {
    await toggleReaction(messageId, emoji);
    onReactionToggle?.();
  };

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          onClick={() => handleToggle(r.emoji)}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
            r.hasReacted
              ? "bg-[#7C3AED]/10 border-[#7C3AED]/30 text-[#7C3AED]"
              : "bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200"
          }`}
        >
          <span>{r.emoji}</span>
          <span>{r.count}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Add reactions to message-item.tsx**

Fetch reactions for each message and display the ReactionBar below the message content. For Phase 2, reactions will be loaded with the message data from the server.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/chat-reactions.ts src/components/chat/reaction-bar.tsx src/components/chat/message-item.tsx src/lib/chat/ws-types.ts
git commit -m "feat(chat): add emoji reactions with toggle and display"
```

---

## Task 6: Message Actions Toolbar

**Files:**
- Create: `src/components/chat/message-actions.tsx`
- Modify: `src/components/chat/message-item.tsx`
- Modify: `src/lib/actions/chat-messages.ts`

- [ ] **Step 1: Create message actions component**

A hover toolbar that appears on message hover with: React (emoji), Edit (own messages), Delete (own messages), Pin, Save/Bookmark, Copy Link.

```tsx
// src/components/chat/message-actions.tsx
"use client";

import { useState } from "react";
import { deleteMessage, pinMessage, saveMessage } from "@/lib/actions/chat-messages";
import { toggleReaction } from "@/lib/actions/chat-reactions";

interface Props {
  messageId: string;
  channelId: string;
  isOwnMessage: boolean;
  onEdit?: () => void;
  onRefresh?: () => void;
}

const QUICK_EMOJIS = ["👍", "❤️", "😂", "🎉", "🚀", "👀"];

export function MessageActions({ messageId, channelId, isOwnMessage, onEdit, onRefresh }: Props) {
  const [showEmojiRow, setShowEmojiRow] = useState(false);

  const handleReact = async (emoji: string) => {
    await toggleReaction(messageId, emoji);
    setShowEmojiRow(false);
    onRefresh?.();
  };

  const handleDelete = async () => {
    if (confirm("Delete this message?")) {
      await deleteMessage(messageId);
    }
  };

  const handlePin = async () => {
    await pinMessage(messageId, channelId);
    onRefresh?.();
  };

  const handleSave = async () => {
    await saveMessage(messageId);
    onRefresh?.();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/chat/${channelId}#${messageId}`);
  };

  return (
    <div className="absolute -top-3 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
      {showEmojiRow && (
        <div className="flex gap-1 mb-1 bg-white rounded-lg shadow-lg border border-gray-200 px-2 py-1">
          {QUICK_EMOJIS.map((emoji) => (
            <button key={emoji} onClick={() => handleReact(emoji)} className="hover:scale-125 transition-transform text-base">
              {emoji}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center bg-white rounded-lg shadow-lg border border-gray-200">
        <ActionButton icon="mood" title="React" onClick={() => setShowEmojiRow(!showEmojiRow)} />
        {isOwnMessage && <ActionButton icon="edit" title="Edit" onClick={onEdit} />}
        <ActionButton icon="push_pin" title="Pin" onClick={handlePin} />
        <ActionButton icon="bookmark" title="Save" onClick={handleSave} />
        <ActionButton icon="link" title="Copy link" onClick={handleCopyLink} />
        {isOwnMessage && <ActionButton icon="delete" title="Delete" onClick={handleDelete} className="text-red-400 hover:text-red-600" />}
      </div>
    </div>
  );
}

function ActionButton({ icon, title, onClick, className = "" }: { icon: string; title: string; onClick?: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors ${className}`}
    >
      <span className="material-symbols-rounded text-[16px]">{icon}</span>
    </button>
  );
}
```

- [ ] **Step 2: Add pinMessage and saveMessage to chat-messages.ts**

```typescript
export async function pinMessage(messageId: string, channelId: string) {
  const session = await requireAuth();
  const employeeId = session.user.employeeId!;

  const existing = await db.pinnedMessage.findUnique({
    where: { channelId_messageId: { channelId, messageId } },
  });

  if (existing) {
    await db.pinnedMessage.delete({ where: { id: existing.id } });
    return { action: "unpinned" };
  }

  await db.pinnedMessage.create({
    data: { channelId, messageId, pinnedById: employeeId },
  });
  return { action: "pinned" };
}

export async function saveMessage(messageId: string) {
  const session = await requireAuth();
  const employeeId = session.user.employeeId!;

  const existing = await db.savedMessage.findUnique({
    where: { employeeId_messageId: { employeeId, messageId } },
  });

  if (existing) {
    await db.savedMessage.delete({ where: { id: existing.id } });
    return { action: "unsaved" };
  }

  await db.savedMessage.create({ data: { employeeId, messageId } });
  return { action: "saved" };
}
```

- [ ] **Step 3: Integrate MessageActions into message-item.tsx**

Add the hover toolbar to each message. The message item needs `position: relative` and the actions appear on hover.

- [ ] **Step 4: Commit**

```bash
git add src/components/chat/message-actions.tsx src/components/chat/message-item.tsx src/lib/actions/chat-messages.ts
git commit -m "feat(chat): add message actions toolbar — react, edit, delete, pin, save, copy link"
```

---

## Task 7: Emoji Picker

**Files:**
- Create: `src/components/chat/emoji-picker.tsx`
- Modify: `src/components/chat/message-input.tsx`

- [ ] **Step 1: Create emoji picker wrapper**

Wrap `@emoji-mart/react` in a component that can be used in the message input and the reaction picker.

```tsx
// src/components/chat/emoji-picker.tsx
"use client";

import { useEffect, useRef } from "react";
import data from "@emoji-mart/data";
import Picker from "@emoji-mart/react";

interface Props {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute bottom-full mb-2 right-0 z-50">
      <Picker
        data={data}
        onEmojiSelect={(emoji: any) => onSelect(emoji.native)}
        theme="light"
        previewPosition="none"
        skinTonePosition="none"
        maxFrequentRows={2}
      />
    </div>
  );
}
```

- [ ] **Step 2: Wire emoji picker to message input**

Add a state toggle for the emoji picker in `message-input.tsx`. When an emoji is selected, insert it at the cursor position in TipTap via `editor.commands.insertContent(emoji)`.

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/emoji-picker.tsx src/components/chat/message-input.tsx
git commit -m "feat(chat): add emoji picker to message composer"
```

---

## Task 8: File Upload

**Files:**
- Create: `src/app/api/chat/upload/route.ts`
- Create: `src/components/chat/file-upload.tsx`
- Modify: `src/components/chat/message-input.tsx`

- [ ] **Step 1: Create upload API route**

Store files in `public/uploads/chat/` for now (Railway volume or S3 later).

```typescript
// src/app/api/chat/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/auth-helpers";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  const session = await requireApiAuth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const uploadDir = path.join(process.cwd(), "public", "uploads", "chat");
  await mkdir(uploadDir, { recursive: true });

  const ext = path.extname(file.name);
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const filepath = path.join(uploadDir, filename);
  await writeFile(filepath, buffer);

  return NextResponse.json({
    url: `/uploads/chat/${filename}`,
    fileName: file.name,
    fileType: file.type,
    fileSize: file.size,
  });
}
```

- [ ] **Step 2: Create file upload component with drag & drop**

A component that handles drag & drop over the message area and a file button click. Shows a preview of selected files before sending.

- [ ] **Step 3: Wire file upload to message input**

Add a file attachment button in the bottom bar. Uploaded files are sent as part of the message (the file URL is embedded in the message content or stored as attachments).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/chat/upload/route.ts src/components/chat/file-upload.tsx src/components/chat/message-input.tsx
git commit -m "feat(chat): add file upload with drag & drop"
```

---

## Task 9: Final Build & Deploy

- [ ] **Step 1: Build and fix any TypeScript errors**

Run: `npx next build`
Fix any errors.

- [ ] **Step 2: Commit all fixes**

```bash
git add -A
git commit -m "fix(chat): resolve Phase 2 build errors"
```

- [ ] **Step 3: Push to main**

```bash
git push origin main
```
