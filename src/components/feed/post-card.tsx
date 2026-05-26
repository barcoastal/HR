"use client";

import { cn } from "@/lib/utils";
import { timeAgo, getInitials } from "@/lib/utils";
import { toggleReaction, deleteFeedPost } from "@/lib/actions/feed";
import { CommentSection } from "@/components/feed/comment-section";
import type { ReactionType } from "@/generated/prisma/client";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { EventCard } from "@/components/feed/event-card";
import { PollWidget } from "@/components/feed/poll-widget";
import type { PollView } from "@/lib/actions/feed";

type PostWithRelations = {
  id: string;
  content: string;
  type: string;
  pinned: boolean;
  eventDate?: Date | null;
  eventEndDate?: Date | null;
  eventLocation?: string | null;
  createdAt: Date;
  author: { id: string; firstName: string; lastName: string; jobTitle: string; pronouns?: string | null; profilePhoto?: string | null };
  mentionedEmployee?: { id: string; firstName: string; lastName: string; jobTitle: string } | null;
  reactions: { id: string; type: string; employeeId: string }[];
  comments: { id: string; content: string; createdAt: Date; author: { id: string; firstName: string; lastName: string } }[];
  attachments?: { id: string; url: string; type: string; name: string }[];
  pollView?: PollView | null;
  _count: { comments: number; reactions: number };
};

function ReactionButton({
  icon,
  count,
  label,
  active,
  onClick,
}: {
  icon: string;
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
      <Icon name={icon} size={16} />
      <span>{count}</span>
    </button>
  );
}

function AttachmentGallery({ attachments }: { attachments?: { id: string; url: string; type: string; name: string }[] }) {
  if (!attachments || attachments.length === 0) return null;
  const images = attachments.filter((a) => a.type === "IMAGE");
  const files = attachments.filter((a) => a.type === "FILE");
  return (
    <div className="mt-3">
      {images.length > 0 && (
        <div className={cn("grid gap-2", images.length === 1 ? "grid-cols-1" : images.length === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3")}>
          {images.map((img) => (
            <a key={img.id} href={img.url} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-[var(--color-border)]">
              <img src={img.url} alt={img.name} className="w-full max-h-80 object-cover" loading="lazy" />
            </a>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {files.map((file) => (
            <a
              key={file.id}
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] hover:bg-[var(--color-surface-hover)] transition-colors text-sm text-[var(--color-text-primary)]"
            >
              <Icon name="attach_file" size={16} className="text-[var(--color-text-muted)]" />
              <span className="truncate max-w-[200px]">{file.name}</span>
              <Icon name="download" size={12} className="text-[var(--color-text-muted)]" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function PostCard({
  post,
  currentEmployeeId,
  currentUserId,
  userRole,
}: {
  post: PostWithRelations;
  currentEmployeeId: string;
  currentUserId?: string;
  userRole?: string;
}) {
  const [showComments, setShowComments] = useState(false);
  const initials = getInitials(post.author.firstName, post.author.lastName);
  const heartCount = post.reactions.filter((r) => r.type === "HEART").length;
  const celebrateCount = post.reactions.filter((r) => r.type === "CELEBRATE").length;
  const thumbsupCount = post.reactions.filter((r) => r.type === "THUMBSUP").length;

  const myReaction = post.reactions.find((r) => r.employeeId === currentEmployeeId)?.type;

  async function handleReaction(type: ReactionType) {
    await toggleReaction(post.id, currentEmployeeId, type);
  }

  const canDelete = userRole === "SUPER_ADMIN" || userRole === "ADMIN";
  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this post?")) return;
    await deleteFeedPost(post.id);
  }

  const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500"];
  const colorIdx = post.author.firstName.charCodeAt(0) % avatarColors.length;
  const avatarColor = avatarColors[colorIdx];

  const reactionsBar = (
    <div className="flex items-center gap-1">
      <ReactionButton icon="favorite" count={heartCount} label="Love" active={myReaction === "HEART"} onClick={() => handleReaction("HEART")} />
      <ReactionButton icon="celebration" count={celebrateCount} label="Celebrate" active={myReaction === "CELEBRATE"} onClick={() => handleReaction("CELEBRATE")} />
      <ReactionButton icon="thumb_up" count={thumbsupCount} label="Like" active={myReaction === "THUMBSUP"} onClick={() => handleReaction("THUMBSUP")} />
      <button
        onClick={() => setShowComments(!showComments)}
        className={cn(
          "ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors",
          showComments
            ? "text-[var(--color-accent)] bg-[var(--color-accent)]/10"
            : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
        )}
      >
        <Icon name="chat_bubble" size={16} />
        <span>{post._count.comments}</span>
      </button>
      {canDelete && (
        <button
          onClick={handleDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm text-red-400 hover:bg-red-500/10 transition-colors"
          aria-label="Delete post"
        >
          <Icon name="delete" size={16} />
        </button>
      )}
    </div>
  );

  const commentsSection = showComments ? (
    <CommentSection
      postId={post.id}
      comments={post.comments}
      currentEmployeeId={currentEmployeeId}
    />
  ) : null;

  if (post.type === "EVENT" && currentUserId) {
    return (
      <EventCard
        post={post as any}
        currentUserId={currentUserId}
        currentEmployeeId={currentEmployeeId}
        reactionsBar={reactionsBar}
        commentsSection={commentsSection}
      />
    );
  }

  if (post.type === "SHOUTOUT" && post.mentionedEmployee) {
    const mentioned = post.mentionedEmployee;
    const mentionedInitials = getInitials(mentioned.firstName, mentioned.lastName);
    const mentionedColorIdx = mentioned.firstName.charCodeAt(0) % avatarColors.length;
    return (
      <article className={cn("rounded-2xl overflow-hidden", "bg-gradient-to-br from-yellow-500/10 via-orange-500/10 to-rose-500/10", "border border-yellow-400/20")}>
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="star" size={20} fill className="text-yellow-500" />
            <span className="text-sm font-medium text-yellow-600">Shoutout</span>
            <span className="text-sm text-[var(--color-text-muted)]">· {timeAgo(post.createdAt)}</span>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0", avatarColor)}>{initials}</div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[var(--color-text-primary)]">{post.author.firstName} {post.author.lastName}</p>
              <p className="text-sm text-[var(--color-text-muted)]">{post.author.jobTitle}</p>
            </div>
          </div>
          <p className="text-[var(--color-text-primary)] leading-relaxed mb-3">{post.content}</p>
          <AttachmentGallery attachments={post.attachments} />
          <div className={cn("flex items-center gap-3 p-3 rounded-lg", "bg-[var(--color-surface)]/50 border border-yellow-400/10")}>
            <div className={cn("h-9 w-9 rounded-full flex items-center justify-center text-white font-semibold text-xs shrink-0", avatarColors[mentionedColorIdx])}>{mentionedInitials}</div>
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">{mentioned.firstName} {mentioned.lastName}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{mentioned.jobTitle}</p>
            </div>
          </div>
          <div className="pt-3 mt-3 border-t border-yellow-400/20">
            {reactionsBar}
            {commentsSection}
          </div>
        </div>
      </article>
    );
  }

  if (post.type === "BIRTHDAY") {
    return (
      <article className={cn("rounded-2xl overflow-hidden", "bg-gradient-to-br from-amber-500/10 via-pink-500/10 to-rose-500/10", "border border-amber-400/20")}>
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0", avatarColor)}>{initials}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-[var(--color-text-primary)]">{post.author.firstName} {post.author.lastName}</p>
                <Icon name="cake" size={16} className="text-amber-500" />
              </div>
              <p className="text-sm text-[var(--color-text-muted)]">{post.author.jobTitle} · {timeAgo(post.createdAt)}</p>
            </div>
          </div>
          <div className="text-center py-4">
            <p className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">Happy Birthday, {post.author.firstName}!</p>
            <p className="text-[var(--color-text-muted)]">Wishing you an amazing year ahead. Enjoy your special day!</p>
          </div>
          <div className="pt-3 border-t border-amber-400/20">
            {reactionsBar}
            {commentsSection}
          </div>
        </div>
      </article>
    );
  }

  if (post.type === "NEW_HIRE") {
    return (
      <article className={cn("rounded-2xl overflow-hidden", "bg-[var(--color-surface)] border border-[var(--color-border)]", "border-l-4 border-l-emerald-500")}>
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="person_add" size={20} className="text-emerald-500" />
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
          <div className="pt-3 mt-3 border-t border-[var(--color-border)]">
            {reactionsBar}
            {commentsSection}
          </div>
        </div>
      </article>
    );
  }

  if (post.type === "EMERGENCY") {
    return (
      <article className={cn("rounded-2xl overflow-hidden", "bg-gradient-to-br from-red-500/10 via-red-400/5 to-orange-500/5", "border-2 border-red-500/30")}>
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="warning" size={20} fill className="text-red-500" />
            <span className="text-sm font-bold text-red-500 uppercase tracking-wider">Emergency Alert</span>
            <span className="text-sm text-[var(--color-text-muted)]">· {timeAgo(post.createdAt)}</span>
          </div>
          <p className="text-[var(--color-text-primary)] leading-relaxed whitespace-pre-line font-medium">{post.content}</p>
          <AttachmentGallery attachments={post.attachments} />
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-red-500/20">
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
              {post.author.profilePhoto ? (
                <img src={post.author.profilePhoto} alt="" className="h-5 w-5 rounded-full object-cover" />
              ) : (
                <div className={cn("h-5 w-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold", avatarColor)}>{initials}</div>
              )}
              <span>{post.author.firstName} {post.author.lastName}</span>
            </div>
          </div>
          <div className="pt-3 mt-1 border-t border-red-500/20">
            {reactionsBar}
            {commentsSection}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className={cn("rounded-2xl overflow-hidden", "bg-[var(--color-surface)] border border-[var(--color-border)]", post.pinned && "border-l-4 border-l-[var(--color-accent)]")}>
      <div className="p-5">
        <div className="flex items-center gap-3 mb-4">
          {post.author.profilePhoto ? (
            <img src={post.author.profilePhoto} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
          ) : (
            <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0", avatarColor)}>{initials}</div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[var(--color-text-primary)]">
              {post.author.firstName} {post.author.lastName}
              {post.author.pronouns && <span className="text-xs font-normal text-[var(--color-text-muted)] ml-1">({post.author.pronouns})</span>}
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">{post.author.jobTitle} · {timeAgo(post.createdAt)}</p>
          </div>
          {post.pinned && (
            <div className="flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] bg-[var(--color-accent)]/10 px-2 py-1 rounded-full">
              <Icon name="push_pin" size={12} />Pinned
            </div>
          )}
        </div>
        {post.type === "POLL" && post.pollView ? (
          <PollWidget poll={post.pollView} />
        ) : (
          <>
            <p className="text-[var(--color-text-primary)] leading-relaxed whitespace-pre-line">{post.content}</p>
            <AttachmentGallery attachments={post.attachments} />
          </>
        )}
        <div className="pt-3 mt-3 border-t border-[var(--color-border)]">
          {reactionsBar}
          {commentsSection}
        </div>
      </div>
    </article>
  );
}
