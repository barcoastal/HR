import { requireAuth } from "@/lib/auth-helpers";
import { getAnonFeedback } from "@/lib/actions/voice";
import { canAccessSettings } from "@/lib/permissions";
import type { UserRole } from "@/generated/prisma/client";
import { FeedbackForm } from "@/components/voice/feedback-form";
import { FeedbackList } from "@/components/voice/feedback-list";
import { PageHeader } from "@/components/ui/page-header";

export default async function VoicePage() {
  const session = await requireAuth();
  const role = (session.user.role || "EMPLOYEE") as UserRole;
  const isAdmin = canAccessSettings(role);

  const feedbacks = isAdmin ? await getAnonFeedback() : [];

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <PageHeader
        title="Your Voice"
        description={isAdmin
          ? "View and respond to anonymous feedback from your team"
          : "Share anonymous feedback — your identity is never recorded"}
      />

      <div className="space-y-6">
        <FeedbackForm />

        {isAdmin && (
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Feedback Received</h2>
            <FeedbackList feedbacks={feedbacks as any} />
          </div>
        )}
      </div>
    </div>
  );
}
