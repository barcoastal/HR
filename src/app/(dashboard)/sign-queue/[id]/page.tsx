import { requireAuth } from "@/lib/auth-helpers";
import { getCountersignRequestForMe } from "@/lib/actions/countersign";
import { CountersignPage } from "@/components/signing/countersign-page";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";

export const dynamic = "force-dynamic";

export default async function CountersignRequestPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const request = await getCountersignRequestForMe(id);

  if (!request) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4">
        <Link href="/sign-queue" className="text-sm text-[var(--color-accent)] hover:underline flex items-center gap-1 mb-4">
          <Icon name="arrow_back" size={14} /> Back to Sign Queue
        </Link>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">This countersignature request is not available.</p>
        </div>
      </div>
    );
  }

  // Redirect if user somehow lands here but they're not the countersigner
  if (!request.signedDocUrl) {
    redirect("/sign-queue");
  }

  const placements = Array.isArray(request.signaturePlacements)
    ? (request.signaturePlacements as unknown as Array<{ page: number; xPct: number; yPct: number; widthPct: number; heightPct: number; kind: "signature" | "signatureDate" | "countersignature" | "countersignatureDate" }>)
    : [];

  const signerName = request.employee
    ? `${request.employee.firstName} ${request.employee.lastName}`
    : request.candidate
    ? `${request.candidate.firstName} ${request.candidate.lastName}`
    : request.signerName || "Unknown";

  return (
    <CountersignPage
      requestId={request.id}
      documentName={request.documentName}
      documentUrl={request.signedDocUrl}
      signerName={signerName}
      placements={placements}
    />
  );
}
