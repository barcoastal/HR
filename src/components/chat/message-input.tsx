"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { EmojiPicker } from "./emoji-picker";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import LinkExtension from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Mention from "@tiptap/extension-mention";
import { sendMessage } from "@/lib/actions/chat-messages";
import { getWorkspaceMembers } from "@/lib/actions/chat-workspace";
import { useChatStore } from "@/lib/chat/use-chat-store";
import { useChatContext } from "./chat-provider";
import type { MessagePayload } from "@/lib/chat/ws-types";

interface UploadedFile {
  fileName: string;
  fileType: string;
  fileSize: number;
  url: string;
}

interface Props {
  channelId: string;
  channelType: "channel" | "dm";
  channelName: string;
  replyTo?: MessagePayload | null;
  onClearReply?: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();
}

let cachedMembers: any[] | null = null;

export function MessageInput({ channelId, channelType, channelName, replyTo, onClearReply }: Props) {
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionItems, setMentionItems] = useState<any[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionCommand, setMentionCommand] = useState<((props: { id: string; label: string }) => void) | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { addMessage, workspaceId } = useChatStore();
  const { send: wsSend } = useChatContext();

  // Send typing indicator
  const sendTyping = useCallback(() => {
    wsSend({ type: "typing:start", channelId });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      wsSend({ type: "typing:stop", channelId });
    }, 3000);
  }, [wsSend, channelId]);

  useEffect(() => {
    if (workspaceId && !cachedMembers) {
      getWorkspaceMembers(workspaceId).then((m: any) => {
        cachedMembers = m;
      });
    }
  }, [workspaceId]);

  const editor = useEditor({
    onUpdate: () => sendTyping(),
    extensions: [
      StarterKit.configure({
        codeBlock: { HTMLAttributes: { class: "chat-code-block" } },
      }),
      Placeholder.configure({
        placeholder: `Message ${channelType === "channel" ? "#" : ""}${channelName}`,
      }),
      LinkExtension.configure({ openOnClick: false }),
      Underline,
      Mention.configure({
        HTMLAttributes: { class: "mention" },
        suggestion: {
          items: ({ query }: { query: string }) => {
            if (!cachedMembers) return [];
            return cachedMembers
              .filter((m: any) =>
                `${m.firstName} ${m.lastName}`.toLowerCase().includes(query.toLowerCase())
              )
              .slice(0, 8);
          },
          render: () => {
            return {
              onStart: (props: any) => {
                setMentionQuery(props.query);
                setMentionItems(props.items);
                setMentionIndex(0);
                setMentionCommand(() => props.command);
              },
              onUpdate: (props: any) => {
                setMentionQuery(props.query);
                setMentionItems(props.items);
                setMentionIndex(0);
                setMentionCommand(() => props.command);
              },
              onKeyDown: (props: any) => {
                if (props.event.key === "ArrowUp") {
                  setMentionIndex((prev) => (prev + mentionItems.length - 1) % mentionItems.length);
                  return true;
                }
                if (props.event.key === "ArrowDown") {
                  setMentionIndex((prev) => (prev + 1) % mentionItems.length);
                  return true;
                }
                if (props.event.key === "Enter" || props.event.key === "Tab") {
                  const item = mentionItems[mentionIndex];
                  if (item && mentionCommand) {
                    mentionCommand({ id: item.id, label: `${item.firstName} ${item.lastName}` });
                  }
                  return true;
                }
                if (props.event.key === "Escape") {
                  setMentionQuery(null);
                  return true;
                }
                return false;
              },
              onExit: () => {
                setMentionQuery(null);
                setMentionItems([]);
                setMentionCommand(null);
              },
            };
          },
        },
      }),
    ],
    editorProps: {
      attributes: {
        class: "outline-none px-4 py-3 text-sm min-h-[44px] max-h-[200px] overflow-y-auto",
      },
      handleKeyDown: (_view, event) => {
        // Don't submit if mention dropdown is open
        if (mentionQuery !== null) return false;

        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          handleSubmit();
          return true;
        }
        return false;
      },
    },
  });

  const handleFileUpload = useCallback(async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/chat/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setPendingFiles((prev) => [...prev, data]);
    } catch (error) {
      console.error("File upload failed:", error);
    } finally {
      setUploading(false);
    }
  }, []);

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = useCallback(async () => {
    if (!editor || sending) return;
    const html = editor.getHTML();
    const text = editor.getText().trim();
    if (!text && pendingFiles.length === 0) return;

    setSending(true);
    editor.commands.clearContent();
    const filesToSend = [...pendingFiles];
    setPendingFiles([]);

    const tempId = `temp-${Date.now()}`;
    const optimistic: MessagePayload = {
      id: tempId,
      channelId: channelType === "channel" ? channelId : null,
      dmThreadId: channelType === "dm" ? channelId : null,
      parentId: null,
      authorId: "self",
      content: text ? html : "<p></p>",
      contentPlain: text || (filesToSend.length > 0 ? `[${filesToSend.length} file(s)]` : ""),
      createdAt: new Date().toISOString(),
      attachments: filesToSend.map((f, i) => ({ id: `temp-att-${i}`, ...f, thumbnailUrl: null })),
      author: { id: "self", firstName: "You", lastName: "", profilePhoto: null },
    };
    addMessage(channelId, optimistic);

    try {
      await sendMessage({
        channelId,
        content: text ? html : "",
        contentPlain: text || (filesToSend.length > 0 ? `[${filesToSend.length} file(s)]` : ""),
        type: channelType,
        parentId: replyTo?.id,
        attachments: filesToSend,
      });
      onClearReply?.();
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
      editor?.commands.focus();
    }
  }, [editor, sending, channelId, channelType, addMessage, pendingFiles]);

  const triggerMention = () => {
    if (!editor) return;
    editor.commands.focus();
    editor.commands.insertContent("@");
  };

  if (!editor) return null;

  return (
    <div className="px-5 py-3 border-t border-gray-200 bg-white flex-shrink-0">
      <div className="border border-gray-300 rounded-xl overflow-hidden focus-within:border-[#7C3AED] focus-within:ring-1 focus-within:ring-[#7C3AED]/20 transition-colors relative">

        {/* Mention dropdown */}
        {mentionQuery !== null && mentionItems.length > 0 && (
          <div className="absolute bottom-full left-4 mb-1 z-50 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden max-h-52 overflow-y-auto min-w-[220px]">
            {mentionItems.map((item: any, index: number) => (
              <button
                key={item.id}
                onClick={() => {
                  if (mentionCommand) {
                    mentionCommand({ id: item.id, label: `${item.firstName} ${item.lastName}` });
                  }
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                  index === mentionIndex ? "bg-[#7C3AED]/10 text-[#7C3AED]" : "hover:bg-gray-50 text-gray-800"
                }`}
              >
                {item.profilePhoto ? (
                  <img src={item.profilePhoto} alt="" className="w-6 h-6 rounded-md object-cover flex-shrink-0" />
                ) : (
                  <div className="w-6 h-6 rounded-md bg-[#7C3AED] flex items-center justify-center text-white text-[9px] font-semibold flex-shrink-0">
                    {getInitials(item.firstName, item.lastName)}
                  </div>
                )}
                <span>{item.firstName} {item.lastName}</span>
              </button>
            ))}
          </div>
        )}

        {/* Always-visible formatting toolbar (Slack-style) */}
        <div className="flex items-center gap-0.5 px-2 py-1 border-b border-gray-100 overflow-x-auto">
          <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} label="B" className="font-bold" />
          <ToolbarButton active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} label="I" className="italic" />
          <ToolbarButton active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} label="U" className="underline" />
          <ToolbarButton active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} label="S" className="line-through" />
          <div className="w-px h-4 bg-gray-200 mx-0.5 shrink-0" />
          <ToolbarButton active={false} onClick={() => { const url = prompt("Enter link URL:"); if (url) editor.chain().focus().setLink({ href: url }).run(); }} icon="link" />
          <div className="w-px h-4 bg-gray-200 mx-0.5 shrink-0" />
          <ToolbarButton active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} icon="format_list_numbered" />
          <ToolbarButton active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} icon="format_list_bulleted" />
          <div className="w-px h-4 bg-gray-200 mx-0.5 shrink-0" />
          <ToolbarButton active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} icon="code" />
          <ToolbarButton active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} icon="format_quote" />
        </div>

        <EditorContent editor={editor} />

        {pendingFiles.length > 0 && (
          <div className="px-3 py-2 flex flex-wrap gap-2 border-t border-gray-100">
            {pendingFiles.map((f, i) => (
              <div key={i} className="relative group">
                {f.fileType.startsWith("image/") ? (
                  <img src={f.url} alt={f.fileName} className="h-20 rounded-lg object-cover border border-gray-200" />
                ) : (
                  <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 text-xs text-gray-700">
                    <span className="material-symbols-rounded text-[16px]">description</span>
                    <span className="truncate max-w-[120px]">{f.fileName}</span>
                    <span className="text-gray-400">{formatFileSize(f.fileSize)}</span>
                  </div>
                )}
                <button
                  onClick={() => removePendingFile(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between px-2 py-1 bg-gray-50/50">
          <div className="flex gap-0.5">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = e.target.files;
                if (files) Array.from(files).forEach((f) => handleFileUpload(f));
                e.target.value = "";
              }}
            />
            {/* Add attachment */}
            <ToolbarButton
              active={false}
              onClick={() => fileInputRef.current?.click()}
              icon={uploading ? "hourglass_empty" : "add"}
            />
            <div className="w-px h-4 bg-gray-200 mx-0.5 shrink-0 self-center" />
            {/* Emoji */}
            <div className="relative">
              <ToolbarButton
                active={showEmoji}
                onClick={() => setShowEmoji(!showEmoji)}
                icon="mood"
              />
              {showEmoji && (
                <EmojiPicker
                  onSelect={(emoji) => {
                    editor?.commands.insertContent(emoji);
                    setShowEmoji(false);
                    editor?.commands.focus();
                  }}
                  onClose={() => setShowEmoji(false)}
                />
              )}
            </div>
            {/* @Mention */}
            <ToolbarButton active={false} onClick={triggerMention} label="@" />
            {/* Google Meet */}
            <ToolbarButton
              active={false}
              onClick={async () => {
                if (!editor) return;
                try {
                  const res = await fetch("/api/chat/meet", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ title: `Meeting in #${channelName}` }),
                  });
                  if (!res.ok) {
                    const err = await res.json().catch(() => ({}));
                    alert(err.error || "Failed to create meeting");
                    return;
                  }
                  const { meetLink } = await res.json();
                  editor.commands.insertContent(
                    `<p>📹 <a href="${meetLink}" target="_blank">Join Google Meet</a></p>`
                  );
                  editor.commands.focus();
                } catch {
                  alert("Failed to create Google Meet. Check your calendar connection in Settings.");
                }
              }}
              icon="video_call"
            />
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleSubmit}
              disabled={sending}
              className="h-7 px-3 rounded-lg flex items-center justify-center gap-1 bg-[#007a5a] text-white hover:bg-[#006b4f] transition-colors disabled:opacity-50 text-xs font-medium"
            >
              <span className="material-symbols-rounded text-[16px]">send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({ active, onClick, label, icon, className = "" }: { active: boolean; onClick: () => void; label?: string; icon?: string; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-7 h-7 rounded flex items-center justify-center text-xs transition-colors ${className} ${
        active ? "bg-[#7C3AED]/10 text-[#7C3AED]" : "text-gray-500 hover:bg-gray-100"
      }`}
    >
      {icon ? <span className="material-symbols-rounded text-[18px]">{icon}</span> : label}
    </button>
  );
}
