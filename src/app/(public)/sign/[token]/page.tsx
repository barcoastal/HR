import { getSigningRequestByToken } from "@/lib/actions/signing";
import { SigningPage } from "@/components/signing/signing-page";
import { FileText } from "lucide-react";

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const signingRequest = await getSigningRequestByToken(token);

  if (!signingRequest) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link Expired</h1>
          <p className="text-gray-600">This signing link is no longer valid. Please contact HR for a new link.</p>
        </div>
      </div>
    );
  }

  return (
    <SigningPage
      token={token}
      data={{
        documentUrl: signingRequest.documentUrl,
        documentName: signingRequest.documentName,
        employeeName: `${signingRequest.employee.firstName} ${signingRequest.employee.lastName}`,
        status: signingRequest.status,
      }}
    />
  );
}
