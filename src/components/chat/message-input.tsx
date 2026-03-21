"use client";

import { useCallback, useRef, useState } from "react";
import { EmojiPicker } from "./emoji-picker";
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
  const [showEmoji, setShowEmoji] = useState(false);
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
        class: "outline-none px-4 py-3 text-sm min-h-[44px] max-h-[200px] overflow-y-auto",
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = useCallback(async (file: File) => {
    if (!editor) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/chat/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();

      if (data.fileType.startsWith("image/")) {
        editor.commands.insertContent(`<img src="${data.url}" alt="${data.fileName}" />`);
      } else {
        editor.commands.insertContent(`<a href="${data.url}" target="_blank">${data.fileName}</a>`);
      }
    } catch (error) {
      console.error("File upload failed:", error);
    } finally {
      setUploading(false);
    }
  }, [editor]);

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

        <EditorContent editor={editor} />

        <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50/50">
          <div className="flex gap-1">
            <>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-rounded text-[18px]">{uploading ? "hourglass_empty" : "attach_file"}</span>
              </button>
            </>
            <div className="relative">
              <button
                onClick={() => setShowEmoji(!showEmoji)}
                className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                  showEmoji ? "bg-[#7C3AED]/10 text-[#7C3AED]" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                }`}
              >
                <span className="material-symbols-rounded text-[18px]">mood</span>
              </button>
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
