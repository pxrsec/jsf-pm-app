"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  CalendarCheck,
  Clock,
  Flag,
} from "lucide-react";
import type { AppRole } from "@/lib/auth/routes";
import {
  CALENDAR_COLOR_CLASSES,
  type CalendarEventDto,
} from "@/lib/calendar/types";
import { formatCalendarDate } from "@/lib/calendar/date-utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface EventBadgeProps {
  event: CalendarEventDto;
  canManageMilestones: boolean;
  userRole: AppRole;
  compact?: boolean;
  onEdit?: (eventId: string) => void;
  onDelete?: (eventId: string, title: string) => void;
}

export function EventBadge({
  event,
  canManageMilestones,
  userRole,
  compact = false,
  onEdit,
  onDelete,
}: EventBadgeProps) {
  const t = useTranslations("calendar");
  const locale = useLocale();

  const colorStyles = event.color_override
    ? CALENDAR_COLOR_CLASSES[event.color_override]
    : {
        badge: "bg-primary text-primary-foreground",
        border: "border-border",
        bg: "bg-muted/50",
        text: "text-foreground",
        dot: "bg-primary",
      };

  const getSafeProjectLink = (): string | null => {
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
    // Operator events are non-interactive text per S07-02
    return null;
  };

  const projectHref = getSafeProjectLink();
  const isMilestone = event.event_type === "milestone";
  const showManagerActions = canManageMilestones && isMilestone;

  if (compact) {
    return (
      <div
        className={`group relative flex items-center justify-between gap-1.5 rounded border px-2 py-1 text-xs transition-colors ${colorStyles.border} ${colorStyles.bg} ${colorStyles.text}`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${colorStyles.dot}`}
            aria-hidden="true"
          />
          {projectHref ? (
            <Link
              href={projectHref}
              className="truncate font-medium hover:underline focus:outline-none focus:ring-1 focus:ring-ring"
              title={event.title}
            >
              {event.title}
            </Link>
          ) : (
            <span className="truncate font-medium" title={event.title}>
              {event.title}
            </span>
          )}
        </div>

        {showManagerActions && (
          <div className="shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger
                className="h-11 w-11 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-md p-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-opacity"
                aria-label={`${t("actions.editMilestone")}: ${event.title}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                {onEdit && (
                  <DropdownMenuItem onClick={() => onEdit(event.entity_id)}>
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    <span>{t("actions.editMilestone")}</span>
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem
                    onClick={() => onDelete(event.entity_id, event.title)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    <span>{t("actions.deleteMilestone")}</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    );
  }

  // Expanded card view (for week and agenda views)
  return (
    <div
      className={`group flex items-start justify-between gap-3 rounded-lg border p-3 shadow-xs transition-shadow ${colorStyles.border} ${colorStyles.bg}`}
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${colorStyles.badge}`}
          >
            {isMilestone ? (
              <Flag className="h-3 w-3" aria-hidden="true" />
            ) : (
              <CalendarCheck className="h-3 w-3" aria-hidden="true" />
            )}
            <span>{t(`eventTypes.${event.event_type}`)}</span>
          </span>

          {event.project_name && (
            <span className="text-xs font-medium text-muted-foreground">
              {event.project_name}
            </span>
          )}
        </div>

        <div className="text-sm font-semibold text-foreground">
          {projectHref ? (
            <Link
              href={projectHref}
              className="hover:underline focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {event.title}
            </Link>
          ) : (
            <span>{event.title}</span>
          )}
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            {event.is_all_day
              ? t("table.allDay")
              : formatCalendarDate(event.starts_at, locale, {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })}
          </span>
        </div>
      </div>

      {showManagerActions && (
        <div className="flex shrink-0 items-center gap-1">
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(event.entity_id)}
              className="h-11 w-11 p-0 min-h-[44px] min-w-[44px]"
              aria-label={`${t("actions.editMilestone")}: ${event.title}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(event.entity_id, event.title)}
              className="h-11 w-11 p-0 min-h-[44px] min-w-[44px] text-destructive hover:text-destructive"
              aria-label={`${t("actions.deleteMilestone")}: ${event.title}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
