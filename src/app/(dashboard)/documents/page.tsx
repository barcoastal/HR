import { requireAuth } from "@/lib/auth-helpers";
import { getAllSigningRequests } from "@/lib/actions/signing";
import { getEmployees } from "@/lib/actions/employees";
import { DocumentSigningManager } from "@/components/documents/document-signing-manager";
import { PageHeader } from "@/components/ui/page-header";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  await requireAuth();
  const [signingRequests, employees] = await Promise.all([
    getAllSigningRequests(),
    getEmployees(),
  ]);

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <PageHeader
        title="Documents & Signing"
        description="Send documents for signing and track their status"
      />
      <DocumentSigningManager
        signingRequests={signingRequests.map((r) => ({
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
      />
    </div>
  );
}
