import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth-helpers";
import { getAuditLog, getAuditLogActions } from "@/lib/actions/audit-log";
import { AuditLogTable } from "@/components/audit/audit-log-table";

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; entityType?: string; actorEmail?: string }>;
}) {
  const session = await requireAuth();
  if (session.user?.role !== "SUPER_ADMIN") {
    redirect("/");
  }
  const params = await searchParams;
  const [rows, actions] = await Promise.all([
    getAuditLog({
      action: params.action,
      entityType: params.entityType,
      actorEmail: params.actorEmail,
      limit: 200,
    }),
    getAuditLogActions(),
  ]);

  return (
    <div className="max-w-6xl mx-auto p-8 lg:p-12">
      <div className="mb-8">
        <h2 className="text-4xl font-black tracking-tight text-[var(--color-on-surface)] mb-2">
          Audit Log
        </h2>
        <p className="text-[var(--color-on-surface-variant)] font-medium">
          Who did what, when. Visible to super admins only.
        </p>
      </div>

      <AuditLogTable
        rows={rows.map((r) => ({
          id: r.id,
          createdAt: r.createdAt.toISOString(),
          actorEmail: r.actorEmail,
          actorRole: r.actorRole,
          action: r.action,
          entityType: r.entityType,
          entityId: r.entityId,
          details: r.details,
        }))}
        actions={actions}
        currentFilters={params}
      />
    </div>
  );
}
