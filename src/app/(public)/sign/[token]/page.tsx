import { getSigningRequestByToken } from "@/lib/actions/signing";
import { SigningPage } from "@/components/signing/signing-page";
import { Icon } from "@/components/ui/icon";

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const signingRequest = await getSigningRequestByToken(token);

  if (!signingRequest) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon name="description" size={32} className="text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link Expired</h1>
          <p className="text-gray-600">This signing link is no longer valid. Please contact HR for a new link.</p>
        </div>
      </div>
    );
  }

  const signerName = signingRequest.signerName
    || (signingRequest.employee ? `${signingRequest.employee.firstName} ${signingRequest.employee.lastName}` : "Signer");

  const placements = Array.isArray(signingRequest.signaturePlacements)
    ? (signingRequest.signaturePlacements as unknown as Array<{ page: number; xPct: number; yPct: number; widthPct: number; heightPct: number; kind: "signature" | "signatureDate" }>)
    : [];

  return (
    <SigningPage
      token={token}
      data={{
        documentUrl: `/api/sign/${token}/document`,
        documentName: signingRequest.documentName,
        employeeName: signerName,
        status: signingRequest.status,
        signaturePlacements: placements,
      }}
    />
  );
}
