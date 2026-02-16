"use client";

import { cn } from "@/lib/utils";
import { Heart, PartyPopper, ThumbsUp, MessageCircle, Pin, Cake, UserPlus } from "lucide-react";
import { timeAgo, getInitials } from "@/lib/utils";
import { toggleReaction } from "@/lib/actions/feed";
import type { ReactionType } from "@/generated/prisma/client";

type PostWithRelations = {
  id: string;
  content: string;
  type: string;
  pinned: boolean;
  createdAt: Date;
  author: { id: string; firstName: string; lastName: string; jobTitle: string };
  reactions: { id: string; type: string; employeeId: string }[];
  _count: { comments: number; reactions: number };
};

function ReactionButton({
  icon: Icon,
  count,
  label,
  active,
  onClick,
}: {
  icon: React.ElementType;
  count: number;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors",
        active
          ? "text-[var(--color-accent)] bg-[var(--color-accent)]/10"
          : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
      )}
      aria-label={label}
    >
      <Icon className="h-4 w-4" />
      <span>{count}</span>
    </button>
  );
}

export function PostCard({
  post,
  currentEmployeeId,
}: {
  post: PostWithRelations;
  currentEmployeeId: string;
}) {
  const initials = getInitials(post.author.firstName, post.author.lastName);
  const heartCount = post.reactions.filter((r) => r.type === "HEART").length;
  const celebrateCount = post.reactions.filter((r) => r.type === "CELEBRATE").length;
  const thumbsupCount = post.reactions.filter((r) => r.type === "THUMBSUP").length;

  const myReaction = post.reactions.find((r) => r.employeeId === currentEmployeeId)?.type;

  async function handleReaction(type: ReactionType) {
    await toggleReaction(post.id, currentEmployeeId, type);
  }

  const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500"];
  const colorIdx = post.author.firstName.charCodeAt(0) % avatarColors.length;
  const avatarColor = avatarColors[colorIdx];

  if (post.type === "BIRTHDAY") {
    return (
      <article className={cn("rounded-xl overflow-hidden", "bg-gradient-to-br from-amber-500/10 via-pink-500/10 to-purple-500/10", "border border-amber-400/20")}>
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0", avatarColor)}>{initials}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-[var(--color-text-primary)]">{post.author.firstName} {post.author.lastName}</p>
                <Cake className="h-4 w-4 text-amber-500" />
              </div>
              <p className="text-sm text-[var(--color-text-muted)]">{post.author.jobTitle} · {timeAgo(post.createdAt)}</p>
            </div>
          </div>
          <div className="text-center py-4">
            <p className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">Happy Birthday, {post.author.firstName}!</p>
            <p className="text-[var(--color-text-muted)]">Wishing you an amazing year ahead. Enjoy your special day!</p>
          </div>
          <div className="flex items-center gap-1 pt-3 border-t border-amber-400/20">
            <ReactionButton icon={Heart} count={heartCount} label="Love" active={myReaction === "HEART"} onClick={() => handleReaction("HEART")} />
            <ReactionButton icon={PartyPopper} count={celebrateCount} label="Celebrate" active={myReaction === "CELEBRATE"} onClick={() => handleReaction("CELEBRATE")} />
            <ReactionButton icon={ThumbsUp} count={thumbsupCount} label="Like" active={myReaction === "THUMBSUP"} onClick={() => handleReaction("THUMBSUP")} />
            <div className="ml-auto flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
              <MessageCircle className="h-4 w-4" /><span>{post._count.comments}</span>
            </div>
          </div>
        </div>
      </article>
    );
  }

  if (post.type === "NEW_HIRE") {
    return (
      <article className={cn("rounded-xl overflow-hidden", "bg-[var(--color-surface)] border border-[var(--color-border)]", "border-l-4 border-l-emerald-500")}>
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="h-5 w-5 text-emerald-500" />
            <span className="text-sm font-medium text-emerald-500">New Team Member</span>
            <span className="text-sm text-[var(--color-text-muted)]">· {timeAgo(post.createdAt)}</span>
          </div>
          <div className="flex items-center gap-4 mb-3">
            <div className={cn("h-12 w-12 rounded-full flex items-center justify-center text-white font-semibold shrink-0", avatarColor)}>{initials}</div>
            <div>
              <p className="text-lg font-semibold text-[var(--color-text-primary)]">Welcome {post.author.firstName}!</p>
              <p className="text-[var(--color-text-muted)]">{post.author.jobTitle}</p>
            </div>
          </div>
          <p className="text-[var(--color-text-primary)] leading-relaxed">{post.content}</p>
          <div className="flex items-center gap-1 pt-3 mt-3 border-t border-[var(--color-border)]">
            <ReactionButton icon={Heart} count={heartCount} label="Love" active={myReaction === "HEART"} onClick={() => handleReaction("HEART")} />
            <ReactionButton icon={PartyPopper} count={celebrateCount} label="Celebrate" active={myReaction === "CELEBRATE"} onClick={() => handleReaction("CELEBRATE")} />
            <ReactionButton icon={ThumbsUp} count={thumbsupCount} label="Like" active={myReaction === "THUMBSUP"} onClick={() => handleReaction("THUMBSUP")} />
            <div className="ml-auto flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
              <MessageCircle className="h-4 w-4" /><span>{post._count.comments}</span>
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className={cn("rounded-xl overflow-hidden", "bg-[var(--color-surface)] border border-[var(--color-border)]", post.pinned && "border-l-4 border-l-[var(--color-accent)]")}>
      <div className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0", avatarColor)}>{initials}</div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[var(--color-text-primary)]">{post.author.firstName} {post.author.lastName}</p>
            <p className="text-sm text-[var(--color-text-muted)]">{post.author.jobTitle} · {timeAgo(post.createdAt)}</p>
          </div>
          {post.pinned && (
            <div className="flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] bg-[var(--color-accent)]/10 px-2 py-1 rounded-full">
              <Pin className="h-3 w-3" />Pinned
            </div>
          )}
        </div>
        <p className="text-[var(--color-text-primary)] leading-relaxed whitespace-pre-line">{post.content}</p>
        <div className="flex items-center gap-1 pt-3 mt-3 border-t border-[var(--color-border)]">
          <ReactionButton icon={Heart} count={heartCount} label="Love" active={myReaction === "HEART"} onClick={() => handleReaction("HEART")} />
          <ReactionButton icon={PartyPopper} count={celebrateCount} label="Celebrate" active={myReaction === "CELEBRATE"} onClick={() => handleReaction("CELEBRATE")} />
          <ReactionButton icon={ThumbsUp} count={thumbsupCount} label="Like" active={myReaction === "THUMBSUP"} onClick={() => handleReaction("THUMBSUP")} />
          <div className="ml-auto flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
            <MessageCircle className="h-4 w-4" /><span>{post._count.comments}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
