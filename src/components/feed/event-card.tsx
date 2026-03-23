"use client";

import { useState, useEffect } from "react";
import { cn, timeAgo, getInitials } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { upsertEventAttendance, getEventAttendees } from "@/lib/actions/feed-events";
import type { AttendanceStatus } from "@/generated/prisma/client";

type EventPostProps = {
  post: {
    id: string;
    content: string;
    eventDate: Date | null;
    eventEndDate: Date | null;
    eventLocation: string | null;
    createdAt: Date;
    author: {
      id: string;
      firstName: string;
      lastName: string;
      jobTitle: string;
      profilePhoto?: string | null;
    };
  };
  currentUserId: string;
  currentEmployeeId: string;
  reactionsBar: React.ReactNode;
  commentsSection: React.ReactNode;
};

const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500"];

export function EventCard({ post, currentUserId, currentEmployeeId, reactionsBar, commentsSection }: EventPostProps) {
  const [myStatus, setMyStatus] = useState<AttendanceStatus | null>(null);
  const [goingCount, setGoingCount] = useState(0);
  const [maybeCount, setMaybeCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const initials = getInitials(post.author.firstName, post.author.lastName);
  const colorIdx = post.author.firstName.charCodeAt(0) % avatarColors.length;

  useEffect(() => {
    getEventAttendees(post.id).then((data) => {
      setGoingCount(data.going.length);
      setMaybeCount(data.maybe.length);
      const mine = [...data.going, ...data.maybe, ...data.notGoing].find(
        (a) => a.user.id === currentUserId
      );
      if (mine) setMyStatus(mine.status);
    });
  }, [post.id, currentUserId]);

  async function handleRSVP(status: AttendanceStatus) {
    setLoading(true);
    try {
      await upsertEventAttendance({ feedPostId: post.id, userId: currentUserId, status });
      const data = await getEventAttendees(post.id);
      setGoingCount(data.going.length);
      setMaybeCount(data.maybe.length);
      setMyStatus(status);
    } catch (err) {
      console.error("RSVP failed:", err);
    } finally {
      setLoading(false);
    }
  }

  const eventDate = post.eventDate
    ? new Date(post.eventDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <article className={cn("rounded-2xl overflow-hidden", "bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-purple-500/5", "border border-blue-400/20")}>
      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Icon name="event" size={20} className="text-blue-500" />
          <span className="text-sm font-medium text-blue-600">Event</span>
          <span className="text-sm text-[var(--color-text-muted)]">· {timeAgo(post.createdAt)}</span>
        </div>
        <div className="flex items-center gap-3 mb-3">
          {post.author.profilePhoto ? (
            <img src={post.author.profilePhoto} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
          ) : (
            <div className={cn("h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0", avatarColors[colorIdx])}>{initials}</div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[var(--color-text-primary)]">{post.author.firstName} {post.author.lastName}</p>
            <p className="text-sm text-[var(--color-text-muted)]">{post.author.jobTitle}</p>
          </div>
        </div>
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">{post.content}</h3>
        <div className="space-y-1.5 mb-4">
          {eventDate && (
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
              <Icon name="schedule" size={16} />
              <span>{eventDate}</span>
            </div>
          )}
          {post.eventLocation && (
            <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
              <Icon name="location_on" size={16} />
              <span>{post.eventLocation}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <Icon name="group" size={16} />
            <span>{goingCount} going{maybeCount > 0 ? `, ${maybeCount} maybe` : ""}</span>
          </div>
        </div>
        <div className="flex gap-2 mb-4">
          {(["GOING", "MAYBE", "NOT_GOING"] as const).map((status) => {
            const isActive = myStatus === status;
            const labels: Record<string, { label: string; icon: string }> = {
              GOING: { label: "Going", icon: "check_circle" },
              MAYBE: { label: "Maybe", icon: "help" },
              NOT_GOING: { label: "Can't go", icon: "cancel" },
            };
            const { label, icon } = labels[status];
            return (
              <button key={status} onClick={() => handleRSVP(status)} disabled={loading} className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors",
                isActive ? "bg-[var(--color-accent)] text-white" : "bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]",
                loading && "opacity-50"
              )}>
                <Icon name={icon} size={16} />
                {label}
              </button>
            );
          })}
        </div>
        <div className="pt-3 border-t border-blue-400/20">
          {reactionsBar}
          {commentsSection}
        </div>
      </div>
    </article>
  );
}
