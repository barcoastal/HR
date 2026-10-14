import { redirect } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

/** Background checks moved into the Super-Admin-only "I-9 & Background Checks" page. */
export default async function BackgroundChecksPage() {
  await requireSuperAdmin();
  redirect("/compliance?tab=background-checks");
}
