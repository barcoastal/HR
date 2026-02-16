import { cn, getInitials } from "@/lib/utils";
import { getWelcomeData } from "@/lib/actions/my-profile";
import { requireAuth } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { CheckCircle2, Circle, Sparkles, Users } from "lucide-react";

const avatarColors = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-purple-500", "bg-cyan-500"];

export default async function WelcomePage() {
  const session = await requireAuth();
  if (!session.user.employeeId) redirect("/");

  const data = await getWelcomeData(session.user.employeeId);
  if (!data) redirect("/");

  const { employee, totalTasks, completedTasks, progressPercent } = data;

  if (employee.status !== "ONBOARDING") {
    redirect("/");
  }

  const initials = getInitials(employee.firstName, employee.lastName);
  const colorIdx = employee.firstName.charCodeAt(0) % avatarColors.length;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Hero */}
      <div className={cn("rounded-xl overflow-hidden mb-8", "bg-gradient-to-br from-[var(--color-accent)]/20 via-purple-500/10 to-pink-500/10", "border border-[var(--color-accent)]/20")}>
        <div className="p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className={cn("h-20 w-20 rounded-2xl flex items-center justify-center text-white text-2xl font-bold", avatarColors[colorIdx])}>
              {initials}
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-[var(--color-accent)]" />
            <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Welcome, {employee.firstName}!</h1>
            <Sparkles className="h-5 w-5 text-[var(--color-accent)]" />
          </div>
          <p className="text-[var(--color-text-muted)] max-w-lg mx-auto">
            We&apos;re thrilled to have you join {employee.department?.name || "the team"}. Here&apos;s everything you need to get started.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Welcome Video */}
        <section className={cn("rounded-xl p-6", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Welcome Video</h2>
          <div className={cn("aspect-video rounded-lg flex items-center justify-center", "bg-[var(--color-background)] border border-[var(--color-border)]")}>
            <div className="text-center">
              <div className="h-12 w-12 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center mx-auto mb-2">
                <svg className="h-6 w-6 text-[var(--color-accent)]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <p className="text-sm text-[var(--color-text-muted)]">Company welcome video</p>
            </div>
          </div>
        </section>

        {/* Buddy Card */}
        <section className={cn("rounded-xl p-6", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Your Onboarding Buddy</h2>
          {employee.buddy ? (
            <div className="flex items-center gap-4">
              <div className={cn("h-14 w-14 rounded-xl flex items-center justify-center text-white text-lg font-bold", avatarColors[employee.buddy.firstName.charCodeAt(0) % avatarColors.length])}>
                {getInitials(employee.buddy.firstName, employee.buddy.lastName)}
              </div>
              <div>
                <p className="text-lg font-semibold text-[var(--color-text-primary)]">{employee.buddy.firstName} {employee.buddy.lastName}</p>
                <p className="text-sm text-[var(--color-text-muted)]">{employee.buddy.jobTitle}</p>
                <p className="text-xs text-[var(--color-accent)] mt-1">Your go-to person for questions!</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-[var(--color-text-muted)]">
              <Users className="h-10 w-10" />
              <p className="text-sm">A buddy will be assigned to you soon!</p>
            </div>
          )}
        </section>
      </div>

      {/* Onboarding Progress */}
      <section className={cn("rounded-xl p-6 mb-8", "bg-[var(--color-surface)] border border-[var(--color-border)]")}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Onboarding Progress</h2>
          <span className="text-sm font-medium text-[var(--color-accent)]">{progressPercent}%</span>
        </div>

        {/* Progress bar */}
        <div className="h-2 rounded-full bg-[var(--color-background)] mb-6">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-[var(--color-accent)] to-purple-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          {completedTasks} of {totalTasks} tasks completed
        </p>

        <div className="space-y-2">
          {employee.employeeTasks.map((task) => (
            <div key={task.id} className={cn("flex items-center gap-3 p-3 rounded-lg", "hover:bg-[var(--color-surface-hover)] transition-colors")}>
              {task.status === "DONE" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
              ) : (
                <Circle className="h-5 w-5 text-[var(--color-text-muted)] shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm", task.status === "DONE" ? "text-[var(--color-text-muted)] line-through" : "text-[var(--color-text-primary)]")}>
                  {task.checklistItem.title}
                </p>
                {task.checklistItem.description && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{task.checklistItem.description}</p>
                )}
              </div>
            </div>
          ))}
          {totalTasks === 0 && (
            <p className="text-sm text-[var(--color-text-muted)] text-center py-4">No onboarding tasks assigned yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
