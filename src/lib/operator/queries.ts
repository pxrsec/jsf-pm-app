import "server-only";

import type { Database } from "@/lib/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import {
  OPERATOR_URGENCY_CATEGORIES,
  type OperatorUrgencyCategory,
  type OperatorTaskResource,
  type OperatorTaskDeliverableDetail,
  type OperatorTaskDetail,
  type OperatorDeliverableForSubmission,
  type OperatorAgendaItem,
  type OperatorOwnWorkProject,
  type OperatorOwnWorkProjectDetail,
  type AgendaSelectRow,
  type TaskDetailSelectRow,
} from "./types";

export * from "./types";

type TypedSupabase = SupabaseClient<Database>;

const AGENDA_SELECT_FIELDS =
  "task_id, task_title, task_description, task_status, task_priority, task_started_at, task_deadline_at, assigned_at, urgency_category, project_id, project_name, deliverable_id, deliverable_title, deliverable_status, deliverable_workflow_type, current_version_number, internal_review_deadline_at, client_delivery_deadline_at" as const;

const TASK_DETAIL_SELECT_FIELDS =
  "task_id, project_id, project_name, task_title, task_description, task_status, task_priority, task_deadline_at, task_started_at, assigned_at, urgency_category, task_resources, deliverable_id, deliverable_title, deliverable_status, deliverable_workflow_type, current_version_number, deliverable_specifications, submission_deadline_at, internal_review_deadline_at, client_delivery_deadline_at" as const;

const DELIVERABLE_SUBMISSION_SELECT_FIELDS =
  "task_id, project_id, deliverable_id, deliverable_title, deliverable_workflow_type, deliverable_status" as const;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const URGENCY_RANK: Record<OperatorUrgencyCategory, number> = {
  overdue: 1,
  urgent: 2,
  upcoming: 3,
  new: 4,
  normal: 5,
  completed: 6,
};

function isValidUrgencyCategory(
  value: string | null,
): value is OperatorUrgencyCategory {
  return (
    typeof value === "string" &&
    (OPERATOR_URGENCY_CATEGORIES as readonly string[]).includes(value)
  );
}

const compareDatesAsc = (a: string | null, b: string | null): number =>
  !a && !b
    ? 0
    : !a
      ? 1
      : !b
        ? -1
        : new Date(a).getTime() - new Date(b).getTime();

const compareDatesDesc = (a: string | null, b: string | null): number =>
  !a && !b
    ? 0
    : !a
      ? 1
      : !b
        ? -1
        : new Date(b).getTime() - new Date(a).getTime();

export function sortAgendaItems(
  items: OperatorAgendaItem[],
): OperatorAgendaItem[] {
  return [...items].sort((a, b) => {
    const rankDiff =
      URGENCY_RANK[a.urgencyCategory] - URGENCY_RANK[b.urgencyCategory];
    if (rankDiff !== 0) return rankDiff;

    if (a.urgencyCategory === "new") {
      const assignedDiff = compareDatesDesc(a.assignedAt, b.assignedAt);
      if (assignedDiff !== 0) return assignedDiff;
      const deadlineDiff = compareDatesAsc(a.taskDeadlineAt, b.taskDeadlineAt);
      if (deadlineDiff !== 0) return deadlineDiff;
    } else if (a.urgencyCategory === "completed") {
      const deadlineDiff = compareDatesDesc(a.taskDeadlineAt, b.taskDeadlineAt);
      if (deadlineDiff !== 0) return deadlineDiff;
      const assignedDiff = compareDatesDesc(a.assignedAt, b.assignedAt);
      if (assignedDiff !== 0) return assignedDiff;
    } else {
      const deadlineDiff = compareDatesAsc(a.taskDeadlineAt, b.taskDeadlineAt);
      if (deadlineDiff !== 0) return deadlineDiff;
    }

    return a.taskId.localeCompare(b.taskId);
  });
}

export function mapAndDeduplicateAgendaRows(
  rows: AgendaSelectRow[],
): OperatorAgendaItem[] {
  const taskMap = new Map<string, OperatorAgendaItem>();

  for (const row of rows) {
    if (
      !row.task_id ||
      !row.task_title ||
      !row.project_id ||
      !row.project_name
    ) {
      continue;
    }
    if (!isValidUrgencyCategory(row.urgency_category)) {
      throw new Error(
        `Invalid or missing urgency_category returned from operator_agenda_view: ${row.urgency_category}`,
      );
    }

    const taskId = row.task_id;
    let item = taskMap.get(taskId);
    if (!item) {
      item = {
        taskId,
        taskTitle: row.task_title,
        taskDescription: row.task_description,
        taskStatus: row.task_status ?? "pending",
        taskPriority: row.task_priority ?? "medium",
        taskStartedAt: row.task_started_at,
        taskDeadlineAt: row.task_deadline_at,
        assignedAt: row.assigned_at,
        urgencyCategory: row.urgency_category,
        projectId: row.project_id,
        projectName: row.project_name,
        deliverables: [],
      };
      taskMap.set(taskId, item);
    }

    if (row.deliverable_id && row.deliverable_title) {
      const alreadyHas = item.deliverables.some(
        (d) => d.deliverableId === row.deliverable_id,
      );
      if (!alreadyHas) {
        item.deliverables.push({
          deliverableId: row.deliverable_id,
          deliverableTitle: row.deliverable_title,
          deliverableStatus: row.deliverable_status,
          deliverableWorkflowType: row.deliverable_workflow_type,
          currentVersionNumber: row.current_version_number,
          internalReviewDeadlineAt: row.internal_review_deadline_at,
          clientDeliveryDeadlineAt: row.client_delivery_deadline_at,
        });
      }
    }
  }

  return sortAgendaItems(Array.from(taskMap.values()));
}

export async function getOperatorAgenda(
  supabase: TypedSupabase,
): Promise<OperatorAgendaItem[]> {
  try {
    const { data, error } = await supabase
      .from("operator_agenda_view")
      .select(AGENDA_SELECT_FIELDS);

    if (error) {
      logger.error("Failed to query operator_agenda_view", { error });
      throw new Error("Failed to fetch operator agenda");
    }
    return data ? mapAndDeduplicateAgendaRows(data) : [];
  } catch (err) {
    logger.error("Error in getOperatorAgenda", { err });
    throw err;
  }
}

export async function getOperatorOwnWorkProjects(
  supabase: TypedSupabase,
): Promise<OperatorOwnWorkProject[]> {
  const agendaItems = await getOperatorAgenda(supabase);
  const projectMap = new Map<string, OperatorOwnWorkProject>();

  for (const item of agendaItems) {
    let proj = projectMap.get(item.projectId);
    if (!proj) {
      proj = {
        projectId: item.projectId,
        projectName: item.projectName,
        ownTaskCount: 0,
        activeTaskCount: 0,
        completedTaskCount: 0,
        nearestDeadline: null,
        urgencyCategories: [],
      };
      projectMap.set(item.projectId, proj);
    }

    proj.ownTaskCount += 1;
    if (item.urgencyCategory === "completed") {
      proj.completedTaskCount += 1;
    } else {
      proj.activeTaskCount += 1;
    }

    if (!proj.urgencyCategories.includes(item.urgencyCategory)) {
      proj.urgencyCategories.push(item.urgencyCategory);
    }

    if (item.taskDeadlineAt) {
      if (
        !proj.nearestDeadline ||
        new Date(item.taskDeadlineAt).getTime() <
          new Date(proj.nearestDeadline).getTime()
      ) {
        proj.nearestDeadline = item.taskDeadlineAt;
      }
    }
  }

  return Array.from(projectMap.values()).sort((a, b) =>
    a.projectName.localeCompare(b.projectName),
  );
}

export async function getOperatorOwnWorkProject(
  supabase: TypedSupabase,
  projectId: string,
): Promise<OperatorOwnWorkProjectDetail | null> {
  if (!projectId || !UUID_REGEX.test(projectId)) return null;

  try {
    const { data, error } = await supabase
      .from("operator_agenda_view")
      .select(AGENDA_SELECT_FIELDS)
      .eq("project_id", projectId);

    if (error) {
      logger.error("Failed to query operator_agenda_view by project_id", {
        error,
        projectId,
      });
      return null;
    }
    if (!data || data.length === 0) return null;
    const tasks = mapAndDeduplicateAgendaRows(data);
    if (tasks.length === 0) return null;

    return { projectId, projectName: tasks[0].projectName, tasks };
  } catch (err) {
    logger.error("Error in getOperatorOwnWorkProject", { err, projectId });
    return null;
  }
}

export function parseTaskResources(raw: unknown): OperatorTaskResource[] {
  if (!Array.isArray(raw)) return [];
  const resources: OperatorTaskResource[] = [];
  for (const item of raw) {
    if (
      item &&
      typeof item === "object" &&
      typeof (item as Record<string, unknown>).id === "string" &&
      typeof (item as Record<string, unknown>).name === "string" &&
      typeof (item as Record<string, unknown>).url === "string"
    ) {
      resources.push({
        id: (item as Record<string, unknown>).id as string,
        name: (item as Record<string, unknown>).name as string,
        url: (item as Record<string, unknown>).url as string,
        sortOrder:
          typeof (item as Record<string, unknown>).sort_order === "number"
            ? ((item as Record<string, unknown>).sort_order as number)
            : 0,
      });
    }
  }
  return resources.sort(
    (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
  );
}

export function mapTaskDetailRows(
  rows: TaskDetailSelectRow[],
): OperatorTaskDetail | null {
  if (!rows || rows.length === 0) return null;
  const first = rows[0];
  if (
    !first.task_id ||
    !first.task_title ||
    !first.project_id ||
    !first.project_name
  ) {
    return null;
  }
  if (!isValidUrgencyCategory(first.urgency_category)) {
    throw new Error(
      `Invalid or missing urgency_category returned from operator_agenda_view: ${first.urgency_category}`,
    );
  }

  const resources = parseTaskResources(first.task_resources);
  const deliverables: OperatorTaskDeliverableDetail[] = [];

  for (const row of rows) {
    if (row.deliverable_id && row.deliverable_title) {
      if (!deliverables.some((d) => d.deliverableId === row.deliverable_id)) {
        deliverables.push({
          deliverableId: row.deliverable_id,
          deliverableTitle: row.deliverable_title,
          deliverableStatus: row.deliverable_status,
          deliverableWorkflowType: row.deliverable_workflow_type,
          currentVersionNumber: row.current_version_number,
          deliverableSpecifications: row.deliverable_specifications,
          submissionDeadlineAt: row.submission_deadline_at,
          internalReviewDeadlineAt: row.internal_review_deadline_at,
          clientDeliveryDeadlineAt: row.client_delivery_deadline_at,
        });
      }
    }
  }

  return {
    taskId: first.task_id,
    taskTitle: first.task_title,
    taskDescription: first.task_description,
    taskStatus: first.task_status ?? "pending",
    taskPriority: first.task_priority ?? "medium",
    taskStartedAt: first.task_started_at,
    taskDeadlineAt: first.task_deadline_at,
    assignedAt: first.assigned_at,
    urgencyCategory: first.urgency_category,
    projectId: first.project_id,
    projectName: first.project_name,
    resources,
    deliverables,
  };
}

export async function getOperatorTaskDetail(
  supabase: TypedSupabase,
  taskId: string,
): Promise<OperatorTaskDetail | null> {
  if (!taskId || !UUID_REGEX.test(taskId)) return null;

  try {
    const { data, error } = await supabase
      .from("operator_agenda_view")
      .select(TASK_DETAIL_SELECT_FIELDS)
      .eq("task_id", taskId);

    if (error) {
      logger.error("Failed to query operator_agenda_view for task detail", {
        error,
        taskId,
      });
      return null;
    }
    if (!data || data.length === 0) return null;
    return mapTaskDetailRows(data);
  } catch (err) {
    logger.error("Error in getOperatorTaskDetail", { err, taskId });
    return null;
  }
}

export async function getOperatorDeliverableForSubmission(
  supabase: TypedSupabase,
  deliverableId: string,
): Promise<OperatorDeliverableForSubmission | null> {
  if (!deliverableId || !UUID_REGEX.test(deliverableId)) return null;

  try {
    const { data, error } = await supabase
      .from("operator_agenda_view")
      .select(DELIVERABLE_SUBMISSION_SELECT_FIELDS)
      .eq("deliverable_id", deliverableId)
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.error(
        "Failed to query operator_agenda_view for deliverable submission",
        {
          error,
          deliverableId,
        },
      );
      return null;
    }

    if (
      !data ||
      !data.task_id ||
      !data.project_id ||
      !data.deliverable_id ||
      !data.deliverable_title
    ) {
      return null;
    }

    return {
      taskId: data.task_id,
      projectId: data.project_id,
      deliverableId: data.deliverable_id,
      deliverableTitle: data.deliverable_title,
      deliverableWorkflowType: data.deliverable_workflow_type,
      deliverableStatus: data.deliverable_status,
    };
  } catch (err) {
    logger.error("Error in getOperatorDeliverableForSubmission", {
      err,
      deliverableId,
    });
    return null;
  }
}
