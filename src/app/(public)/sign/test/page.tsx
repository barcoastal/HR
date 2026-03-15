import { SigningPage } from "@/components/signing/signing-page";

export default async function TestSignPage({ searchParams }: { searchParams: Promise<{ doc?: string; name?: string }> }) {
  const { doc, name } = await searchParams;

  const documentUrl = doc || "/api/onboarding-docs/sample.pdf";
  const documentName = name || "Sample Document";

  return (
    <SigningPage
      token="test"
      testMode
      data={{
        documentUrl,
        documentName,
        employeeName: "Test Employee",
        status: "PENDING",
      }}
    />
  );
}
