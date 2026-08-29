import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { logger } from "@/lib/logger";
import { CalendarFeedParamsSchema, MilestoneIdValueSchema } from "./schemas";
import {
  isCalendarColorOverride,
  normalizeCalendarEventDto,
  normalizeMilestoneSummary,
  type CalendarEventDto,
  type MilestoneDetailDto,
  type MilestoneManagementTargetDto,
  type MilestoneOptionDto,
  type MilestoneSummaryDto,
  type MilestoneTaskDto,
} from "./types";

type Client = SupabaseClient<Database>;

export async function fetchCalendarFeed(
  supabase: Client,
  params: { from: string; to: string; projectId?: string | null },
): Promise<CalendarEventDto[]> {
  const parsed = CalendarFeedParamsSchema.safeParse({
    ...params,
    projectId: params.projectId ?? undefined,
  });
  if (!parsed.success) throw new Error("Invalid calendar range parameters");
  const { data, error } = await supabase.rpc("list_role_safe_calendar_events", {
    p_from: parsed.data.from,
    p_to: parsed.data.to,
    p_project_id: parsed.data.projectId,
  });
  if (error) {
    logger.debug("calendar-feed-rpc-failed");
    throw new Error("Failed to fetch calendar feed");
  }
  return (data ?? []).map(normalizeCalendarEventDto);
}

export async function fetchMilestoneManagementTargets(
  supabase: Client,
): Promise<MilestoneManagementTargetDto[]> {
  const { data, error } = await supabase.rpc(
    "list_milestone_management_targets",
  );
  if (error) {
    logger.debug("milestone-management-targets-rpc-failed");
    return [];
  }
  return (data ?? []).map((row) => ({
    projectId: row.project_id,
    projectName: row.project_name,
    taskId: row.task_id,
    taskTitle: row.task_title,
    taskStatus: row.task_status,
  }));
}

export async function fetchTaskMilestoneOptions(
  supabase: Client,
  projectId: string,
): Promise<MilestoneOptionDto[]> {
  if (!MilestoneIdValueSchema.safeParse(projectId).success) return [];
  const { data, error } = await supabase.rpc("list_task_milestone_options", {
    p_project_id: projectId,
  });
  if (error) return [];
  return (data ?? []).flatMap((row) =>
    row.scope === "project" || row.scope === "company"
      ? [
          {
            milestoneId: row.milestone_id,
            title: row.title,
            scope: row.scope,
            targetDate: row.target_date,
          },
        ]
      : [],
  );
}

export async function fetchProjectMilestoneSummaries(
  supabase: Client,
  projectId: string,
): Promise<MilestoneSummaryDto[]> {
  if (!MilestoneIdValueSchema.safeParse(projectId).success) return [];
  const { data, error } = await supabase.rpc(
    "list_project_milestone_summaries",
    { p_project_id: projectId },
  );
  if (error) return [];
  return (data ?? []).flatMap((row) => {
    const summary = normalizeMilestoneSummary(row);
    return summary ? [summary] : [];
  });
}

export async function fetchMilestoneDetail(
  supabase: Client,
  milestoneId: string,
): Promise<MilestoneDetailDto | null> {
  if (!MilestoneIdValueSchema.safeParse(milestoneId).success) return null;
  const [
    { data: detailRows, error: detailError },
    { data: taskRows, error: taskError },
  ] = await Promise.all([
    supabase.rpc("get_milestone_detail", { p_milestone_id: milestoneId }),
    supabase.rpc("list_milestone_tasks", { p_milestone_id: milestoneId }),
  ]);
  const row = detailRows?.[0];
  if (
    detailError ||
    taskError ||
    !row ||
    (row.scope !== "project" && row.scope !== "company")
  )
    return null;
  const tasks: MilestoneTaskDto[] = (taskRows ?? []).map((task) => ({
    taskId: task.task_id,
    projectId: task.project_id,
    projectName: task.project_name,
    title: task.title,
    status: task.status,
    priority: task.priority,
    deadlineAt: task.deadline_at ?? null,
  }));
  return {
    milestoneId: row.milestone_id,
    title: row.title,
    scope: row.scope,
    targetDate: row.target_date,
    description: row.description ?? null,
    projectId: row.project_id ?? null,
    projectName: row.project_name ?? null,
    colorOverride: isCalendarColorOverride(row.color_override)
      ? row.color_override
      : null,
    activeTaskCount: row.active_task_count,
    completedTaskCount: row.completed_task_count,
    inProgressTaskCount: row.in_progress_task_count,
    inReviewTaskCount: row.in_review_task_count,
    blockedTaskCount: row.blocked_task_count,
    tasks,
  };
}
