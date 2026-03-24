"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { searchChat } from "@/lib/actions/chat-search";
import { getOrCreateDmThread } from "@/lib/actions/chat-dms";
import { useChatStore } from "@/lib/chat/use-chat-store";

interface SearchResults {
  messages: {
    id: string;
    content: string;
    channelId: string | null;
    channelName: string;
    authorName: string;
    authorPhoto: string | null;
    createdAt: string;
  }[];
  channels: {
    id: string;
    name: string;
    description: string | null;
    isPrivate: boolean;
  }[];
  people: {
    id: string;
    firstName: string;
    lastName: string;
    profilePhoto: string | null;
    jobTitle: string | null;
  }[];
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();
}

function Avatar({
  photo,
  firstName,
  lastName,
  size = "sm",
}: {
  photo: string | null;
  firstName: string;
  lastName: string;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "w-7 h-7 text-[10px]" : "w-8 h-8 text-xs";
  if (photo) {
    return (
      <img
        src={photo}
        alt={`${firstName} ${lastName}`}
        className={`${dim} rounded-lg object-cover flex-shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${dim} rounded-lg bg-[#7C3AED] flex items-center justify-center text-white font-semibold flex-shrink-0`}
    >
      {getInitials(firstName, lastName)}
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SearchModal({ open, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const { workspaceId } = useChatStore();

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search
  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 2) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const res = await searchChat(value);
      setResults(res);
      setLoading(false);
    }, 300);
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleChannelClick = (channelId: string) => {
    onClose();
    router.push(`/chat/${channelId}`);
  };

  const handlePersonClick = async (personId: string) => {
    if (!workspaceId) return;
    setNavigating(true);
    const dm = await getOrCreateDmThread(workspaceId, [personId]) as any;
    onClose();
    router.push(`/chat/${dm.id}?type=dm`);
    setNavigating(false);
  };

  const handleMessageClick = (channelId: string | null) => {
    if (!channelId) return;
    onClose();
    router.push(`/chat/${channelId}`);
  };

  const hasResults =
    results &&
    (results.channels.length > 0 ||
      results.people.length > 0 ||
      results.messages.length > 0);

  const isEmpty =
    results &&
    results.channels.length === 0 &&
    results.people.length === 0 &&
    results.messages.length === 0;

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onMouseDown={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh]">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <span className="material-symbols-rounded text-[22px] text-gray-400 flex-shrink-0">
            search
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search messages, channels, people..."
            className="flex-1 text-sm text-gray-900 placeholder-gray-400 outline-none bg-transparent"
          />
          {loading && (
            <span className="material-symbols-rounded text-[18px] text-[#7C3AED] animate-spin flex-shrink-0">
              progress_activity
            </span>
          )}
          {navigating && (
            <span className="text-xs text-gray-400 flex-shrink-0">Opening...</span>
          )}
          <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5 flex-shrink-0">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div className="overflow-y-auto flex-1">
          {/* Empty state */}
          {query.length < 2 && (
            <div className="py-12 text-center">
              <span className="material-symbols-rounded text-[40px] text-gray-200 block mb-2">
                manage_search
              </span>
              <p className="text-sm text-gray-400">Type at least 2 characters to search</p>
            </div>
          )}

          {/* No results */}
          {isEmpty && !loading && (
            <div className="py-12 text-center">
              <span className="material-symbols-rounded text-[40px] text-gray-200 block mb-2">
                search_off
              </span>
              <p className="text-sm text-gray-400">No results for &ldquo;{query}&rdquo;</p>
            </div>
          )}

          {hasResults && (
            <div className="py-2">
              {/* Channels */}
              {results.channels.length > 0 && (
                <section>
                  <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    Channels
                  </p>
                  {results.channels.map((ch) => (
                    <button
                      key={ch.id}
                      onClick={() => handleChannelClick(ch.id)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm text-gray-500">
                          {ch.isPrivate ? "🔒" : "#"}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">{ch.name}</p>
                        {ch.description && (
                          <p className="text-[11px] text-gray-500 truncate">{ch.description}</p>
                        )}
                      </div>
                      <span className="material-symbols-rounded text-[16px] text-gray-300 ml-auto flex-shrink-0">
                        chevron_right
                      </span>
                    </button>
                  ))}
                </section>
              )}

              {/* People */}
              {results.people.length > 0 && (
                <section>
                  <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    People
                  </p>
                  {results.people.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handlePersonClick(p.id)}
                      disabled={navigating}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left disabled:opacity-60"
                    >
                      <Avatar
                        photo={p.profilePhoto}
                        firstName={p.firstName}
                        lastName={p.lastName}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {p.firstName} {p.lastName}
                        </p>
                        {p.jobTitle && (
                          <p className="text-[11px] text-gray-500 truncate">{p.jobTitle}</p>
                        )}
                      </div>
                      <span className="text-[10px] text-[#7C3AED] font-medium ml-auto flex-shrink-0">
                        Message
                      </span>
                    </button>
                  ))}
                </section>
              )}

              {/* Messages */}
              {results.messages.length > 0 && (
                <section>
                  <p className="px-4 pt-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    Messages
                  </p>
                  {results.messages.map((msg) => (
                    <button
                      key={msg.id}
                      onClick={() => handleMessageClick(msg.channelId)}
                      className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                    >
                      <Avatar
                        photo={msg.authorPhoto}
                        firstName={msg.authorName.split(" ")[0]}
                        lastName={msg.authorName.split(" ")[1] || ""}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-gray-700">
                            {msg.authorName}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            #{msg.channelName}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 truncate">{msg.content}</p>
                      </div>
                      <span className="material-symbols-rounded text-[16px] text-gray-300 flex-shrink-0 mt-0.5">
                        chevron_right
                      </span>
                    </button>
                  ))}
                </section>
              )}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-3 text-[10px] text-gray-400">
          <span className="flex items-center gap-1">
            <span className="material-symbols-rounded text-[12px]">keyboard_return</span>
            to select
          </span>
          <span className="flex items-center gap-1">
            <span className="material-symbols-rounded text-[12px]">keyboard_tab</span>
            to navigate
          </span>
          <span className="ml-auto flex items-center gap-1">
            <kbd className="border border-gray-200 rounded px-1 py-0.5">esc</kbd>
            to close
          </span>
        </div>
      </div>
    </div>
  );
}
