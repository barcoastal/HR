import { getFeedPosts } from "@/lib/actions/feed";
import { getEmployees } from "@/lib/actions/employees";
import { requireAuth } from "@/lib/auth-helpers";
import { getInitials } from "@/lib/utils";
import { PostComposer } from "@/components/feed/post-composer";
import { PostCard } from "@/components/feed/post-card";
import { PageHeader } from "@/components/ui/page-header";

export default async function FeedPage() {
  const session = await requireAuth();
  const [posts, employees] = await Promise.all([
    getFeedPosts(),
    getEmployees(),
  ]);
  const userInitials = session.user.name
    ? getInitials(session.user.name.split(" ")[0], session.user.name.split(" ")[1] || "")
    : "??";

  const employeeList = employees.map((e) => ({
    id: e.id,
    firstName: e.firstName,
    lastName: e.lastName,
  }));

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="Feed" description="Stay connected with your team" />

      {session.user.employeeId ? (
        <PostComposer
          employeeId={session.user.employeeId}
          initials={userInitials}
          employees={employeeList}
        />
      ) : (
        <p className="text-sm text-[var(--color-text-muted)] italic p-4 border border-[var(--color-border)] rounded-md">
          Link your account to an employee profile to post.
        </p>
      )}

      <div className="space-y-4">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post as any}
            currentEmployeeId={session.user.employeeId || ""}
          />
        ))}
        {posts.length === 0 && (
          <p className="text-center text-[var(--color-text-muted)] py-12">
            No posts yet. Be the first to share something!
          </p>
        )}
      </div>
    </div>
  );
}
