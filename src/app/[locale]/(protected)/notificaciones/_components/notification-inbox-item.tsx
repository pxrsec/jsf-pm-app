"use client";

import { useTranslations, useFormatter } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Dot } from "lucide-react";
import type { RecipientInboxNotification } from "@/lib/notifications/inbox-contracts";
import { resolveNotificationCategory } from "./types";

interface NotificationInboxItemProps {
  notification: RecipientInboxNotification;
  onMarkRead: (recipientId: string) => void;
  isPending: boolean;
}

export function NotificationInboxItem({
  notification,
  onMarkRead,
  isPending,
}: NotificationInboxItemProps) {
  const t = useTranslations("notifications");
  const format = useFormatter();

  const isUnread = notification.readAt === null;
  const categoryKey = resolveNotificationCategory(notification.trigger);
  const categoryTitle = t(`categories.${categoryKey}.title`);
  const categoryDescription = t(`categories.${categoryKey}.description`);

  const formattedDate = format.dateTime(new Date(notification.createdAt), {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <li className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 sm:p-5 text-card-foreground shadow-sm transition-colors">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div className="mt-0.5 shrink-0">
          {isUnread ? (
            <Badge
              variant="default"
              className="gap-1 px-2 py-0.5 text-xs font-medium"
            >
              <Dot className="h-4 w-4 -ml-1 text-primary-foreground animate-pulse" />
              <span>{t("unreadState")}</span>
            </Badge>
          ) : (
            <Badge
              variant="secondary"
              className="gap-1 px-2 py-0.5 text-xs font-medium text-muted-foreground"
            >
              <Check className="h-3 w-3" aria-hidden="true" />
              <span>{t("readState")}</span>
            </Badge>
          )}
        </div>

        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {categoryTitle}
            </span>
            <span className="text-xs text-muted-foreground" aria-hidden="true">
              •
            </span>
            <time
              dateTime={notification.createdAt}
              className="text-xs text-muted-foreground"
            >
              {formattedDate}
            </time>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {categoryDescription}
          </p>
        </div>
      </div>

      {isUnread && (
        <div className="shrink-0 self-end sm:self-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => onMarkRead(notification.recipientId)}
            aria-label={t("markReadAria", { category: categoryTitle })}
            className="min-h-[44px] min-w-[44px] text-xs font-medium"
          >
            {t("markRead")}
          </Button>
        </div>
      )}
    </li>
  );
}
