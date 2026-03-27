import { requireAuth } from "@/lib/auth-helpers";
import { NotificationsList } from "./notifications-list";

export default async function NotificationsPage() {
  await requireAuth();
  return <NotificationsList />;
}
