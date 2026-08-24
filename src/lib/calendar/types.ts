import type { Database } from "@/lib/database.types";

export type CalendarEventType =
  Database["public"]["Enums"]["calendar_event_type"];

export type CalendarColorOverride =
  "chart-1" | "chart-2" | "chart-3" | "chart-4" | "chart-5";

export type CalendarView = "month" | "week" | "agenda" | "list";

export interface CalendarRangeState {
  view: CalendarView;
  from: string;
  to: string;
  projectId?: string;
}

export interface CalendarEventDto {
  entity_id: string;
  project_id: string | null;
  project_name: string | null;
  task_id: string | null;
  title: string;
  event_type: CalendarEventType;
  starts_at: string;
  ends_at: string | null;
  is_all_day: boolean;
  color_override: CalendarColorOverride | null;
}

export interface CalendarMilestoneTargetDto {
  project_id: string;
  project_name: string;
  task_id: string | null;
  task_title: string | null;
}

export interface CalendarMilestoneEditDetailDto {
  entity_id: string;
  project_id: string;
  project_name: string;
  task_id: string | null;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  is_all_day: boolean;
  color_override: CalendarColorOverride | null;
}

export const CALENDAR_COLOR_CLASSES: Record<
  CalendarColorOverride,
  {
    badge: string;
    border: string;
    bg: string;
    text: string;
    dot: string;
  }
> = {
  "chart-1": {
    badge: "bg-chart-1 text-primary-foreground",
    border: "border-chart-1",
    bg: "bg-chart-1/15",
    text: "text-chart-1",
    dot: "bg-chart-1",
  },
  "chart-2": {
    badge: "bg-chart-2 text-primary-foreground",
    border: "border-chart-2",
    bg: "bg-chart-2/15",
    text: "text-chart-2",
    dot: "bg-chart-2",
  },
  "chart-3": {
    badge: "bg-chart-3 text-primary-foreground",
    border: "border-chart-3",
    bg: "bg-chart-3/15",
    text: "text-chart-3",
    dot: "bg-chart-3",
  },
  "chart-4": {
    badge: "bg-chart-4 text-primary-foreground",
    border: "border-chart-4",
    bg: "bg-chart-4/15",
    text: "text-chart-4",
    dot: "bg-chart-4",
  },
  "chart-5": {
    badge: "bg-chart-5 text-primary-foreground",
    border: "border-chart-5",
    bg: "bg-chart-5/15",
    text: "text-chart-5",
    dot: "bg-chart-5",
  },
} as const;

export function isCalendarColorOverride(
  value: unknown,
): value is CalendarColorOverride {
  return (
    typeof value === "string" &&
    ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"].includes(value)
  );
}

export function normalizeCalendarEventDto(
  row: Database["public"]["Functions"]["list_role_safe_calendar_events"]["Returns"][number],
): CalendarEventDto {
  return {
    entity_id: row.entity_id,
    project_id: row.project_id ? row.project_id : null,
    project_name: row.project_name ? row.project_name : null,
    task_id: row.task_id ? row.task_id : null,
    title: row.title,
    event_type: row.event_type,
    starts_at: row.starts_at,
    ends_at: row.ends_at ? row.ends_at : null,
    is_all_day: Boolean(row.is_all_day),
    color_override: isCalendarColorOverride(row.color_override)
      ? row.color_override
      : null,
  };
}

export function normalizeMilestoneTargetDto(
  row: Database["public"]["Functions"]["list_calendar_milestone_targets"]["Returns"][number],
): CalendarMilestoneTargetDto {
  return {
    project_id: row.project_id,
    project_name: row.project_name,
    task_id: row.task_id ? row.task_id : null,
    task_title: row.task_title ? row.task_title : null,
  };
}

export function normalizeMilestoneEditDetailDto(
  row: Database["public"]["Functions"]["get_calendar_milestone_for_edit"]["Returns"][number],
): CalendarMilestoneEditDetailDto {
  return {
    entity_id: row.entity_id,
    project_id: row.project_id,
    project_name: row.project_name,
    task_id: row.task_id ? row.task_id : null,
    title: row.title,
    description: row.description ? row.description : null,
    starts_at: row.starts_at,
    ends_at: row.ends_at ? row.ends_at : null,
    is_all_day: Boolean(row.is_all_day),
    color_override: isCalendarColorOverride(row.color_override)
      ? row.color_override
      : null,
  };
}
