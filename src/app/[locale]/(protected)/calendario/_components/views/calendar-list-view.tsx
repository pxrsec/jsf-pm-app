"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { Pencil, Trash2 } from "lucide-react";
import {
  CALENDAR_COLOR_CLASSES,
  getCalendarEventKey,
  resolveCalendarEventDestination,
  type CalendarEventDto,
} from "@/lib/calendar/types";
import { formatCalendarDate } from "@/lib/calendar/date-utils";
import type { CalendarViewProps } from "../types";
import { CalendarEmptyState } from "../calendar-empty-state";
import { Button } from "@/components/ui/button";

export function CalendarListView({
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

  const getSafeProjectLink = (event: CalendarEventDto): string | null => {
    if (!event.project_id) return null;
    if (userRole === "admin") {
      return `/admin/proyectos/${event.project_id}`;
    }
    if (userRole === "pm") {
      return `/pm/proyectos/${event.project_id}`;
    }
    if (userRole === "client") {
      return `/cliente/proyectos/${event.project_id}`;
    }
    return null;
  };

  if (events.length === 0) {
    return <CalendarEmptyState hasFilter={Boolean(currentRange.projectId)} />;
  }

  return (
    <div
      className="overflow-x-auto rounded-lg border border-border bg-card shadow-xs"
      aria-label={t("aria.list")}
    >
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-muted/40 text-xs font-semibold text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3">
              {t("table.date")}
            </th>
            <th scope="col" className="px-4 py-3">
              {t("table.time")}
            </th>
            <th scope="col" className="px-4 py-3">
              {t("table.event")}
            </th>
            <th scope="col" className="px-4 py-3">
              {t("table.project")}
            </th>
            <th scope="col" className="px-4 py-3">
              {t("table.type")}
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              {t("table.actions")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {events.map((event) => {
            const isMilestone = event.event_type === "milestone";
            const showActions = canManageMilestones && isMilestone;
            const destination = resolveCalendarEventDestination(
              event,
              userRole,
            );
            const projectHref =
              "href" in destination
                ? destination.href
                : getSafeProjectLink(event);

            const colorStyles = event.color_override
              ? CALENDAR_COLOR_CLASSES[event.color_override]
              : {
                  badge: "bg-muted text-foreground",
                  dot: "bg-primary",
                };

            return (
              <tr
                key={getCalendarEventKey(event)}
                className="hover:bg-muted/20 transition-colors"
              >
                {/* Date */}
                <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                  {formatCalendarDate(event.starts_at, locale, {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </td>

                {/* Time / All day */}
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {event.is_all_day
                    ? t("table.allDay")
                    : formatCalendarDate(event.starts_at, locale, {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })}
                </td>

                {/* Event Title */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${colorStyles.dot}`}
                      aria-hidden="true"
                    />
                    {destination.kind === "milestone-detail" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          onOpenMilestoneDetail?.(destination.milestoneId)
                        }
                        className="h-auto px-0 font-semibold hover:bg-transparent hover:underline"
                      >
                        {event.title}
                      </Button>
                    ) : (
                      <span className="font-semibold text-foreground">
                        {event.title}
                      </span>
                    )}
                  </div>
                </td>

                {/* Project Name (Safe display, no UUID label) */}
                <td className="px-4 py-3 text-muted-foreground">
                  {event.project_name ? (
                    projectHref ? (
                      <Link
                        href={projectHref}
                        className="font-medium text-foreground hover:underline focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {event.project_name}
                      </Link>
                    ) : (
                      <span>{event.project_name}</span>
                    )
                  ) : (
                    <span className="text-muted-foreground/60 italic">—</span>
                  )}
                </td>

                {/* Event Type Badge */}
                <td className="whitespace-nowrap px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${colorStyles.badge}`}
                  >
                    {t(`eventTypes.${event.event_type}`)}
                  </span>
                </td>

                {/* Actions */}
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  {showActions ? (
                    <div className="flex items-center justify-end gap-1">
                      {onEditMilestone && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditMilestone(event.entity_id)}
                          className="h-11 w-11 p-0 min-h-[44px] min-w-[44px]"
                          aria-label={`${t("actions.editMilestone")}: ${event.title}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {onDeleteMilestone && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            onDeleteMilestone(event.entity_id, event.title)
                          }
                          className="h-11 w-11 p-0 min-h-[44px] min-w-[44px] text-destructive hover:text-destructive"
                          aria-label={`${t("actions.deleteMilestone")}: ${event.title}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground/40 text-xs">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
