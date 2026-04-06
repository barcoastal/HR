import { extractPdfFormFields } from "@/lib/actions/filling";
import { FillingPage } from "@/components/filling/filling-page";
import { Icon } from "@/components/ui/icon";

export default async function FillPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await extractPdfFormFields(token);

  if (!result) {
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

  return (
    <FillingPage
      token={token}
      data={{
        fields: result.fields,
        documentUrl: `/api/fill/${token}/document`,
        documentName: result.documentName,
        employeeName: result.employeeName,
      }}
    />
  );
}
