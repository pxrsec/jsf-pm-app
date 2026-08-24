"use client";

import { useState, useTransition, useCallback, useRef } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type {
  LinkIncidentItem,
  LinkIncidentCursor,
  LinkIncidentPage,
  LinkIncidentQuery,
} from "@/lib/archive/types";
import { loadLinkIncidentPageAction } from "@/lib/archive/actions";
import { IncidentEmptyState } from "./incident-empty-state";

interface IncidentListViewProps {
  initialPage: LinkIncidentPage;
  currentQuery: LinkIncidentQuery;
  isFiltered?: boolean;
}

export function IncidentListView({
  initialPage,
  currentQuery,
  isFiltered = false,
}: IncidentListViewProps) {
  const t = useTranslations("linkIncidents");
  const format = useFormatter();
  const [isPending, startTransition] = useTransition();

  const [items, setItems] = useState<readonly LinkIncidentItem[]>(
    initialPage.items,
  );
  const [nextCursor, setNextCursor] = useState<LinkIncidentCursor | null>(
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
      const result = await loadLinkIncidentPageAction({
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
    return <IncidentEmptyState isFiltered={isFiltered} />;
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
                {t("table.project")}
              </th>
              <th scope="col" className="px-4 py-3">
                {t("table.status")}
              </th>
              <th scope="col" className="px-4 py-3">
                {t("table.reportedAt")}
              </th>
              <th scope="col" className="px-4 py-3">
                {t("table.resolvedAt")}
              </th>
              <th scope="col" className="px-4 py-3">
                {t("table.reason")}
              </th>
              <th scope="col" className="px-4 py-3">
                {t("table.resolutionNote")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item) => {
              const reportedDate = format.dateTime(new Date(item.reportedAt), {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });

              const resolvedDate = item.resolvedAt
                ? format.dateTime(new Date(item.resolvedAt), {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : null;

              return (
                <tr
                  key={item.incidentId}
                  className="hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-foreground max-w-xs truncate">
                    {item.deliverableTitle}
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
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        item.incidentStatus === "open"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                          : item.incidentStatus === "resolved"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : "bg-muted text-muted-foreground border border-border"
                      }`}
                    >
                      {item.incidentStatus === "open" ? (
                        <AlertCircle className="h-3 w-3" aria-hidden="true" />
                      ) : item.incidentStatus === "resolved" ? (
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <XCircle className="h-3 w-3" aria-hidden="true" />
                      )}
                      <span>{t(`statuses.${item.incidentStatus}`)}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    <time dateTime={item.reportedAt}>{reportedDate}</time>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {resolvedDate ? (
                      <time dateTime={item.resolvedAt!}>{resolvedDate}</time>
                    ) : (
                      <span>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs truncate">
                    {item.reason || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs truncate">
                    {item.resolutionNote || "—"}
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
          const reportedDate = format.dateTime(new Date(item.reportedAt), {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

          const resolvedDate = item.resolvedAt
            ? format.dateTime(new Date(item.resolvedAt), {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : null;

          return (
            <div
              key={item.incidentId}
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
                    item.incidentStatus === "open"
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                      : item.incidentStatus === "resolved"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-muted text-muted-foreground border border-border"
                  }`}
                >
                  <span>{t(`statuses.${item.incidentStatus}`)}</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1 border-t border-border/60">
                <div>
                  <p className="font-medium text-foreground text-[11px]">
                    {t("table.reportedAt")}
                  </p>
                  <time dateTime={item.reportedAt}>{reportedDate}</time>
                </div>
                {resolvedDate && (
                  <div>
                    <p className="font-medium text-foreground text-[11px]">
                      {t("table.resolvedAt")}
                    </p>
                    <time dateTime={item.resolvedAt!}>{resolvedDate}</time>
                  </div>
                )}
              </div>

              {(item.reason || item.resolutionNote) && (
                <div className="space-y-1 text-xs text-muted-foreground pt-2 border-t border-border/60">
                  {item.reason && (
                    <p>
                      <span className="font-medium text-foreground">
                        {t("table.reason")}:{" "}
                      </span>
                      {item.reason}
                    </p>
                  )}
                  {item.resolutionNote && (
                    <p>
                      <span className="font-medium text-foreground">
                        {t("table.resolutionNote")}:{" "}
                      </span>
                      {item.resolutionNote}
                    </p>
                  )}
                </div>
              )}
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
