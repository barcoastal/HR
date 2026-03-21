import { requireAdmin } from "@/lib/auth-helpers";
import { getEmergencyAlerts } from "@/lib/actions/emergency-alerts";
import { AlertComposer } from "@/components/alerts/alert-composer";
import { AlertHistory } from "@/components/alerts/alert-history";
import { PageHeader } from "@/components/ui/page-header";
import { redirect } from "next/navigation";

export default async function AlertsPage() {
  const session = await requireAdmin();
  const role = session.user?.role;

  // Only ADMIN and SUPER_ADMIN
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    redirect("/");
  }

  const alerts = await getEmergencyAlerts();

  return (
    <div className="max-w-4xl mx-auto p-8">
      <PageHeader
        title="Emergency Alerts"
        description="Broadcast urgent messages to the entire company via feed, email, and SMS."
      />

      <div className="space-y-8">
        <AlertComposer />

        <div>
          <h3 className="text-lg font-bold text-[var(--color-on-surface)] mb-4">
            Alert History
          </h3>
          <AlertHistory alerts={alerts as any} />
        </div>
      </div>
    </div>
  );
}
