"use client";

import { useTransition, useCallback } from "react";
import { useRouter, usePathname } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Calendar, Filter, Loader2, Info } from "lucide-react";
import type { NotificationReadFilter } from "@/lib/notifications/inbox-contracts";
import {
  getDefaultNotificationRange,
  formatIsoWithOffset,
} from "@/lib/notifications/date-utils";
import { TZDate } from "@date-fns/tz";
import { CALENDAR_TIME_ZONE } from "@/lib/calendar/date-utils";

interface NotificationInboxFiltersProps {
  currentReadFilter: NotificationReadFilter;
  currentFrom: string;
  currentTo: string;
}

export function NotificationInboxFilters({
  currentReadFilter,
  currentFrom,
  currentTo,
}: NotificationInboxFiltersProps) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateFilters = useCallback(
    (updates: { from?: string; to?: string; read?: string }) => {
      const params = new URLSearchParams(searchParams.toString());

      if (updates.from !== undefined) {
        params.set("from", updates.from);
      }
      if (updates.to !== undefined) {
        params.set("to", updates.to);
      }
      if (updates.read !== undefined) {
        if (updates.read && updates.read !== "all") {
          params.set("read", updates.read);
        } else {
          params.delete("read");
        }
      }

      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [searchParams, router, pathname],
  );

  const handleReadFilter = (filter: NotificationReadFilter) => {
    updateFilters({ read: filter });
  };

  const handlePresetLast90Days = () => {
    const range = getDefaultNotificationRange();
    updateFilters({ from: range.from, to: range.to });
  };

  const handlePresetPrevious90Days = () => {
    const now = new Date();
    const endTz = new TZDate(
      now.getTime() - 90 * 24 * 60 * 60 * 1000,
      CALENDAR_TIME_ZONE,
    );
    const startTz = new TZDate(
      now.getTime() - 180 * 24 * 60 * 60 * 1000,
      CALENDAR_TIME_ZONE,
    );

    updateFilters({
      from: formatIsoWithOffset(startTz),
      to: formatIsoWithOffset(endTz),
    });
  };

  const defaultRange = getDefaultNotificationRange();
  const isDefaultRange =
    currentFrom === defaultRange.from && currentTo === defaultRange.to;

  return (
    <div className="space-y-3">
      {/* 90-Day History Window Notice */}
      <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-muted/40 px-3.5 py-2.5 text-xs text-muted-foreground">
        <Info className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
        <span>
          {isDefaultRange
            ? t("historyNoticeDefault")
            : t("historyNoticeCustom")}
        </span>
      </div>

      {/* Filter and Date Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-xs">
        {/* Read Filter Tabs */}
        <div className="flex items-center gap-1">
          <Filter
            className="h-4 w-4 text-muted-foreground mr-1"
            aria-hidden="true"
          />
          {(["all", "unread", "read"] as const).map((filter) => {
            const isActive = currentReadFilter === filter;
            return (
              <Button
                key={filter}
                type="button"
                variant={isActive ? "default" : "outline"}
                size="sm"
                disabled={isPending}
                onClick={() => handleReadFilter(filter)}
                className="h-8 text-xs font-medium min-h-[36px] sm:min-h-[32px]"
              >
                {t(`filters.${filter}`)}
              </Button>
            );
          })}
        </div>

        {/* Date Range Presets */}
        <div className="flex items-center gap-1.5">
          <Calendar
            className="h-4 w-4 text-muted-foreground mr-1"
            aria-hidden="true"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePresetLast90Days}
            disabled={isPending}
            className="h-8 text-xs font-medium min-h-[36px] sm:min-h-[32px]"
          >
            {t("filters.presetLast90")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePresetPrevious90Days}
            disabled={isPending}
            className="h-8 text-xs font-medium min-h-[36px] sm:min-h-[32px]"
          >
            {t("filters.presetPrevious90")}
          </Button>
        </div>

        {isPending && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground animate-pulse ml-auto">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            <span>{t("filters.filtering")}</span>
          </div>
        )}
      </div>
    </div>
  );
}
