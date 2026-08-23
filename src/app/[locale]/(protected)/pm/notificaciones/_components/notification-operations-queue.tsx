"use client";

import { useState, useRef, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadSuppressedNotificationOperationsPageAction } from "@/lib/notifications/operations-actions";
import type {
  SuppressedNotificationOperation,
  SuppressedNotificationOperationsCursor,
  SuppressedNotificationOperationsPage,
} from "@/lib/notifications/operations-contracts";
import { SuppressedDeliveryStatus } from "./suppressed-delivery-status";
import { NotificationOperationsEmptyState } from "./notification-operations-empty-state";

type NotificationOperationsQueueProps = {
  initialPage: SuppressedNotificationOperationsPage;
};

export function NotificationOperationsQueue({
  initialPage,
}: NotificationOperationsQueueProps) {
  const t = useTranslations("notificationOperations");
  const [, startTransition] = useTransition();

  const [operations, setOperations] = useState<
    readonly SuppressedNotificationOperation[]
  >(initialPage.operations);
  const [cursor, setCursor] =
    useState<SuppressedNotificationOperationsCursor | null>(
      initialPage.nextCursor,
    );
  const [hasMore, setHasMore] = useState<boolean>(initialPage.hasMore);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const statusRef = useRef<HTMLDivElement>(null);
  const loadMoreBtnRef = useRef<HTMLButtonElement>(null);

  const [prevInitialPage, setPrevInitialPage] = useState(initialPage);
  if (initialPage !== prevInitialPage) {
    setPrevInitialPage(initialPage);
    setOperations(initialPage.operations);
    setCursor(initialPage.nextCursor);
    setHasMore(initialPage.hasMore);
    setIsLoadingMore(false);
    setStatusMessage(null);
    setErrorMessage(null);
  }

  const handleLoadMore = async () => {
    if (!cursor || isLoadingMore) return;

    setIsLoadingMore(true);
    setStatusMessage(t("loadingMore"));
    setErrorMessage(null);

    const result = await loadSuppressedNotificationOperationsPageAction(cursor);

    setIsLoadingMore(false);

    if (result.ok) {
      const newPage = result.data;
      startTransition(() => {
        setOperations((prev) => [...prev, ...newPage.operations]);
        setCursor(newPage.nextCursor);
        setHasMore(newPage.hasMore);
        setStatusMessage(t("loadMoreSuccess"));
        setErrorMessage(null);
      });

      if (!newPage.hasMore) {
        // When load more button disappears, transfer focus to status region
        setTimeout(() => {
          statusRef.current?.focus();
        }, 0);
      }
    } else {
      setStatusMessage(null);
      switch (result.error.code) {
        case "VALIDATION_FAILED":
          setErrorMessage(t("errors.validation"));
          break;
        case "UNAUTHORIZED":
          setErrorMessage(t("errors.unauthorized"));
          break;
        case "UNAVAILABLE":
        default:
          setErrorMessage(t("errors.unavailable"));
          break;
      }
    }
  };

  if (operations.length === 0) {
    return <NotificationOperationsEmptyState />;
  }

  return (
    <div className="space-y-6">
      {/* Semantic Ordered List for Chronological Suppression History */}
      <ol aria-label={t("listLabel")} className="space-y-4">
        {operations.map((operation) => (
          <SuppressedDeliveryStatus
            key={`${operation.eventId}:${operation.channel}`}
            operation={operation}
          />
        ))}
      </ol>

      {/* Visible Polite Status Region */}
      <div
        ref={statusRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        className="focus:outline-none"
      >
        {statusMessage && (
          <p className="text-xs text-muted-foreground">{statusMessage}</p>
        )}
      </div>

      {/* Visible Alert Failure Region */}
      {errorMessage && (
        <div
          role="alert"
          className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-xs font-medium text-destructive"
        >
          {errorMessage}
        </div>
      )}

      {/* Pagination / Retry Controls */}
      <div className="flex justify-center pt-2">
        {errorMessage ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="min-h-[44px] min-w-[44px] px-6 text-sm font-medium gap-2"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoadingMore ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            <span>{t("retry")}</span>
          </Button>
        ) : (
          hasMore && (
            <Button
              ref={loadMoreBtnRef}
              type="button"
              variant="outline"
              size="lg"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              aria-label={t("loadMoreAria")}
              className="min-h-[44px] min-w-[44px] px-6 text-sm font-medium gap-2"
            >
              {isLoadingMore ? (
                <>
                  <Loader2
                    className="w-4 h-4 animate-spin"
                    aria-hidden="true"
                  />
                  <span>{t("loadingMore")}</span>
                </>
              ) : (
                <span>{t("loadMore")}</span>
              )}
            </Button>
          )
        )}
      </div>
    </div>
  );
}
