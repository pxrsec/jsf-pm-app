"use client";

import { useState, useTransition, useCallback, useRef } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, CheckCircle2, Send } from "lucide-react";
import type {
  FinalizedArchiveItem,
  FinalizedArchiveCursor,
  FinalizedArchivePage,
  FinalizedArchiveQuery,
} from "@/lib/archive/types";
import { loadFinalizedArchivePageAction } from "@/lib/archive/actions";
import { ExternalLinkButton } from "./external-link-button";
import { ArchiveEmptyState } from "./archive-empty-state";

interface ArchiveListViewProps {
  initialPage: FinalizedArchivePage;
  currentQuery: FinalizedArchiveQuery;
  isFiltered?: boolean;
}

export function ArchiveListView({
  initialPage,
  currentQuery,
  isFiltered = false,
}: ArchiveListViewProps) {
  const t = useTranslations("archive");
  const format = useFormatter();
  const [isPending, startTransition] = useTransition();

  const [items, setItems] = useState<readonly FinalizedArchiveItem[]>(
    initialPage.items,
  );
  const [nextCursor, setNextCursor] = useState<FinalizedArchiveCursor | null>(
    initialPage.nextCursor,
  );
  const [hasMore, setHasMore] = useState<boolean>(initialPage.hasMore);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<boolean>(false);

  const statusRef = useRef<HTMLDivElement>(null);

  // Keyset state reset when RSC props change after a filter change
  const [prevInitialPage, setPrevInitialPage] = useState(initialPage);
  if (initialPage !== prevInitialPage) {
    setPrevInitialPage(initialPage);
    setItems(initialPage.items);
    setNextCursor(initialPage.nextCursor);
    setHasMore(initialPage.hasMore);
    setLoadMoreError(false);
    setErrorMessage(null);
  }

  const handleLoadMore = useCallback(() => {
    if (!nextCursor || isPending) return;
    setErrorMessage(null);
    setLoadMoreError(false);

    startTransition(async () => {
      const result = await loadFinalizedArchivePageAction({
        query: currentQuery,
        cursor: nextCursor,
      });

      if (!result.ok) {
        setLoadMoreError(true);
        setErrorMessage(t("errors.unavailable"));
        return;
      }

      setItems((prev) => [...prev, ...result.data.items]);
      setNextCursor(result.data.nextCursor);
      setHasMore(result.data.hasMore);
    });
  }, [currentQuery, isPending, nextCursor, t]);

  if (items.length === 0) {
    return <ArchiveEmptyState isFiltered={isFiltered} />;
  }

  return (
    <div className="space-y-4">
      {/* Live Region for Screen Readers & Error Banner */}
      <div
        ref={statusRef}
        tabIndex={-1}
        role="status"
        aria-live="polite"
        className="focus:outline-none"
      >
        {errorMessage && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {errorMessage}
          </div>
        )}
      </div>

      {/* Desktop View: Semantic Table */}
      <div className="hidden md:block rounded-xl border border-border bg-card overflow-hidden shadow-xs">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <tr>
              <th scope="col" className="px-4 py-3">
                {t("table.deliverable")}
              </th>
              <th scope="col" className="px-4 py-3">
                {t("table.status")}
              </th>
              <th scope="col" className="px-4 py-3">
                {t("table.version")}
              </th>
              <th scope="col" className="px-4 py-3">
                {t("table.finalizedAt")}
              </th>
              <th scope="col" className="px-4 py-3">
                {t("table.project")}
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                {t("table.actions")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item) => {
              const formattedDate = format.dateTime(
                new Date(item.finalizedAt),
                {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                },
              );

              return (
                <tr
                  key={item.deliverableId}
                  className="hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-foreground max-w-xs truncate">
                    {item.deliverableTitle}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        item.finalStatus === "delivered"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                      }`}
                    >
                      {item.finalStatus === "delivered" ? (
                        <Send className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      )}
                      <span>
                        {item.finalStatus === "delivered"
                          ? t("statuses.delivered")
                          : t("statuses.approved")}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                    v{item.currentVersionNumber}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    <time dateTime={item.finalizedAt}>{formattedDate}</time>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {item.projectHref ? (
                      <Link
                        href={item.projectHref}
                        className="font-medium text-primary hover:underline"
                      >
                        {item.projectName}
                      </Link>
                    ) : (
                      <span className="text-foreground">
                        {item.projectName}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center justify-end gap-2">
                      <ExternalLinkButton
                        url={item.currentSubmissionUrl}
                        variant="submission"
                      />
                      <ExternalLinkButton
                        url={item.projectDriveFolderUrl}
                        variant="drive"
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile View: Cards */}
      <div className="md:hidden space-y-3">
        {items.map((item) => {
          const formattedDate = format.dateTime(new Date(item.finalizedAt), {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <div
              key={item.deliverableId}
              className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-semibold text-foreground text-sm">
                    {item.deliverableTitle}
                  </h4>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {item.projectHref ? (
                      <Link
                        href={item.projectHref}
                        className="font-medium text-primary hover:underline"
                      >
                        {item.projectName}
                      </Link>
                    ) : (
                      <span>{item.projectName}</span>
                    )}
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold shrink-0 ${
                    item.finalStatus === "delivered"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                  }`}
                >
                  {item.finalStatus === "delivered"
                    ? t("statuses.delivered")
                    : t("statuses.approved")}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/60">
                <span className="font-mono">v{item.currentVersionNumber}</span>
                <time dateTime={item.finalizedAt}>{formattedDate}</time>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-border/60">
                <ExternalLinkButton
                  url={item.currentSubmissionUrl}
                  variant="submission"
                />
                <ExternalLinkButton
                  url={item.projectDriveFolderUrl}
                  variant="drive"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Keyset Pagination Load More */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          {loadMoreError ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={handleLoadMore}
              className="gap-2 min-h-[44px]"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              <span>{t("actions.retry")}</span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={handleLoadMore}
              className="gap-2 min-h-[44px]"
            >
              {isPending && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              <span>{t("actions.loadMore")}</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
