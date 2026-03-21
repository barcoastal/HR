import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";

type Alert = {
  id: string;
  title: string;
  status: string;
  emailsSent: number;
  smsSent: number;
  emailsFailed: number;
  smsFailed: number;
  createdAt: Date;
  sentBy: { firstName: string; lastName: string };
  feedPost: { content: string };
};

export function AlertHistory({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="text-center py-12">
        <Icon
          name="notifications_off"
          size={48}
          className="text-[var(--color-text-muted)] mx-auto mb-3"
        />
        <p className="text-[var(--color-text-muted)]">
          No emergency alerts have been sent yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="glass rounded-[var(--radius-xl)] p-5 border-l-4 border-l-red-500"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-bold text-[var(--color-on-surface)] truncate">
                  {alert.title}
                </h4>
                <span
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0",
                    alert.status === "SENT"
                      ? "bg-green-500/10 text-green-600"
                      : alert.status === "PARTIALLY_FAILED"
                        ? "bg-amber-500/10 text-amber-600"
                        : "bg-blue-500/10 text-blue-600"
                  )}
                >
                  {alert.status.replace("_", " ")}
                </span>
              </div>
              <p className="text-sm text-[var(--color-on-surface-variant)] line-clamp-2">
                {alert.feedPost.content}
              </p>
              <div className="flex items-center gap-4 mt-3 text-xs text-[var(--color-text-muted)]">
                <span>
                  By {alert.sentBy.firstName} {alert.sentBy.lastName}
                </span>
                <span>
                  {new Date(alert.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
            <div className="flex gap-4 shrink-0">
              <div className="text-center">
                <p className="text-lg font-black text-[var(--color-on-surface)]">
                  {alert.emailsSent}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                  Emails
                </p>
              </div>
              <div className="text-center">
                <p className="text-lg font-black text-[var(--color-on-surface)]">
                  {alert.smsSent}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
                  SMS
                </p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
