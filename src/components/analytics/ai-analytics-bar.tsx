"use client";

import { cn } from "@/lib/utils";
import { Sparkles, Send, X, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const SUGGESTED_QUESTIONS = [
  "What's our retention rate?",
  "Which department is growing fastest?",
  "How efficient is our hiring?",
  "Summarize key HR metrics",
];

export function AIAnalyticsBar({ context }: { context: Record<string, unknown> }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSubmit(question?: string) {
    const q = question || input.trim();
    if (!q || streaming) return;

    setInput("");
    setPanelOpen(true);

    const userMsg: Message = { role: "user", content: q };
    setMessages((prev) => [...prev, userMsg]);
    setStreaming(true);

    // Add empty assistant message that we'll stream into
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/ai/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, context }),
      });

      if (!res.ok) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: "Sorry, I couldn't process that request. Please try again.",
          };
          return updated;
        });
        setStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content + parsed.text,
                  };
                  return updated;
                });
              }
            } catch {
              // skip malformed data
            }
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Connection error. Please try again.",
        };
        return updated;
      });
    }

    setStreaming(false);
  }

  return (
    <div className="mt-8">
      {/* Conversation panel */}
      {panelOpen && messages.length > 0 && (
        <div className="glass-card mb-3 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border)]/60">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[var(--color-accent)]" />
              <span className="text-xs font-semibold text-[var(--color-text-primary)]">AI Analytics Assistant</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPanelOpen(false)}
                className="p-1 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
              <button
                onClick={() => { setMessages([]); setPanelOpen(false); }}
                className="p-1 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div ref={scrollRef} className="max-h-[400px] overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-gradient-to-r from-[var(--color-accent)] to-purple-600 text-white"
                      : "bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-primary)]"
                  )}
                >
                  {msg.role === "assistant" && msg.content === "" && streaming ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-[var(--color-accent)]" />
                      <span className="text-[var(--color-text-muted)]">Thinking...</span>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collapsed indicator */}
      {!panelOpen && messages.length > 0 && (
        <button
          onClick={() => setPanelOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-2 mb-3 rounded-xl text-xs font-medium text-[var(--color-accent)] bg-[var(--color-accent)]/5 hover:bg-[var(--color-accent)]/10 transition-colors"
        >
          <ChevronUp className="h-3.5 w-3.5" />
          Show AI conversation ({messages.length} messages)
        </button>
      )}

      {/* Suggested questions */}
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => handleSubmit(q)}
              disabled={streaming}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-medium transition-colors",
                "bg-[var(--color-accent)]/5 text-[var(--color-accent)] border border-[var(--color-accent)]/20",
                "hover:bg-[var(--color-accent)]/10 hover:border-[var(--color-accent)]/40",
                "disabled:opacity-50"
              )}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="glass-card flex items-center gap-3 p-3">
        <Sparkles className="h-5 w-5 text-[var(--color-accent)] shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          placeholder="Ask about your analytics..."
          disabled={streaming}
          className={cn(
            "flex-1 bg-transparent text-sm text-[var(--color-text-primary)]",
            "placeholder:text-[var(--color-text-muted)]",
            "focus:outline-none",
            "disabled:opacity-50"
          )}
        />
        <button
          onClick={() => handleSubmit()}
          disabled={!input.trim() || streaming}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl transition-colors shrink-0",
            input.trim() && !streaming
              ? "bg-gradient-to-r from-[var(--color-accent)] to-purple-600 text-white glow-accent"
              : "bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]",
            "disabled:opacity-50"
          )}
        >
          {streaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
