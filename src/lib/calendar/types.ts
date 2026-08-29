import type { AppRole } from "@/lib/auth/routes";
import type { Database } from "@/lib/database.types";

export type CalendarEventType =
  Database["public"]["Enums"]["calendar_event_type"];
export type CalendarColorOverride =
  "chart-1" | "chart-2" | "chart-3" | "chart-4" | "chart-5";
export type MilestoneScope = "project" | "company";
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
  milestone_scope?: MilestoneScope;
}

export interface MilestoneManagementTargetDto {
  projectId: string;
  projectName: string;
  taskId: string;
  taskTitle: string;
  taskStatus: string;
}

export interface MilestoneOptionDto {
  milestoneId: string;
  title: string;
  scope: MilestoneScope;
  targetDate: string;
}

export interface MilestoneSummaryDto {
  milestoneId: string;
  title: string;
  scope: MilestoneScope;
  targetDate: string;
  colorOverride: CalendarColorOverride | null;
  activeTaskCount: number;
  completedTaskCount: number;
  inProgressTaskCount: number;
  inReviewTaskCount: number;
  blockedTaskCount: number;
}

export interface MilestoneTaskDto {
  taskId: string;
  projectId: string;
  projectName: string;
  title: string;
  status: string;
  priority: string;
  deadlineAt: string | null;
}

export interface MilestoneDetailDto extends MilestoneSummaryDto {
  description: string | null;
  projectId: string | null;
  projectName: string | null;
  tasks: MilestoneTaskDto[];
}

export const CALENDAR_COLOR_CLASSES: Record<
  CalendarColorOverride,
  { badge: string; border: string; bg: string; text: string; dot: string }
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
};

export function isCalendarColorOverride(
  value: unknown,
): value is CalendarColorOverride {
  return (
    typeof value === "string" &&
    ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"].includes(value)
  );
}

const count = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
const scope = (value: unknown): MilestoneScope | null =>
  value === "project" || value === "company" ? value : null;

export function normalizeCalendarEventDto(
  row: Database["public"]["Functions"]["list_role_safe_calendar_events"]["Returns"][number],
): CalendarEventDto {
  const isMilestone = row.event_type === "milestone";
  return {
    entity_id: row.entity_id,
    project_id: row.project_id ?? null,
    project_name: row.project_name ?? null,
    task_id: row.task_id ?? null,
    title: row.title,
    event_type: row.event_type,
    starts_at: row.starts_at,
    ends_at: row.ends_at ?? null,
    is_all_day: Boolean(row.is_all_day),
    color_override: isCalendarColorOverride(row.color_override)
      ? row.color_override
      : null,
    milestone_scope: isMilestone
      ? row.project_id
        ? "project"
        : "company"
      : undefined,
  };
}

export function normalizeMilestoneSummary(
  row: Database["public"]["Functions"]["list_project_milestone_summaries"]["Returns"][number],
): MilestoneSummaryDto | null {
  const rowScope = scope(row.scope);
  if (!rowScope) return null;
  return {
    milestoneId: row.milestone_id,
    title: row.title,
    scope: rowScope,
    targetDate: row.target_date,
    colorOverride: isCalendarColorOverride(row.color_override)
      ? row.color_override
      : null,
    activeTaskCount: count(row.active_task_count),
    completedTaskCount: count(row.completed_task_count),
    inProgressTaskCount: count(row.in_progress_task_count),
    inReviewTaskCount: count(row.in_review_task_count),
    blockedTaskCount: count(row.blocked_task_count),
  };
}

export type CalendarEventDestination =
  | { kind: "milestone-detail"; milestoneId: string }
  | {
      kind:
        | "project-overview"
        | "project-tasks"
        | "project-deliverables"
        | "operator-task";
      href: string;
    }
  | { kind: "none" };

export function resolveCalendarEventDestination(
  event: CalendarEventDto,
  role: AppRole,
): CalendarEventDestination {
  if (event.event_type === "milestone")
    return role === "admin" || role === "pm"
      ? { kind: "milestone-detail", milestoneId: event.entity_id }
      : { kind: "none" };
  if (role === "operator")
    return event.task_id
      ? { kind: "operator-task", href: `/operador/tareas/${event.task_id}` }
      : { kind: "none" };
  if (!event.project_id) return { kind: "none" };
  const base =
    role === "admin"
      ? "/admin/proyectos"
      : role === "pm"
        ? "/pm/proyectos"
        : role === "client"
          ? "/cliente/proyectos"
          : null;
  if (!base) return { kind: "none" };
  if (role === "client")
    return { kind: "project-overview", href: `${base}/${event.project_id}` };
  const tab =
    event.event_type === "task_deadline"
      ? "tasks"
      : event.event_type === "internal_review_deadline" ||
          event.event_type === "client_delivery_deadline"
        ? "deliverables"
        : null;
  return tab
    ? {
        kind: tab === "tasks" ? "project-tasks" : "project-deliverables",
        href: `${base}/${event.project_id}?tab=${tab}`,
      }
    : { kind: "project-overview", href: `${base}/${event.project_id}` };
}

export const getCalendarEventKey = (event: CalendarEventDto) =>
  `${event.event_type}-${event.entity_id}-${event.starts_at}`;
