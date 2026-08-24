"use client";

import { useState, useTransition, useCallback, useRef } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { Button } from "@/components/ui/button";
import { History, Loader2, ArrowRight } from "lucide-react";
import type {
  AdminAuditCursor,
  AdminAuditItemDto,
  AdminAuditPage,
  AdminAuditQuery,
} from "@/lib/admin-operations/types";
import { loadAdminAuditPageAction } from "@/lib/admin-operations/actions";

interface AuditHistorySectionProps {
  initialPage: AdminAuditPage;
  currentQuery: AdminAuditQuery;
}

export function AuditHistorySection({
  initialPage,
  currentQuery,
}: AuditHistorySectionProps) {
  const t = useTranslations("adminOperations.audit");
  const format = useFormatter();
  const [isPending, startTransition] = useTransition();

  const [items, setItems] = useState<readonly AdminAuditItemDto[]>(
    initialPage.items,
  );
  const [nextCursor, setNextCursor] = useState<AdminAuditCursor | null>(
    initialPage.nextCursor,
  );
  const [hasMore, setHasMore] = useState<boolean>(initialPage.hasMore);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  // Keyset state reset when RSC props change after filter change
  const [prevInitialPage, setPrevInitialPage] = useState(initialPage);
  if (initialPage !== prevInitialPage) {
    setPrevInitialPage(initialPage);
    setItems(initialPage.items);
    setNextCursor(initialPage.nextCursor);
    setHasMore(initialPage.hasMore);
    setErrorMessage(null);
  }

  const handleLoadMore = useCallback(() => {
    if (!nextCursor || isPending) return;
    setErrorMessage(null);

    startTransition(async () => {
      const result = await loadAdminAuditPageAction({
        query: currentQuery,
        cursor: nextCursor,
      });

      if (!result.ok) {
        setErrorMessage(t("loadMoreError"));
        return;
      }

      setItems((prev) => [...prev, ...result.data.items]);
      setNextCursor(result.data.nextCursor);
      setHasMore(result.data.hasMore);
    });
  }, [currentQuery, isPending, nextCursor, t]);

  const getActionLabel = (action: string): string => {
    if (t.has(`actions.${action}`)) {
      return t(`actions.${action}`);
    }
    return t("actions.generic");
  };

  const getEntityTypeLabel = (entityType: string): string => {
    if (t.has(`entityTypes.${entityType}`)) {
      return t(`entityTypes.${entityType}`);
    }
    return entityType;
  };

  const getRoleLabel = (role: string | null): string => {
    if (!role) return "—";
    if (t.has(`roles.${role}`)) {
      return t(`roles.${role}`);
    }
    return role;
  };

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary" aria-hidden="true" />
          <div>
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {t("title")}
            </h2>
            <p className="text-xs text-muted-foreground">{t("description")}</p>
          </div>
        </div>
      </div>

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
            className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-2.5 text-xs text-destructive flex items-center justify-between"
          >
            <span>{errorMessage}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleLoadMore}
              className="text-xs min-h-[32px] ml-3"
            >
              {t("retry")}
            </Button>
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <caption className="sr-only">{t("tableCaption")}</caption>
          <thead>
            <tr className="border-b border-border/80 text-muted-foreground font-medium">
              <th scope="col" className="pb-2 pl-1">
                {t("columns.when")}
              </th>
              <th scope="col" className="pb-2">
                {t("columns.action")}
              </th>
              <th scope="col" className="pb-2">
                {t("columns.entityType")}
              </th>
              <th scope="col" className="pb-2">
                {t("columns.project")}
              </th>
              <th scope="col" className="pb-2">
                {t("columns.role")}
              </th>
              <th scope="col" className="pb-2">
                {t("columns.statusChange")}
              </th>
              <th scope="col" className="pb-2 pr-1">
                {t("columns.summary")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {items.map((item, idx) => (
              <tr
                key={`audit-${idx}`}
                className="hover:bg-muted/30 transition-colors"
              >
                <td className="py-2.5 pl-1 font-mono text-muted-foreground whitespace-nowrap">
                  <time dateTime={item.createdAt}>
                    {format.dateTime(new Date(item.createdAt), {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "numeric",
                    })}
                  </time>
                </td>
                <td className="py-2.5 font-medium text-foreground">
                  {getActionLabel(item.action)}
                </td>
                <td className="py-2.5 text-muted-foreground">
                  {getEntityTypeLabel(item.entityType)}
                </td>
                <td className="py-2.5 text-foreground font-medium">
                  {item.projectName ?? "—"}
                </td>
                <td className="py-2.5 text-muted-foreground">
                  {getRoleLabel(item.actorRole)}
                </td>
                <td className="py-2.5 text-foreground">
                  {item.oldStatus || item.newStatus ? (
                    <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                      <span>{item.oldStatus ?? "—"}</span>
                      <ArrowRight
                        className="h-3 w-3 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span className="font-semibold">
                        {item.newStatus ?? "—"}
                      </span>
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2.5 pr-1 text-muted-foreground text-[11px]">
                  {item.changedFieldSummary ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List View */}
      <div className="md:hidden space-y-3">
        {items.map((item, idx) => (
          <div
            key={`audit-m-${idx}`}
            className="rounded-lg border border-border bg-card p-3.5 space-y-2 text-xs"
          >
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <span className="font-semibold text-foreground">
                {getActionLabel(item.action)}
              </span>
              <time
                dateTime={item.createdAt}
                className="text-[11px] font-mono text-muted-foreground"
              >
                {format.dateTime(new Date(item.createdAt), {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "numeric",
                })}
              </time>
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-muted-foreground">
              <div>
                <span className="text-[11px] font-medium text-foreground">
                  {t("columns.entityType")}:
                </span>{" "}
                {getEntityTypeLabel(item.entityType)}
              </div>
              <div>
                <span className="text-[11px] font-medium text-foreground">
                  {t("columns.role")}:
                </span>{" "}
                {getRoleLabel(item.actorRole)}
              </div>
              {item.projectName && (
                <div className="col-span-2">
                  <span className="text-[11px] font-medium text-foreground">
                    {t("columns.project")}:
                  </span>{" "}
                  {item.projectName}
                </div>
              )}
              {(item.oldStatus || item.newStatus) && (
                <div className="col-span-2 flex items-center gap-1 font-mono text-[11px]">
                  <span className="font-medium text-foreground">
                    {t("columns.statusChange")}:
                  </span>
                  <span>{item.oldStatus ?? "—"}</span>
                  <ArrowRight
                    className="h-3 w-3 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="font-semibold">{item.newStatus ?? "—"}</span>
                </div>
              )}
            </div>

            {item.changedFieldSummary && (
              <p className="text-[11px] text-muted-foreground italic border-t border-border/30 pt-1.5">
                {item.changedFieldSummary}
              </p>
            )}
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <p className="text-center text-xs text-muted-foreground py-4 italic">
          {t("noRecords")}
        </p>
      )}

      {/* Load More Button */}
      {hasMore && (
        <div className="pt-2 flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleLoadMore}
            disabled={isPending}
            className="min-h-[44px] px-6 text-xs font-medium"
          >
            {isPending ? (
              <>
                <Loader2
                  className="h-3.5 w-3.5 animate-spin mr-1.5"
                  aria-hidden="true"
                />
                {t("loadingMore")}
              </>
            ) : (
              t("loadMore")
            )}
          </Button>
        </div>
      )}
    </section>
  );
}
