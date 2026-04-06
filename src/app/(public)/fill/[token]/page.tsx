import { db } from "@/lib/db";
import { FillingPage } from "@/components/filling/filling-page";
import { Icon } from "@/components/ui/icon";

export default async function FillPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const request = await db.signingRequest.findUnique({
    where: { token },
    include: { employee: true },
  });

  if (!request || request.expiresAt < new Date() || request.status === "SIGNED" || request.status === "VOIDED") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon name="description" size={32} className="text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link Expired</h1>
          <p className="text-gray-600">This link is no longer valid. Please contact HR for a new link.</p>
        </div>
      </div>
    );
  }

  // Mark as viewed
  if (request.status === "PENDING") {
    await db.signingRequest.update({
      where: { id: request.id },
      data: { status: "VIEWED", viewedAt: new Date() },
    });
  }

  const employeeName = request.signerName
    || (request.employee ? `${request.employee.firstName} ${request.employee.lastName}` : "Employee");

  return (
    <FillingPage
      token={token}
      data={{
        fields: [],
        detectedFields: [],
        pageCount: 1,
        documentUrl: `/api/fill/${token}/document`,
        documentName: request.documentName,
        employeeName,
      }}
    />
  );
}
