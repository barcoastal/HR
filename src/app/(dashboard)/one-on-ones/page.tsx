import { listOneOnOnes } from "@/lib/actions/one-on-ones";
import { requireAuth } from "@/lib/auth-helpers";
import { OneOnOnesView } from "@/components/one-on-ones/one-on-ones-view";
import { GoogleCalendarConnect } from "@/components/calendar/google-calendar-connect";
import { db } from "@/lib/db";
import { Icon } from "@/components/ui/icon";

export const dynamic = "force-dynamic";

export default async function OneOnOnesPage() {
  const session = await requireAuth();
  const role = session.user?.role;
  const myEmployeeId = session.user?.employeeId;
  const userId = session.user?.id;
  const [meetings, viewer] = await Promise.all([
    listOneOnOnes(),
    userId
      ? db.user.findUnique({ where: { id: userId }, select: { googleCalendarSyncEnabled: true } })
      : Promise.resolve(null),
  ]);

  const isManagerOrAbove =
    role === "SUPER_ADMIN" || role === "ADMIN" || role === "HR" || role === "MANAGER";
  const myCalendarConnected = !!viewer?.googleCalendarSyncEnabled;

  return (
    <div className="max-w-7xl mx-auto p-8 lg:p-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">1:1 Reviews</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Recurring performance check-ins between managers and direct reports.
        </p>
      </div>

      {isManagerOrAbove && userId && (
        <div className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3 min-w-0">
              <Icon name="calendar_month" size={20} className="text-[var(--color-accent)] mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {myCalendarConnected ? "You're the organizer on your 1:1s" : "Connect your own Google Calendar"}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {myCalendarConnected
                    ? "Calendar events for 1:1s you schedule are created on your calendar with you as the organizer."
                    : "Without this, 1:1 invites show whoever connected the shared Google Calendar as the organizer. Connect yours so each invite lists you instead."}
                </p>
              </div>
            </div>
            <GoogleCalendarConnect connected={myCalendarConnected} userId={userId} />
          </div>
        </div>
      )}

      <OneOnOnesView
        meetings={meetings.map((m) => ({
          id: m.id,
          type: m.type,
          status: m.status,
          scheduledAt: m.scheduledAt.toISOString(),
          completedAt: m.completedAt?.toISOString() || null,
          meetingLink: m.meetingLink,
          employee: m.employee,
          manager: m.manager,
        }))}
        currentEmployeeId={myEmployeeId || null}
        currentRole={role || "EMPLOYEE"}
      />
    </div>
  );
}
