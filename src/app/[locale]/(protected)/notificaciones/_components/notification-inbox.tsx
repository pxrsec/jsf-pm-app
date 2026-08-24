"use client";

import { useState, useEffect, useTransition, useRef, useCallback } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { CheckCheck, Loader2, RefreshCw } from "lucide-react";
import type {
  RecipientInboxPage,
  RecipientInboxNotification,
  RecipientInboxCursor,
  RecipientInboxQuery,
} from "@/lib/notifications/inbox-contracts";
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
  loadRecipientInboxPageAction,
  type NotificationActionErrorCode,
} from "@/lib/notifications/actions";
import { NotificationEmptyState } from "./notification-empty-state";
import { NotificationInboxItem } from "./notification-inbox-item";
import { NotificationInboxFilters } from "./notification-inbox-filters";
import { getDefaultNotificationRange } from "@/lib/notifications/date-utils";

interface NotificationInboxProps {
  initialPage: RecipientInboxPage;
  currentQuery: RecipientInboxQuery;
}

export function NotificationInbox({
  initialPage,
  currentQuery,
}: NotificationInboxProps) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [notifications, setNotifications] = useState<
    readonly RecipientInboxNotification[]
  >(initialPage.notifications);
  const [nextCursor, setNextCursor] = useState<RecipientInboxCursor | null>(
    initialPage.nextCursor,
  );
  const [hasMore, setHasMore] = useState<boolean>(initialPage.hasMore);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<boolean>(false);

  const statusRef = useRef<HTMLDivElement>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);

  // Keyset state reset whenever RSC filter props change
  const [prevInitialPage, setPrevInitialPage] = useState(initialPage);
  if (initialPage !== prevInitialPage) {
    setPrevInitialPage(initialPage);
    setNotifications(initialPage.notifications);
    setNextCursor(initialPage.nextCursor);
    setHasMore(initialPage.hasMore);
    setLoadMoreError(false);
    setStatusMessage(null);
    setErrorMessage(null);
  }

  // Focus restoration: if previously focused element was removed, move focus to status region
  useEffect(() => {
    if (
      lastActiveElementRef.current &&
      !document.body.contains(lastActiveElementRef.current)
    ) {
      statusRef.current?.focus();
    }
  }, [notifications]);

  const mapErrorCodeToMessage = useCallback(
    (code: NotificationActionErrorCode): string => {
      switch (code) {
        case "VALIDATION_FAILED":
          return t("errors.validation");
        case "UNAUTHENTICATED":
          return t("errors.unauthenticated");
        case "UNAVAILABLE":
        default:
          return t("errors.unavailable");
      }
    },
    [t],
  );

  const handleMarkRead = useCallback(
    (recipientId: string) => {
      if (isPending) return;
      lastActiveElementRef.current = document.activeElement as HTMLElement;
      setErrorMessage(null);

      startTransition(async () => {
        const result = await markNotificationReadAction({
          notificationRecipientId: recipientId,
        });

        if (!result.ok) {
          setErrorMessage(mapErrorCodeToMessage(result.error.code));
          return;
        }

        setStatusMessage(
          result.changed ? t("readSuccess") : t("alreadyUpToDate"),
        );
        router.refresh();
      });
    },
    [isPending, mapErrorCodeToMessage, router, t],
  );

  const handleMarkAllRead = useCallback(() => {
    if (isPending) return;
    lastActiveElementRef.current = document.activeElement as HTMLElement;
    setErrorMessage(null);

    startTransition(async () => {
      const result = await markAllNotificationsReadAction();

      if (!result.ok) {
        setErrorMessage(mapErrorCodeToMessage(result.error.code));
        return;
      }

      setStatusMessage(
        (result.changedCount ?? 0) > 0
          ? t("allReadSuccess")
          : t("alreadyUpToDate"),
      );
      router.refresh();
    });
  }, [isPending, mapErrorCodeToMessage, router, t]);

  const handleLoadMore = useCallback(() => {
    if (!nextCursor || isPending) return;
    setErrorMessage(null);
    setLoadMoreError(false);

    startTransition(async () => {
      const result = await loadRecipientInboxPageAction({
        query: currentQuery,
        cursor: nextCursor,
      });

      if (!result.ok) {
        setLoadMoreError(true);
        setErrorMessage(mapErrorCodeToMessage(result.error.code));
        return;
      }

      setNotifications((prev) => [...prev, ...result.data.notifications]);
      setNextCursor(result.data.nextCursor);
      setHasMore(result.data.hasMore);
    });
  }, [currentQuery, isPending, mapErrorCodeToMessage, nextCursor]);

  const hasUnread = notifications.some((n) => n.readAt === null);

  const defaultRange = getDefaultNotificationRange();
  const isCustomDateRange =
    currentQuery.from !== defaultRange.from ||
    currentQuery.to !== defaultRange.to;

  return (
    <div className="space-y-6">
      {/* 90-Day Range Notice & Filter Controls */}
      <NotificationInboxFilters
        currentReadFilter={currentQuery.readFilter}
        currentFrom={currentQuery.from}
        currentTo={currentQuery.to}
      />

      {/* Live status announcements for screen readers & inline feedback */}
      <div
        ref={statusRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        className="focus:outline-none"
      >
        {statusMessage && (
          <div className="rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
            {statusMessage}
          </div>
        )}
      </div>

      {errorMessage && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {errorMessage}
        </div>
      )}

      {/* Header controls: Mark all read */}
      <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
        <p className="text-xs sm:text-sm text-muted-foreground">
          {t("listLabel")}
        </p>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending || !hasUnread}
          onClick={handleMarkAllRead}
          aria-label={t("markAllReadAria")}
          className="min-h-[44px] min-w-[44px] gap-2 text-xs font-medium"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <CheckCheck className="h-4 w-4 text-primary" aria-hidden="true" />
          )}
          <span>{hasUnread ? t("markAllRead") : t("markAllUnavailable")}</span>
        </Button>
      </div>

      {/* Keyset-ordered notification list or Contextual Empty State */}
      {notifications.length === 0 ? (
        <NotificationEmptyState
          readFilter={currentQuery.readFilter}
          isCustomDateRange={isCustomDateRange}
        />
      ) : (
        <ol aria-label={t("listLabel")} className="space-y-3">
          {notifications.map((notification) => (
            <NotificationInboxItem
              key={notification.recipientId}
              notification={notification}
              onMarkRead={handleMarkRead}
              isPending={isPending}
            />
          ))}
        </ol>
      )}

      {/* Keyset pagination / Load more controls */}
      {hasMore && (
        <div className="flex flex-col items-center justify-center pt-4">
          {loadMoreError ? (
            <div className="flex flex-col items-center gap-2 text-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={handleLoadMore}
                className="min-h-[44px] min-w-[44px] gap-2"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                <span>{t("error.retry")}</span>
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={handleLoadMore}
              aria-label={t("loadMoreAria")}
              className="min-h-[44px] min-w-[44px] gap-2"
            >
              {isPending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              <span>{t("loadMore")}</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
