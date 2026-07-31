import { IS_SANDBOX } from "@/lib/sandbox";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {IS_SANDBOX && (
        <div className="bg-amber-500 text-black text-center text-xs font-semibold py-1.5 px-4">
          SANDBOX ENVIRONMENT — sign in with a demo account: admin / hr / manager / employee (password: sandbox123)
        </div>
      )}
      {children}
    </>
  );
}
