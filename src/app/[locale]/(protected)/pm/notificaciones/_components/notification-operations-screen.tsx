import "server-only";

import { getTranslations } from "next-intl/server";
import type { SuppressedNotificationOperationsPage } from "@/lib/notifications/operations-contracts";
import { NotificationOperationsQueue } from "./notification-operations-queue";

type NotificationOperationsScreenProps = {
  initialPage: SuppressedNotificationOperationsPage;
};

/**
 * Shared server-only presentation screen for authorized internal notification operations.
 * Renders the localized title, safe description, and role-neutral operations queue.
 */
export async function NotificationOperationsScreen({
  initialPage,
}: NotificationOperationsScreenProps) {
  const t = await getTranslations("notificationOperations");

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </header>

      <NotificationOperationsQueue initialPage={initialPage} />
    </div>
  );
}
