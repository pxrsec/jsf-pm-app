"use client";

import { useMemo } from "react";
import { useLocale } from "next-intl";
import { TZDate } from "@date-fns/tz";
import {
  CALENDAR_TIME_ZONE,
  groupEventsByDate,
  formatCalendarDate,
} from "@/lib/calendar/date-utils";
import type { CalendarViewProps } from "../types";
import { getCalendarEventKey } from "@/lib/calendar/types";
import { EventBadge } from "../event-badge";
import { CalendarEmptyState } from "../calendar-empty-state";

export function CalendarWeekView({
  events,
  currentRange,
  canManageMilestones,
  userRole,
  onEditMilestone,
  onDeleteMilestone,
}: CalendarViewProps) {
  const locale = useLocale();
  const eventsByDate = useMemo(() => groupEventsByDate(events), [events]);

  const weekDays = useMemo(() => {
    const fromDate = new Date(currentRange.from);
    const startOfWeek = new TZDate(fromDate, CALENDAR_TIME_ZONE);

    const padZero = (n: number) => String(n).padStart(2, "0");
    const today = new TZDate(new Date(), CALENDAR_TIME_ZONE);
    const todayKey = `${today.getFullYear()}-${padZero(today.getMonth() + 1)}-${padZero(today.getDate())}`;

    const days = [];
    for (let i = 0; i < 7; i++) {
      const currentDay = new TZDate(
        startOfWeek.getTime() + i * 86400000,
        CALENDAR_TIME_ZONE,
      );
      const year = currentDay.getFullYear();
      const month = currentDay.getMonth();
      const date = currentDay.getDate();
      const dateKey = `${year}-${padZero(month + 1)}-${padZero(date)}`;

      const dayName = formatCalendarDate(currentDay, locale, {
        weekday: "short",
      }).toUpperCase();
      const dayEvents = eventsByDate.get(dateKey) ?? [];
      const isToday = dateKey === todayKey;

      days.push({
        dateKey,
        dayNumber: date,
        dayName,
        isToday,
        events: dayEvents,
      });
    }

    return days;
  }, [currentRange.from, eventsByDate, locale]);

  if (events.length === 0) {
    return <CalendarEmptyState hasFilter={Boolean(currentRange.projectId)} />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-xs">
      <div className="grid min-w-[700px] grid-cols-7 divide-x divide-border">
        {weekDays.map((day) => (
          <div
            key={day.dateKey}
            className={`flex flex-col min-h-[350px] p-2 sm:p-3 ${
              day.isToday ? "bg-primary/5" : "bg-card"
            }`}
          >
            {/* Column Header */}
            <div className="flex flex-col items-center border-b border-border pb-2.5 text-center">
              <span className="text-[11px] font-semibold text-muted-foreground">
                {day.dayName}
              </span>
              <span
                className={`mt-1 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                  day.isToday
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground"
                }`}
              >
                {day.dayNumber}
              </span>
            </div>

            {/* Events Container */}
            <div className="mt-2.5 flex-1 space-y-2 overflow-y-auto max-h-[450px]">
              {day.events.length === 0 ? (
                <div className="flex h-16 items-center justify-center text-xs text-muted-foreground/60 italic">
                  —
                </div>
              ) : (
                day.events.map((event) => (
                  <EventBadge
                    key={getCalendarEventKey(event)}
                    event={event}
                    canManageMilestones={canManageMilestones}
                    userRole={userRole}
                    compact
                    onEdit={onEditMilestone}
                    onDelete={onDeleteMilestone}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
