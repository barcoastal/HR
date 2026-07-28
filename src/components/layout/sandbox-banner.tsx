export function SandboxBanner() {
  return (
    <div
      role="status"
      className="sticky top-0 z-50 border-b border-amber-500/30 bg-amber-500/15 px-4 py-2 text-center text-xs font-medium text-amber-800 dark:text-amber-200"
    >
      Sandbox mode — emails, SMS, calendar invites, and Gusto writes are dry-run only (check server logs).
    </div>
  );
}
