"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter, usePathname } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Filter, Loader2 } from "lucide-react";
import {
  CALENDAR_TIME_ZONE,
  convertLocalDateToMexicoCityRange,
  formatIsoWithOffset,
  getDefaultMetricsRange,
} from "@/lib/operations-metrics/date-utils";
import { TZDate } from "@date-fns/tz";

interface MetricsFilterBarProps {
  currentFrom: string;
  currentTo: string;
  currentProjectId?: string;
  projects?: readonly { id: string; name: string }[];
  role: "admin" | "pm";
}

export function MetricsFilterBar({
  currentFrom,
  currentTo,
  currentProjectId,
  projects,
  role,
}: MetricsFilterBarProps) {
  const t = useTranslations("metrics.filters");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Extract initial YYYY-MM-DD from offset-bearing ISO strings for the inputs
  const extractDateOnly = (isoStr: string): string => {
    try {
      const tz = new TZDate(isoStr, CALENDAR_TIME_ZONE);
      const y = tz.getFullYear();
      const m = String(tz.getMonth() + 1).padStart(2, "0");
      const d = String(tz.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    } catch {
      return "";
    }
  };

  const [startDate, setStartDate] = useState(() =>
    extractDateOnly(currentFrom),
  );
  const [endDate, setEndDate] = useState(() => {
    // Upper bound is exclusive next-day; subtract 1 day to show inclusive end date
    try {
      const tz = new TZDate(currentTo, CALENDAR_TIME_ZONE);
      const prevDay = new TZDate(
        tz.getTime() - 24 * 60 * 60 * 1000,
        CALENDAR_TIME_ZONE,
      );
      const y = prevDay.getFullYear();
      const m = String(prevDay.getMonth() + 1).padStart(2, "0");
      const d = String(prevDay.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    } catch {
      return "";
    }
  });

  const [dateError, setDateError] = useState<string | null>(null);

  const updateFilters = useCallback(
    (updates: { from?: string; to?: string; projectId?: string }) => {
      const params = new URLSearchParams(searchParams.toString());

      if (updates.from !== undefined) {
        params.set("from", updates.from);
      }
      if (updates.to !== undefined) {
        params.set("to", updates.to);
      }
      if (updates.projectId !== undefined) {
        params.set("projectId", updates.projectId);
      }

      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [searchParams, router, pathname],
  );

  const handlePreset30Days = () => {
    setDateError(null);
    const nowTz = new TZDate(new Date(), CALENDAR_TIME_ZONE);
    const fromTz = new TZDate(
      nowTz.getTime() - 30 * 24 * 60 * 60 * 1000,
      CALENDAR_TIME_ZONE,
    );
    const from = formatIsoWithOffset(fromTz);
    const to = formatIsoWithOffset(nowTz);
    setStartDate(extractDateOnly(from));
    setEndDate(extractDateOnly(to));
    updateFilters({ from, to });
  };

  const handlePreset90Days = () => {
    setDateError(null);
    const range = getDefaultMetricsRange();
    setStartDate(extractDateOnly(range.from));
    setEndDate(extractDateOnly(range.to));
    updateFilters({ from: range.from, to: range.to });
  };

  const handleApplyCustomDates = () => {
    setDateError(null);
    if (!startDate || !endDate) {
      setDateError(t("errorIncompleteDates"));
      return;
    }

    const converted = convertLocalDateToMexicoCityRange(startDate, endDate);
    if (!converted) {
      setDateError(t("errorInvalidRange"));
      return;
    }

    updateFilters({ from: converted.from, to: converted.to });
  };

  const handleProjectChange = (val: string | null) => {
    if (!val) return;
    updateFilters({ projectId: val });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left side: Range Presets and PM Project Selector */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5" aria-hidden="true" />
            {t("rangeLabel")}:
          </span>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePreset30Days}
            disabled={isPending}
            className="min-h-[44px] sm:min-h-[36px] text-xs"
          >
            {t("preset30Days")}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePreset90Days}
            disabled={isPending}
            className="min-h-[44px] sm:min-h-[36px] text-xs"
          >
            {t("preset90Days")}
          </Button>

          {role === "pm" && projects && projects.length > 0 && (
            <div className="flex items-center gap-2 ml-0 sm:ml-2">
              <label
                htmlFor="pm-project-select"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {t("projectLabel")}:
              </label>
              <Select
                value={currentProjectId ?? projects[0]?.id}
                onValueChange={handleProjectChange}
                disabled={isPending}
              >
                <SelectTrigger
                  id="pm-project-select"
                  aria-label={t("projectSelectAria")}
                  className="w-[200px] sm:w-[240px] min-h-[44px] sm:min-h-[36px] text-xs"
                >
                  <SelectValue placeholder={t("selectProjectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Right side: Loading Indicator */}
        {isPending && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            <span>{t("updating")}</span>
          </div>
        )}
      </div>

      {/* Custom Date Range Row */}
      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/50 text-xs">
        <span className="font-medium text-muted-foreground flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
          {t("customRangeLabel")}:
        </span>

        <div className="flex items-center gap-2">
          <label htmlFor="custom-start-date" className="sr-only">
            {t("startDateAria")}
          </label>
          <input
            id="custom-start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={isPending}
            className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring min-h-[44px] sm:min-h-[32px]"
          />

          <span className="text-muted-foreground">-</span>

          <label htmlFor="custom-end-date" className="sr-only">
            {t("endDateAria")}
          </label>
          <input
            id="custom-end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={isPending}
            className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring min-h-[44px] sm:min-h-[32px]"
          />

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleApplyCustomDates}
            disabled={isPending}
            className="min-h-[44px] sm:min-h-[32px] text-xs font-medium px-3"
          >
            {t("applyCustomDates")}
          </Button>
        </div>

        {dateError && (
          <p role="alert" className="text-xs text-destructive font-medium ml-2">
            {dateError}
          </p>
        )}
      </div>
    </div>
  );
}
