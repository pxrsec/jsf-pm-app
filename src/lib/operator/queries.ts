import "server-only";

import type { Database } from "@/lib/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

type TypedSupabase = SupabaseClient<Database>;

export const OPERATOR_URGENCY_CATEGORIES = [
  "new",
  "normal",
  "upcoming",
  "urgent",
  "overdue",
  "completed",
] as const;

export type OperatorUrgencyCategory =
  (typeof OPERATOR_URGENCY_CATEGORIES)[number];

export interface OperatorDeliverableSummary {
  deliverableId: string;
  deliverableTitle: string;
  deliverableStatus: Database["public"]["Enums"]["deliverable_status"] | null;
  deliverableWorkflowType:
    Database["public"]["Enums"]["deliverable_workflow_type"] | null;
  currentVersionNumber: number | null;
  internalReviewDeadlineAt: string | null;
  clientDeliveryDeadlineAt: string | null;
}

export interface OperatorAgendaItem {
  taskId: string;
  taskTitle: string;
  taskDescription: string | null;
  taskStatus: Database["public"]["Enums"]["task_status"];
  taskPriority: Database["public"]["Enums"]["task_priority"];
  taskStartedAt: string | null;
  taskDeadlineAt: string | null;
  assignedAt: string | null;
  urgencyCategory: OperatorUrgencyCategory;
  projectId: string;
  projectName: string;
  deliverables: OperatorDeliverableSummary[];
}

export interface OperatorOwnWorkProject {
  projectId: string;
  projectName: string;
  ownTaskCount: number;
  activeTaskCount: number;
  completedTaskCount: number;
  nearestDeadline: string | null;
  urgencyCategories: OperatorUrgencyCategory[];
}

export interface OperatorOwnWorkProjectDetail {
  projectId: string;
  projectName: string;
  tasks: OperatorAgendaItem[];
}

type AgendaViewRow = Database["public"]["Views"]["operator_agenda_view"]["Row"];

const AGENDA_SELECT_FIELDS =
  "task_id, task_title, task_description, task_status, task_priority, task_started_at, task_deadline_at, assigned_at, urgency_category, project_id, project_name, deliverable_id, deliverable_title, deliverable_status, deliverable_workflow_type, current_version_number, internal_review_deadline_at, client_delivery_deadline_at" as const;

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

function compareDatesAsc(a: string | null, b: string | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return new Date(a).getTime() - new Date(b).getTime();
}

function compareDatesDesc(a: string | null, b: string | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return new Date(b).getTime() - new Date(a).getTime();
}

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
  rows: AgendaViewRow[],
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
      const alreadyHasDeliverable = item.deliverables.some(
        (d) => d.deliverableId === row.deliverable_id,
      );
      if (!alreadyHasDeliverable) {
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

  const items = Array.from(taskMap.values());
  return sortAgendaItems(items);
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

    if (!data) return [];
    return mapAndDeduplicateAgendaRows(data);
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
  if (!projectId || !UUID_REGEX.test(projectId)) {
    return null;
  }

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

    if (!data || data.length === 0) {
      return null;
    }

    const tasks = mapAndDeduplicateAgendaRows(data);
    if (tasks.length === 0) {
      return null;
    }

    const projectName = tasks[0].projectName;
    return {
      projectId,
      projectName,
      tasks,
    };
  } catch (err) {
    logger.error("Error in getOperatorOwnWorkProject", { err, projectId });
    return null;
  }
}
