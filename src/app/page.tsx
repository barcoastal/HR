import { cn } from "@/lib/utils";
import {
  Heart,
  PartyPopper,
  ThumbsUp,
  MessageCircle,
  Pin,
  Send,
  Image,
  Paperclip,
  Cake,
  UserPlus,
} from "lucide-react";

const feedPosts = [
  {
    id: 1,
    pinned: true,
    author: "Sarah Chen",
    role: "HR Director",
    initials: "SC",
    avatarColor: "bg-indigo-500",
    timeAgo: "2 hours ago",
    content:
      "📢 Exciting news! Our annual company retreat is confirmed for March 15-17 at Lake Tahoe. This year's theme is \"Building Bridges\" — we'll have team workshops, outdoor activities, and a special keynote from our CEO. Registration opens next Monday. Start thinking about your roommate preferences!",
    reactions: { heart: 24, celebrate: 18, thumbsup: 31 },
    comments: 12,
    type: "announcement" as const,
  },
  {
    id: 2,
    pinned: false,
    author: "Mike Johnson",
    role: "Senior Engineer",
    initials: "MJ",
    avatarColor: "bg-amber-500",
    timeAgo: "4 hours ago",
    content: "",
    reactions: { heart: 32, celebrate: 45, thumbsup: 28 },
    comments: 19,
    type: "birthday" as const,
  },
  {
    id: 3,
    pinned: false,
    author: "Alex Rivera",
    role: "Engineering Manager",
    initials: "AR",
    avatarColor: "bg-emerald-500",
    timeAgo: "6 hours ago",
    content:
      "Proud to share that Project Atlas just hit a major milestone — we've successfully migrated 100% of our legacy services to the new microservices architecture. Huge shoutout to the entire platform team for their tireless work over the past 4 months. This reduces our deployment time by 60% and sets us up for the next phase of growth. 🚀",
    reactions: { heart: 15, celebrate: 22, thumbsup: 38 },
    comments: 8,
    type: "general" as const,
  },
  {
    id: 4,
    pinned: false,
    author: "Emma Wilson",
    role: "Product Designer",
    initials: "EW",
    avatarColor: "bg-rose-500",
    timeAgo: "Yesterday",
    content: "",
    reactions: { heart: 29, celebrate: 34, thumbsup: 21 },
    comments: 15,
    type: "new_hire" as const,
  },
];

function Avatar({
  initials,
  color,
  size = "md",
}: {
  initials: string;
  color: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
  };
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center text-white font-semibold shrink-0",
        color,
        sizeClasses[size]
      )}
    >
      {initials}
    </div>
  );
}

function ReactionButton({
  icon: Icon,
  count,
  label,
}: {
  icon: React.ElementType;
  count: number;
  label: string;
}) {
  return (
    <button
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm",
        "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]",
        "transition-colors"
      )}
      aria-label={label}
    >
      <Icon className="h-4 w-4" />
      <span>{count}</span>
    </button>
  );
}

function PostCard({ post }: { post: (typeof feedPosts)[number] }) {
  if (post.type === "birthday") {
    return (
      <article
        className={cn(
          "rounded-xl overflow-hidden",
          "bg-gradient-to-br from-amber-500/10 via-pink-500/10 to-purple-500/10",
          "border border-amber-400/20"
        )}
      >
        <div className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <Avatar initials={post.initials} color={post.avatarColor} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-[var(--color-text-primary)]">
                  {post.author}
                </p>
                <Cake className="h-4 w-4 text-amber-500" />
              </div>
              <p className="text-sm text-[var(--color-text-muted)]">
                {post.role} · {post.timeAgo}
              </p>
            </div>
          </div>
          <div className="text-center py-4">
            <p className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">
              🎂 Happy Birthday, {post.author}! 🎉
            </p>
            <p className="text-[var(--color-text-muted)]">
              Wishing you an amazing year ahead. Enjoy your special day!
            </p>
          </div>
          <div className="flex items-center gap-1 pt-3 border-t border-amber-400/20">
            <ReactionButton icon={Heart} count={post.reactions.heart} label="Love" />
            <ReactionButton icon={PartyPopper} count={post.reactions.celebrate} label="Celebrate" />
            <ReactionButton icon={ThumbsUp} count={post.reactions.thumbsup} label="Like" />
            <div className="ml-auto flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
              <MessageCircle className="h-4 w-4" />
              <span>{post.comments}</span>
            </div>
          </div>
        </div>
      </article>
    );
  }

  if (post.type === "new_hire") {
    return (
      <article
        className={cn(
          "rounded-xl overflow-hidden",
          "bg-[var(--color-surface)] border border-[var(--color-border)]",
          "border-l-4 border-l-emerald-500"
        )}
      >
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="h-5 w-5 text-emerald-500" />
            <span className="text-sm font-medium text-emerald-500">New Team Member</span>
            <span className="text-sm text-[var(--color-text-muted)]">· {post.timeAgo}</span>
          </div>
          <div className="flex items-center gap-4 mb-3">
            <Avatar initials={post.initials} color={post.avatarColor} size="lg" />
            <div>
              <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                Welcome {post.author}!
              </p>
              <p className="text-[var(--color-text-muted)]">{post.role}</p>
            </div>
          </div>
          <p className="text-[var(--color-text-primary)] mb-1">
            Please join us in welcoming <strong>{post.author}</strong> to the Design team as our
            newest {post.role}! Emma comes to us from Figma with 5 years of experience in product
            design. She&apos;ll be working on the consumer mobile experience.
          </p>
          <p className="text-[var(--color-text-muted)] text-sm">
            Fun fact: Emma is an avid rock climber and board game enthusiast!
          </p>
          <div className="flex items-center gap-1 pt-3 mt-3 border-t border-[var(--color-border)]">
            <ReactionButton icon={Heart} count={post.reactions.heart} label="Love" />
            <ReactionButton icon={PartyPopper} count={post.reactions.celebrate} label="Celebrate" />
            <ReactionButton icon={ThumbsUp} count={post.reactions.thumbsup} label="Like" />
            <div className="ml-auto flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
              <MessageCircle className="h-4 w-4" />
              <span>{post.comments}</span>
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className={cn(
        "rounded-xl overflow-hidden",
        "bg-[var(--color-surface)] border border-[var(--color-border)]",
        post.pinned && "border-l-4 border-l-[var(--color-accent)]"
      )}
    >
      <div className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <Avatar initials={post.initials} color={post.avatarColor} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[var(--color-text-primary)]">{post.author}</p>
            <p className="text-sm text-[var(--color-text-muted)]">
              {post.role} · {post.timeAgo}
            </p>
          </div>
          {post.pinned && (
            <div className="flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] bg-[var(--color-accent)]/10 px-2 py-1 rounded-full">
              <Pin className="h-3 w-3" />
              Pinned
            </div>
          )}
        </div>
        <p className="text-[var(--color-text-primary)] leading-relaxed whitespace-pre-line">
          {post.content}
        </p>
        <div className="flex items-center gap-1 pt-3 mt-3 border-t border-[var(--color-border)]">
          <ReactionButton icon={Heart} count={post.reactions.heart} label="Love" />
          <ReactionButton icon={PartyPopper} count={post.reactions.celebrate} label="Celebrate" />
          <ReactionButton icon={ThumbsUp} count={post.reactions.thumbsup} label="Like" />
          <div className="ml-auto flex items-center gap-1.5 text-sm text-[var(--color-text-muted)]">
            <MessageCircle className="h-4 w-4" />
            <span>{post.comments}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function FeedPage() {
  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-6">Feed</h1>

      {/* Post Composer */}
      <div
        className={cn(
          "rounded-xl p-4 mb-6",
          "bg-[var(--color-surface)] border border-[var(--color-border)]"
        )}
      >
        <div className="flex items-center gap-3">
          <Avatar initials="YO" color="bg-[var(--color-accent)]" />
          <div className="flex-1">
            <input
              type="text"
              placeholder="What's on your mind?"
              className={cn(
                "w-full rounded-lg px-4 py-2.5 text-sm",
                "bg-[var(--color-background)] border border-[var(--color-border)]",
                "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]",
                "focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]",
                "transition-all"
              )}
            />
          </div>
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--color-border)]">
          <div className="flex items-center gap-1">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors">
              <Image className="h-4 w-4" />
              Photo
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] transition-colors">
              <Paperclip className="h-4 w-4" />
              Attach
            </button>
          </div>
          <button
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
              "bg-[var(--color-accent)] text-white",
              "hover:bg-[var(--color-accent-hover)] transition-colors",
              "shadow-[0_0_12px_var(--color-accent-glow)]"
            )}
          >
            <Send className="h-4 w-4" />
            Post
          </button>
        </div>
      </div>

      {/* Feed Posts */}
      <div className="space-y-4">
        {feedPosts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </div>
  );
}
