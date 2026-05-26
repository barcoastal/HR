"use client";

import { cn } from "@/lib/utils";
import { useState, useRef } from "react";
import { createFeedPost, createShoutoutPost } from "@/lib/actions/feed";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { CreateEventDialog } from "@/components/feed/create-event-dialog";
import { CreatePollDialog } from "@/components/feed/create-poll-dialog";

type EmployeeOption = { id: string; firstName: string; lastName: string };
type Attachment = { url: string; type: "IMAGE" | "FILE"; name: string; preview?: string };

const GIPHY_SEARCH_URL = "https://api.giphy.com/v1/gifs/search";
const GIPHY_TRENDING_URL = "https://api.giphy.com/v1/gifs/trending";
const GIPHY_API_KEY = "GlVGYHkr3WSBnllca54iNt0yFbjz7L65"; // Public beta key

export function PostComposer({
  employeeId,
  initials,
  profilePhoto,
  employees,
}: {
  employeeId: string;
  initials: string;
  profilePhoto?: string | null;
  employees?: EmployeeOption[];
}) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"general" | "shoutout">("general");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifSearch, setGifSearch] = useState("");
  const [gifs, setGifs] = useState<{ id: string; url: string; preview: string; title: string }[]>([]);
  const [loadingGifs, setLoadingGifs] = useState(false);
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [showPollDialog, setShowPollDialog] = useState(false);
  const [emailTarget, setEmailTarget] = useState<"all" | "none">("all");
  const photoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function uploadFile(file: File): Promise<{ url: string; name: string }> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/onboarding-docs/upload", { method: "POST", body: formData });
    if (!res.ok) throw new Error("Upload failed");
    const data = await res.json();
    return { url: data.url, name: file.name };
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const { url, name } = await uploadFile(file);
      const preview = URL.createObjectURL(file);
      setAttachments((prev) => [...prev, { url, type: "IMAGE", name, preview }]);
    }
    setUploading(false);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const { url, name } = await uploadFile(file);
      const isImage = file.type.startsWith("image/");
      const preview = isImage ? URL.createObjectURL(file) : undefined;
      setAttachments((prev) => [...prev, { url, type: isImage ? "IMAGE" : "FILE", name, preview }]);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeAttachment(idx: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  async function searchGifs(query?: string) {
    setLoadingGifs(true);
    const url = query
      ? `${GIPHY_SEARCH_URL}?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20&rating=g`
      : `${GIPHY_TRENDING_URL}?api_key=${GIPHY_API_KEY}&limit=20&rating=g`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      setGifs(
        (data.data || []).map((g: any) => ({
          id: g.id,
          url: g.images.original.url,
          preview: g.images.fixed_width_small.url,
          title: g.title,
        }))
      );
    } catch {
      setGifs([]);
    }
    setLoadingGifs(false);
  }

  function handleGifPickerOpen() {
    setShowGifPicker(!showGifPicker);
    if (!showGifPicker) searchGifs();
  }

  function selectGif(gif: { url: string; title: string }) {
    setAttachments((prev) => [...prev, { url: gif.url, type: "IMAGE", name: gif.title || "gif", preview: gif.url }]);
    setShowGifPicker(false);
    setGifSearch("");
  }

  async function handlePost() {
    if (!content.trim() && attachments.length === 0) return;
    setLoading(true);
    if (mode === "shoutout" && selectedEmployee) {
      await createShoutoutPost(employeeId, selectedEmployee, content.trim(), emailTarget);
    } else {
      await createFeedPost({
        authorId: employeeId,
        content: content.trim(),
        attachments: attachments.map((a) => ({ url: a.url, type: a.type, name: a.name })),
        emailTarget,
      });
    }
    setContent("");
    setSelectedEmployee("");
    setMode("general");
    setAttachments([]);
    setEmailTarget("all");
    setLoading(false);
    router.refresh();
  }

  return (
    <div
      className={cn(
        "rounded-2xl p-4 mb-6",
        "bg-[var(--color-surface)] border border-[var(--color-border)]"
      )}
    >
      <div className="flex items-start gap-3">
        {profilePhoto ? (
          <img src={profilePhoto} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
        ) : (
          <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm bg-[var(--color-accent)] shrink-0">
            {initials}
          </div>
        )}
        <div className="flex-1">
          <textarea
            placeholder={mode === "shoutout" ? "Give someone a shoutout..." : "What's on your mind?"}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handlePost();
              }
            }}
            rows={2}
            className={cn(
              "w-full rounded-xl px-4 py-2.5 text-sm resize-none",
              "bg-[var(--color-background)] border border-[var(--color-border)]",
              "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
              "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]",
              "transition-all"
            )}
          />
        </div>
      </div>

      {mode === "shoutout" && employees && (
        <div className="mt-3 pl-[52px]">
          <select
            value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            className={cn(
              "w-full rounded-lg px-3 py-2 text-sm",
              "bg-[var(--color-background)] border border-[var(--color-border)]",
              "text-[var(--color-text-primary)]",
              "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
            )}
          >
            <option value="">Select an employee to shoutout...</option>
            {employees
              .filter((e) => e.id !== employeeId)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.firstName} {e.lastName}
                </option>
              ))}
          </select>
        </div>
      )}

      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="mt-3 pl-[52px] flex flex-wrap gap-2">
          {attachments.map((att, idx) => (
            <div key={idx} className="relative group">
              {att.type === "IMAGE" ? (
                <img
                  src={att.preview || att.url}
                  alt={att.name}
                  className="h-20 w-20 rounded-lg object-cover border border-[var(--color-border)]"
                />
              ) : (
                <div className="h-20 w-20 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] flex flex-col items-center justify-center p-2">
                  <Icon name="attach_file" size={20} className="text-[var(--color-text-muted)] mb-1" />
                  <span className="text-[9px] text-[var(--color-text-muted)] truncate w-full text-center">{att.name}</span>
                </div>
              )}
              <button
                onClick={() => removeAttachment(idx)}
                className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Icon name="close" size={12} />
              </button>
            </div>
          ))}
          {uploading && (
            <div className="h-20 w-20 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] flex items-center justify-center">
              <Icon name="progress_activity" size={20} className="animate-material-spin text-[var(--color-accent)] animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* GIF picker */}
      {showGifPicker && (
        <div className="mt-3 pl-[52px]">
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-3">
            <div className="flex items-center gap-2 mb-3">
              <input
                value={gifSearch}
                onChange={(e) => setGifSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    searchGifs(gifSearch);
                  }
                }}
                placeholder="Search GIFs..."
                className={cn(
                  "flex-1 px-3 py-1.5 rounded-lg text-sm",
                  "bg-[var(--color-surface)] border border-[var(--color-border)]",
                  "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
                  "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40"
                )}
              />
              <button
                onClick={() => searchGifs(gifSearch)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]"
              >
                Search
              </button>
              <button
                onClick={() => setShowGifPicker(false)}
                className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
            {loadingGifs ? (
              <div className="flex justify-center py-6">
                <Icon name="progress_activity" className="animate-material-spin text-[var(--color-accent)] animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-1.5 max-h-48 overflow-y-auto">
                {gifs.map((gif) => (
                  <button
                    key={gif.id}
                    onClick={() => selectGif(gif)}
                    className="rounded-lg overflow-hidden hover:ring-2 hover:ring-[var(--color-accent)] transition-all"
                  >
                    <img src={gif.preview} alt={gif.title} className="w-full h-16 object-cover" loading="lazy" />
                  </button>
                ))}
                {gifs.length === 0 && (
                  <p className="col-span-4 text-center text-xs text-[var(--color-text-muted)] py-4">No GIFs found</p>
                )}
              </div>
            )}
            <p className="text-[9px] text-[var(--color-text-muted)] mt-2 text-right">Powered by GIPHY</p>
          </div>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handlePhotoSelect}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--color-border)]">
        <div className="flex items-center gap-1">
          <button
            onClick={() => photoInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-50"
          >
            <Icon name="image" size={16} />
            Photo
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-50"
          >
            <Icon name="attach_file" size={16} />
            Attach
          </button>
          <button
            onClick={handleGifPickerOpen}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors",
              showGifPicker
                ? "text-[var(--color-accent)] bg-[var(--color-accent)]/10"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
            )}
          >
            <Icon name="mood" size={16} />
            GIF
          </button>
          <button
            onClick={() => setMode(mode === "shoutout" ? "general" : "shoutout")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors",
              mode === "shoutout"
                ? "text-yellow-500 bg-yellow-500/10"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
            )}
          >
            <Icon name="star" size={16} />
            Shoutout
          </button>
          <button
            onClick={() => setShowEventDialog(true)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors",
              "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
            )}
          >
            <Icon name="event" size={16} />
            Event
          </button>
          <button
            onClick={() => setShowPollDialog(true)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors",
              "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
            )}
          >
            <Icon name="ballot" size={16} />
            Poll
          </button>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] cursor-pointer">
            <input type="checkbox" checked={emailTarget === "all"} onChange={() => setEmailTarget(emailTarget === "all" ? "none" : "all")} className="accent-[var(--color-accent)]" />
            Email all
          </label>
        </div>
        <button
          onClick={handlePost}
          disabled={(!content.trim() && attachments.length === 0) || loading || uploading || (mode === "shoutout" && !selectedEmployee)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
            "bg-[var(--color-accent)] text-white",
            "hover:bg-[var(--color-accent-hover)] transition-colors",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <Icon name="send" size={16} />
          {loading ? "Posting..." : "Post"}
        </button>
      </div>

      {showEventDialog && (
        <CreateEventDialog
          employeeId={employeeId}
          onClose={() => setShowEventDialog(false)}
        />
      )}

      {showPollDialog && (
        <CreatePollDialog
          employeeId={employeeId}
          onClose={() => setShowPollDialog(false)}
        />
      )}
    </div>
  );
}
