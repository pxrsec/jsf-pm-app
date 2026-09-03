"use client";

import { useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { TZDate } from "@date-fns/tz";
import {
  CALENDAR_TIME_ZONE,
  groupEventsByDate,
  formatCalendarDate,
} from "@/lib/calendar/date-utils";
import { Link } from "@/i18n/routing";
import type { CalendarViewProps } from "../types";
import {
  getCalendarEventKey,
  resolveCalendarEventDestination,
  type CalendarEventDto,
} from "@/lib/calendar/types";
import { EventBadge, getCalendarEventEmoji } from "../event-badge";
import { CalendarEmptyState } from "../calendar-empty-state";

type MonthDayCell =
  | { isPadding: true; key: string }
  | {
      isPadding: false;
      dayNumber: number;
      dateKey: string;
      isToday: boolean;
      events: CalendarEventDto[];
    };

export function CalendarMonthView({
  events,
  currentRange,
  canManageMilestones,
  userRole,
  onEditMilestone,
  onDeleteMilestone,
  onOpenMilestoneDetail,
}: CalendarViewProps) {
  const t = useTranslations("calendar");
  const locale = useLocale();

  const eventsByDate = useMemo(() => groupEventsByDate(events), [events]);

  const monthGrid = useMemo(() => {
    const fromDate = new Date(currentRange.from);
    const tzRef = new TZDate(fromDate, CALENDAR_TIME_ZONE);
    const year = tzRef.getFullYear();
    const month = tzRef.getMonth();

    const firstDayOfMonth = new TZDate(
      year,
      month,
      1,
      0,
      0,
      0,
      0,
      CALENDAR_TIME_ZONE,
    );
    const lastDayOfMonth = new TZDate(
      year,
      month + 1,
      0,
      0,
      0,
      0,
      0,
      CALENDAR_TIME_ZONE,
    );

    const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday
    const totalDaysInMonth = lastDayOfMonth.getDate();

    const padZero = (n: number) => String(n).padStart(2, "0");
    const today = new TZDate(new Date(), CALENDAR_TIME_ZONE);
    const todayKey = `${today.getFullYear()}-${padZero(today.getMonth() + 1)}-${padZero(today.getDate())}`;

    const days: MonthDayCell[] = [];

    // Pre-month empty padding days
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push({ isPadding: true, key: `pad-pre-${i}` });
    }

    // Month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const dateKey = `${year}-${padZero(month + 1)}-${padZero(d)}`;
      const dayEvents = eventsByDate.get(dateKey) ?? [];
      const isToday = dateKey === todayKey;

      days.push({
        isPadding: false,
        dayNumber: d,
        dateKey,
        isToday,
        events: dayEvents,
      });
    }

    // Post-month padding to complete grid
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 0; i < remaining; i++) {
        days.push({ isPadding: true, key: `pad-post-${i}` });
      }
    }

    return days;
  }, [currentRange.from, eventsByDate]);

  const weekDayHeaders = useMemo(() => {
    // Generate Sunday through Saturday localized weekday headers
    const sampleSunday = new TZDate(2026, 7, 2, 0, 0, 0, 0, CALENDAR_TIME_ZONE); // Aug 2, 2026 is Sunday
    const headers = [];
    for (let i = 0; i < 7; i++) {
      const day = new TZDate(
        sampleSunday.getTime() + i * 86400000,
        CALENDAR_TIME_ZONE,
      );
      headers.push(
        formatCalendarDate(day, locale, { weekday: "short" }).toUpperCase(),
      );
    }
    return headers;
  }, [locale]);

  if (
    events.length === 0 &&
    monthGrid.every((d) => d.isPadding || d.events?.length === 0)
  ) {
    return <CalendarEmptyState hasFilter={Boolean(currentRange.projectId)} />;
  }

  return (
    <div
      className="overflow-hidden rounded-lg border border-border bg-card shadow-xs"
      aria-label={t("aria.grid")}
    >
      {/* Weekday Header Row */}
      <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-xs font-semibold text-muted-foreground">
        {weekDayHeaders.map((header, idx) => (
          <div key={idx} className="py-2.5">
            {header}
          </div>
        ))}
      </div>

      {/* Month Days Grid */}
      <div className="grid grid-cols-7 divide-x divide-y divide-border">
        {monthGrid.map((day) => {
          if (day.isPadding) {
            return (
              <div
                key={day.key}
                className="min-h-[58px] sm:min-h-[120px] bg-muted/10 p-1 sm:p-2"
                aria-hidden="true"
              />
            );
          }

          return (
            <div
              key={day.dateKey}
              className={`min-h-[58px] sm:min-h-[120px] p-1 sm:p-2 transition-colors flex flex-col justify-between ${
                day.isToday ? "bg-primary/5" : "bg-card hover:bg-muted/10"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full text-[11px] sm:text-xs font-semibold ${
                    day.isToday
                      ? "bg-primary text-primary-foreground font-bold"
                      : "text-foreground"
                  }`}
                >
                  {day.dayNumber}
                </span>
                {day.events.length > 0 && (
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {day.events.length}
                  </span>
                )}
              </div>

              {/* Mobile View (< sm): Clickable emoji indicators */}
              <div className="sm:hidden mt-0.5 flex flex-wrap gap-0.5 items-center justify-center">
                {day.events.slice(0, 3).map((event) => {
                  const destination = resolveCalendarEventDestination(
                    event,
                    userRole,
                  );
                  const projectHref =
                    "href" in destination ? destination.href : null;
                  const emoji = getCalendarEventEmoji(event.event_type);

                  if (destination.kind === "milestone-detail") {
                    return (
                      <button
                        key={getCalendarEventKey(event)}
                        type="button"
                        onClick={() =>
                          onOpenMilestoneDetail?.(destination.milestoneId)
                        }
                        className="inline-flex size-5 items-center justify-center rounded text-[11px] hover:bg-muted/50 active:scale-95 transition-transform"
                        title={`${emoji} ${event.title}`}
                        aria-label={`${emoji} ${event.title}`}
                      >
                        {emoji}
                      </button>
                    );
                  }

                  if (projectHref) {
                    return (
                      <Link
                        key={getCalendarEventKey(event)}
                        href={projectHref}
                        className="inline-flex size-5 items-center justify-center rounded text-[11px] hover:bg-muted/50 active:scale-95 transition-transform"
                        title={`${emoji} ${event.title}`}
                        aria-label={`${emoji} ${event.title}`}
                      >
                        {emoji}
                      </Link>
                    );
                  }

                  return (
                    <span
                      key={getCalendarEventKey(event)}
                      className="inline-flex size-5 items-center justify-center text-[11px]"
                      title={`${emoji} ${event.title}`}
                    >
                      {emoji}
                    </span>
                  );
                })}
                {day.events.length > 3 && (
                  <span className="text-[9px] font-semibold text-muted-foreground">
                    +{day.events.length - 3}
                  </span>
                )}
              </div>

              {/* Desktop View (>= sm): Full compact badges */}
              <div className="hidden sm:block mt-1.5 space-y-1 overflow-y-auto max-h-[90px] pr-0.5">
                {day.events.map((event) => (
                  <EventBadge
                    key={getCalendarEventKey(event)}
                    event={event}
                    canManageMilestones={canManageMilestones}
                    userRole={userRole}
                    compact
                    onEdit={onEditMilestone}
                    onDelete={onDeleteMilestone}
                    onOpenMilestoneDetail={onOpenMilestoneDetail}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
