"use client";

import { useMemo } from "react";
import { TZDate } from "@date-fns/tz";
import {
  CALENDAR_TIME_ZONE,
  groupEventsByDate,
  formatCalendarDate,
} from "@/lib/calendar/date-utils";
import type { CalendarViewProps } from "../types";
import { EventBadge } from "../event-badge";
import { CalendarEmptyState } from "../calendar-empty-state";

export function CalendarAgendaView({
  events,
  currentRange,
  canManageMilestones,
  userRole,
  onEditMilestone,
  onDeleteMilestone,
}: CalendarViewProps) {
  const eventsByDate = useMemo(() => groupEventsByDate(events), [events]);

  const dateGroups = useMemo(() => {
    return Array.from(eventsByDate.entries()).map(([dateKey, dayEvents]) => {
      const [yearStr, monthStr, dayStr] = dateKey.split("-");
      const sampleDate = new TZDate(
        parseInt(yearStr, 10),
        parseInt(monthStr, 10) - 1,
        parseInt(dayStr, 10),
        12,
        0,
        0,
        0,
        CALENDAR_TIME_ZONE,
      );

      const formattedDate = formatCalendarDate(sampleDate, "es-MX", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      return {
        dateKey,
        formattedDate:
          formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1),
        events: dayEvents,
      };
    });
  }, [eventsByDate]);

  if (dateGroups.length === 0) {
    return <CalendarEmptyState hasFilter={Boolean(currentRange.projectId)} />;
  }

  return (
    <div className="space-y-6">
      {dateGroups.map((group) => (
        <div
          key={group.dateKey}
          className="rounded-lg border border-border bg-card p-4 shadow-xs"
        >
          <div className="border-b border-border pb-2 mb-3">
            <h2 className="text-sm font-bold text-foreground">
              {group.formattedDate}
            </h2>
          </div>

          <div className="space-y-2.5">
            {group.events.map((event) => (
              <EventBadge
                key={event.entity_id}
                event={event}
                canManageMilestones={canManageMilestones}
                userRole={userRole}
                compact={false}
                onEdit={onEditMilestone}
                onDelete={onDeleteMilestone}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
