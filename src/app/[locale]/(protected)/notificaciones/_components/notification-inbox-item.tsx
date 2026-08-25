"use client";

import { useTranslations, useFormatter } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Check, Dot, ArrowRight, Loader2 } from "lucide-react";
import type { RecipientInboxNotification } from "@/lib/notifications/inbox-contracts";
import { resolveNotificationDestinationHref } from "@/lib/notifications/destination-routes";
import {
  resolveNotificationCategory,
  formatNotificationSentence,
  formatNotificationDetailAriaLabel,
} from "./types";

interface NotificationInboxItemProps {
  notification: RecipientInboxNotification;
  onMarkRead: (recipientId: string) => void;
  onNavigate: (recipientId: string, href: string) => void;
  isMarkReadPending: boolean;
  isNavigating: boolean;
}

export function NotificationInboxItem({
  notification,
  onMarkRead,
  onNavigate,
  isMarkReadPending,
  isNavigating,
}: NotificationInboxItemProps) {
  const t = useTranslations("notifications");
  const format = useFormatter();

  const isUnread = notification.readAt === null;
  const categoryKey = resolveNotificationCategory(notification.trigger);
  const categoryTitle = t(`categories.${categoryKey}.title`);
  const sentence = formatNotificationSentence(notification, t);

  const destinationHref = resolveNotificationDestinationHref(
    notification.destination,
  );
  const isNavigable = destinationHref !== null;
  const detailAriaLabel = formatNotificationDetailAriaLabel(
    notification,
    categoryTitle,
    t,
  );

  const formattedDate = format.dateTime(new Date(notification.createdAt), {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const formattedDeadline =
    notification.contextKind === "task_deadline" && notification.contextValue
      ? format.dateTime(new Date(notification.contextValue), {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  return (
    <li
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 sm:p-5 text-card-foreground shadow-xs transition-colors ${
        isUnread ? "border-primary/20 bg-card/90" : "opacity-90"
      }`}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {/* 1. Textual read/unread state badge */}
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

        <div className="space-y-1.5 min-w-0 flex-1">
          {/* 2. Localized action/category title & 6. Semantic <time> */}
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

          {/* 3. Localized event-specific sentence naming the safe subject */}
          <p className="text-sm text-foreground/90 leading-relaxed font-normal">
            {sentence}
          </p>

          {/* 4. Project context & 5. Deadline details */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {notification.projectName && (
              <span>
                {t("projectContext", { name: notification.projectName })}
              </span>
            )}
            {formattedDeadline && (
              <span>{t("deadlineContext", { date: formattedDeadline })}</span>
            )}
          </div>
        </div>
      </div>

      {/* Action region: View details & Sibling Mark as read */}
      <div className="flex flex-wrap items-center gap-2 shrink-0 self-end sm:self-center">
        {isNavigable && (
          <>
            {isUnread ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={isNavigating || isMarkReadPending}
                aria-busy={isNavigating}
                aria-label={detailAriaLabel}
                onClick={() =>
                  destinationHref &&
                  onNavigate(notification.recipientId, destinationHref)
                }
                className="min-h-[44px] min-w-[44px] gap-1.5 text-xs font-medium"
              >
                {isNavigating ? (
                  <>
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin"
                      aria-hidden="true"
                    />
                    <span>{t("navigating")}</span>
                  </>
                ) : (
                  <>
                    <span>{t("viewDetails")}</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </>
                )}
              </Button>
            ) : (
              <Link
                href={destinationHref}
                aria-label={detailAriaLabel}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "min-h-[44px] min-w-[44px] gap-1.5 text-xs font-medium",
                )}
              >
                <span>{t("viewDetails")}</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            )}
          </>
        )}

        {isUnread && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isMarkReadPending || isNavigating}
            onClick={() => onMarkRead(notification.recipientId)}
            aria-label={t("markReadAria", { category: categoryTitle })}
            className="min-h-[44px] min-w-[44px] text-xs font-medium"
          >
            {isMarkReadPending ? (
              <Loader2
                className="h-3.5 w-3.5 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <span>{t("markRead")}</span>
            )}
          </Button>
        )}
      </div>
    </li>
  );
}
