import { requireAuth } from "@/lib/auth-helpers";
import { getAllSigningRequests } from "@/lib/actions/signing";
import { getEmployees } from "@/lib/actions/employees";
import { getEligibleCountersigners } from "@/lib/actions/stage-documents";
import { DocumentSigningManager } from "@/components/documents/document-signing-manager";
import { PageHeader } from "@/components/ui/page-header";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const session = await requireAuth();
  const role = session.user?.role;
  const employeeId = session.user?.employeeId;
  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN" || role === "HR";
  const isManager = role === "MANAGER";

  const allRequests = await getAllSigningRequests();

  // Filter signing requests based on role
  let filteredRequests = allRequests;
  if (!isAdmin) {
    if (isManager && employeeId) {
      // Managers see their own + their direct reports' documents
      const directReports = await db.employee.findMany({
        where: { managerId: employeeId },
        select: { id: true },
      });
      const allowedIds = new Set([employeeId, ...directReports.map((r) => r.id)]);
      filteredRequests = allRequests.filter((r) => r.employeeId && allowedIds.has(r.employeeId));
    } else if (employeeId) {
      // Regular employees see only their own documents
      filteredRequests = allRequests.filter((r) => r.employeeId === employeeId);
    } else {
      filteredRequests = [];
    }
  }

  // Only admins get the employee list for sending new documents
  const employees = isAdmin ? await getEmployees() : [];
  const countersigners = isAdmin ? await getEligibleCountersigners() : [];

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <PageHeader
        title="Documents & Signing"
        description={isAdmin ? "Send documents for signing and track their status" : "View your documents and signing requests"}
      />
      <DocumentSigningManager
        signingRequests={filteredRequests.map((r) => ({
          ...r,
          signedAt: r.signedAt,
          viewedAt: r.viewedAt,
          expiresAt: r.expiresAt,
          createdAt: r.createdAt,
        }))}
        employees={employees.map((e) => ({
          id: e.id,
          firstName: e.firstName,
          lastName: e.lastName,
          email: e.email,
        }))}
        countersigners={countersigners}
        isAdmin={isAdmin}
        currentEmployeeId={employeeId}
      />
    </div>
  );
}
