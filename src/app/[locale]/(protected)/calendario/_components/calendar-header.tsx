"use client";

import { useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { TZDate } from "@date-fns/tz";
import {
  CALENDAR_TIME_ZONE,
  formatCalendarDate,
} from "@/lib/calendar/date-utils";
import type {
  MilestoneManagementTargetDto,
  CalendarRangeState,
  CalendarView,
} from "@/lib/calendar/types";
import { Button } from "@/components/ui/button";

interface CalendarHeaderProps {
  currentRange: CalendarRangeState;
  canManageMilestones: boolean;
  targets: MilestoneManagementTargetDto[];
  fixedProjectId?: string;
  onViewChange: (view: CalendarView) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onProjectFilterChange?: (projectId?: string) => void;
  onCreateMilestone?: () => void;
}

export function CalendarHeader({
  currentRange,
  canManageMilestones,
  targets,
  fixedProjectId,
  onViewChange,
  onPrev,
  onNext,
  onToday,
  onProjectFilterChange,
  onCreateMilestone,
}: CalendarHeaderProps) {
  const t = useTranslations("calendar");
  const locale = useLocale();

  // Format localized heading for the current view and range
  const formattedRangeTitle = useMemo(() => {
    const fromDate = new Date(currentRange.from);
    const toDate = new Date(currentRange.to);

    const tzFrom = new TZDate(fromDate, CALENDAR_TIME_ZONE);
    // Exclusive end: subtract 1 ms to represent visible end day
    const tzToInclusive = new TZDate(
      toDate.getTime() - 1000,
      CALENDAR_TIME_ZONE,
    );

    if (currentRange.view === "month") {
      const title = formatCalendarDate(tzFrom, locale, {
        month: "long",
        year: "numeric",
      });
      return title.charAt(0).toUpperCase() + title.slice(1);
    }

    if (currentRange.view === "week") {
      const sameMonth = tzFrom.getMonth() === tzToInclusive.getMonth();
      const sameYear = tzFrom.getFullYear() === tzToInclusive.getFullYear();

      if (sameMonth && sameYear) {
        const monthName = formatCalendarDate(tzFrom, locale, {
          month: "long",
        });
        return locale.startsWith("es")
          ? `${tzFrom.getDate()} - ${tzToInclusive.getDate()} de ${monthName} de ${tzFrom.getFullYear()}`
          : `${monthName} ${tzFrom.getDate()} - ${tzToInclusive.getDate()}, ${tzFrom.getFullYear()}`;
      }

      const fromFormatted = formatCalendarDate(tzFrom, locale, {
        day: "numeric",
        month: "short",
      });
      const toFormatted = formatCalendarDate(tzToInclusive, locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      return `${fromFormatted} - ${toFormatted}`;
    }

    // Agenda / List
    const fromFormatted = formatCalendarDate(tzFrom, locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const toFormatted = formatCalendarDate(tzToInclusive, locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    return `${fromFormatted} - ${toFormatted}`;
  }, [currentRange, locale]);

  // Deduplicated unique projects for filter
  const uniqueProjects = useMemo(() => {
    const map = new Map<string, string>();
    for (const target of targets) {
      if (!map.has(target.projectId)) {
        map.set(target.projectId, target.projectName);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [targets]);

  const showProjectFilter = canManageMilestones && !fixedProjectId;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Date Navigation & Range Title */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={onPrev}
            aria-label={t("aria.prevPeriod")}
            className="h-11 w-11 p-0 min-h-[44px] min-w-[44px]"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onToday}
            aria-label={t("aria.todayButton")}
            className="min-h-[44px] px-3.5 text-sm font-semibold"
          >
            {t("nav.today")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onNext}
            aria-label={t("aria.nextPeriod")}
            className="h-11 w-11 p-0 min-h-[44px] min-w-[44px]"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <h2 className="ml-1 text-base font-bold text-foreground sm:text-lg">
          {formattedRangeTitle}
        </h2>
      </div>

      {/* Right Controls: Project Filter, View Switcher, Create Action */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Manager-only Project Filter */}
        {showProjectFilter && onProjectFilterChange && (
          <select
            value={currentRange.projectId ?? ""}
            onChange={(e) =>
              onProjectFilterChange(e.target.value ? e.target.value : undefined)
            }
            aria-label={t("scope.projectFilterLabel")}
            className="min-h-[44px] rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">{t("scope.allProjectsFilter")}</option>
            {uniqueProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}

        {/* View Switcher Toggle Buttons */}
        <div
          role="group"
          aria-label={t("aria.viewToggle")}
          className="inline-flex rounded-md border border-border bg-muted/30 p-0.5"
        >
          {(["month", "week", "agenda", "list"] as CalendarView[]).map((v) => {
            const isActive = currentRange.view === v;
            return (
              <button
                key={v}
                type="button"
                aria-pressed={isActive}
                onClick={() => onViewChange(v)}
                className={`min-h-[44px] rounded px-3.5 py-2 text-sm font-semibold transition-all ${
                  isActive
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t(`views.${v}`)}
              </button>
            );
          })}
        </div>

        {/* Manager-only New Milestone Action Button */}
        {canManageMilestones && onCreateMilestone && (
          <Button
            size="sm"
            onClick={onCreateMilestone}
            className="min-h-[44px] gap-1.5 px-3.5 text-sm font-semibold"
          >
            <Plus className="h-4 w-4" />
            <span>{t("actions.createMilestone")}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
