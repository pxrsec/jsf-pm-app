"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { toast } from "sonner";
import { AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  setBugReportStatusAction,
  loadMoreBugReportsAction,
} from "@/lib/account-access/actions";
import type {
  AvailableResult,
  BugReportPageDto,
  BugReportItemDto,
  BugReportCursor,
  BugReportStatus,
  DateTimePresentationContext,
} from "@/lib/account-access/types";

export interface BugReportsPanelProps {
  initialResult: AvailableResult<BugReportPageDto>;
  presentation: DateTimePresentationContext;
}

const ALL_BUG_STATUSES: readonly BugReportStatus[] = [
  "open",
  "triaged",
  "resolved",
  "dismissed",
];

function formatDate(
  isoString: string | null,
  presentation: DateTimePresentationContext,
): string | null {
  if (!isoString) return null;
  try {
    return new Intl.DateTimeFormat(presentation.locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: presentation.timeZone || "UTC",
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

export function BugReportsPanel({
  initialResult,
  presentation,
}: BugReportsPanelProps) {
  const t = useTranslations("accountAccess");
  const router = useRouter();

  const [items, setItems] = useState<readonly BugReportItemDto[]>(
    initialResult.status === "available" ? initialResult.data.items : [],
  );
  const [nextCursor, setNextCursor] = useState<BugReportCursor | null>(
    initialResult.status === "available" ? initialResult.data.nextCursor : null,
  );
  const [hasMore, setHasMore] = useState<boolean>(
    initialResult.status === "available" ? initialResult.data.hasMore : false,
  );

  const [isLoadingMore, startLoadMoreTransition] = useTransition();
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [pendingReportId, setPendingReportId] = useState<string | null>(null);

  if (initialResult.status === "unavailable") {
    return (
      <div
        className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 max-w-xl space-y-4"
        role="alert"
        data-testid="bug-reports-unavailable"
      >
        <div className="flex items-center gap-2 text-destructive font-medium">
          <AlertCircle className="size-5" />
          <span>{t("bugTriage.unavailableTitle")}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("bugTriage.unavailableDescription")}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.refresh()}
          className="min-h-[44px] gap-2"
        >
          <RefreshCw className="size-4" />
          <span>{t("bugTriage.retryButton")}</span>
        </Button>
      </div>
    );
  }

  const handleStatusChange = async (
    reportId: string,
    newStatus: BugReportStatus,
  ) => {
    if (pendingReportId !== null) return;
    setPendingReportId(reportId);

    try {
      const result = await setBugReportStatusAction({
        reportId,
        status: newStatus,
      });

      if (result.ok) {
        toast.success(t("bugTriage.updatedToast"));
        router.refresh();
      } else if (result.error.code === "not_found_or_unchanged") {
        toast.info(t("bugTriage.notFoundOrUnchangedToast"));
        router.refresh();
      } else {
        toast.error(t("commonErrors.unavailable"));
      }
    } finally {
      setPendingReportId(null);
    }
  };

  const handleLoadMore = () => {
    if (!nextCursor || isLoadingMore) return;
    setLoadMoreError(null);

    startLoadMoreTransition(async () => {
      const result = await loadMoreBugReportsAction(nextCursor);
      if (result.ok) {
        setItems((curr) => [...curr, ...result.data.items]);
        setNextCursor(result.data.nextCursor);
        setHasMore(result.data.hasMore);
      } else {
        setLoadMoreError(t("bugTriage.loadMoreError"));
      }
    });
  };

  if (items.length === 0) {
    return (
      <div
        className="rounded-lg border border-dashed p-8 text-center space-y-2"
        data-testid="bug-reports-empty"
      >
        <p className="font-medium text-foreground">
          {t("bugTriage.emptyTitle")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("bugTriage.emptyDescription")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="bug-reports-panel">
      <div className="space-y-4">
        {items.map((report) => {
          const formattedCreatedAt = formatDate(report.createdAt, presentation);
          const formattedStatusChangedAt =
            report.status !== "open"
              ? formatDate(report.statusChangedAt, presentation)
              : null;
          const isRowPending = pendingReportId === report.reportId;

          return (
            <div
              key={report.reportId}
              className="rounded-lg border p-4 sm:p-6 space-y-4 bg-card text-card-foreground shadow-xs"
              data-testid={`bug-report-${report.reportId}`}
            >
              {/* Header: Title & Badges */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="font-semibold text-base sm:text-lg leading-snug">
                    {report.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {t("bugTriage.reporterRoleLabel")}:{" "}
                      {t(`roles.${report.reporterRole}`)}
                    </Badge>
                    <Badge
                      variant={
                        report.status === "open"
                          ? "destructive"
                          : report.status === "triaged"
                            ? "default"
                            : report.status === "resolved"
                              ? "secondary"
                              : "outline"
                      }
                      className="text-xs"
                    >
                      {t(`bugStatuses.${report.status}`)}
                    </Badge>
                  </div>
                </div>

                {/* Status Selector */}
                <div className="w-full sm:w-44 shrink-0">
                  <Select
                    value={report.status}
                    onValueChange={(val) =>
                      handleStatusChange(
                        report.reportId,
                        val as BugReportStatus,
                      )
                    }
                    disabled={isRowPending}
                  >
                    <SelectTrigger
                      className="min-h-[44px] w-full text-xs"
                      aria-label={`${t("bugTriage.statusControlAria")}: ${report.title}`}
                    >
                      {isRowPending ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="size-3.5 animate-spin" />
                          <span>{t("bugTriage.updating")}</span>
                        </div>
                      ) : (
                        <SelectValue />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_BUG_STATUSES.map((st) => (
                        <SelectItem key={st} value={st} className="text-xs">
                          {t(`bugStatuses.${st}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {report.description}
              </p>

              {/* Timestamps */}
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground pt-2 border-t border-border/50">
                <p>
                  <span className="font-medium text-foreground">
                    {t("bugTriage.createdAtLabel")}:
                  </span>{" "}
                  {formattedCreatedAt}
                </p>
                {formattedStatusChangedAt && (
                  <p>
                    <span className="font-medium text-foreground">
                      {t("bugTriage.statusChangedAtLabel")}:
                    </span>{" "}
                    {formattedStatusChangedAt}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Continuation Error Alert */}
      {loadMoreError && (
        <div
          role="alert"
          className="rounded-md bg-destructive/15 p-3 text-sm text-destructive"
        >
          {loadMoreError}
        </div>
      )}

      {/* Load More Button */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="min-h-[44px] min-w-32"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                <span>{t("bugTriage.loadingMore")}</span>
              </>
            ) : (
              <span>{t("bugTriage.loadMoreButton")}</span>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
