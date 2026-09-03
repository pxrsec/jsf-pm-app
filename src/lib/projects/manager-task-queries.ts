import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { logger } from "@/lib/logger";
import type {
  DeliverableStatus,
  DeliverableWorkflowType,
  ProfileSummary,
} from "@/lib/deliverables/queries";
import type {
  TaskPriority,
  TaskStatus,
  TaskType,
} from "@/lib/projects/queries";

type TypedSupabase = SupabaseClient<Database>;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ManagerTaskResource = {
  id: string;
  taskId: string;
  name: string;
  url: string;
  sortOrder: number;
};

export type ManagerTaskDeliverableSummary = {
  id: string;
  projectId: string;
  taskId: string;
  assigneeId: string | null;
  title: string;
  specifications: string;
  workflowType: DeliverableWorkflowType;
  status: DeliverableStatus;
  currentVersionNumber: number;
  isStalled: boolean;
  submissionDeadlineAt: string | null;
  internalReviewDeadlineAt: string | null;
  clientDeliveryDeadlineAt: string | null;
  approvedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignee: ProfileSummary | null;
};

export type ManagerTaskDetail = {
  taskId: string;
  projectId: string;
  projectName: string;
  title: string;
  description: string | null;
  taskType: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  deadlineAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  assignedAt: string | null;
  assignee: ProfileSummary | null;
  resources: ManagerTaskResource[];
  deliverables: ManagerTaskDeliverableSummary[];
};

export async function getManagerTaskDetail(
  supabase: TypedSupabase,
  taskId: string,
): Promise<ManagerTaskDetail | null> {
  if (!taskId || !UUID_REGEX.test(taskId)) {
    return null;
  }

  try {
    // 1. Query task with active task and parent project ancestry
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select(
        `
        id,
        project_id,
        title,
        description,
        task_type,
        status,
        priority,
        deadline_at,
        started_at,
        completed_at,
        assigned_at,
        projects!inner(
          id,
          name,
          deleted_at,
          archived_at
        ),
        profiles(
          id,
          full_name,
          role,
          avatar_url
        )
      `,
      )
      .eq("id", taskId)
      .is("deleted_at", null)
      .is("archived_at", null)
      .is("projects.deleted_at", null)
      .is("projects.archived_at", null)
      .maybeSingle();

    if (taskError || !task || !task.projects) {
      if (taskError) {
        logger.error("Failed to query manager task detail", {
          taskId,
          error: taskError.message,
        });
      }
      return null;
    }

    // 2. Query task resources with deterministic ordering — FAIL CLOSED
    const { data: resourcesData, error: resourcesError } = await supabase
      .from("task_resources")
      .select("id, task_id, name, url, sort_order")
      .eq("task_id", taskId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });

    if (resourcesError || !resourcesData) {
      logger.error("Failed to query task resources for manager task detail", {
        taskId,
        error: resourcesError?.message,
      });
      return null;
    }

    // 3. Query associated deliverables with deterministic ordering — FAIL CLOSED
    const { data: deliverablesData, error: deliverablesError } = await supabase
      .from("deliverables")
      .select(
        `
        id,
        project_id,
        task_id,
        assignee_id,
        title,
        specifications,
        workflow_type,
        status,
        current_version_number,
        is_stalled,
        submission_deadline_at,
        internal_review_deadline_at,
        client_delivery_deadline_at,
        approved_at,
        delivered_at,
        created_at,
        updated_at,
        tasks!inner(
          deleted_at,
          archived_at,
          projects!inner(
            deleted_at,
            archived_at
          )
        ),
        profiles(
          id,
          full_name,
          role,
          avatar_url
        )
      `,
      )
      .eq("task_id", taskId)
      .is("deleted_at", null)
      .is("archived_at", null)
      .is("tasks.deleted_at", null)
      .is("tasks.archived_at", null)
      .is("tasks.projects.deleted_at", null)
      .is("tasks.projects.archived_at", null)
      .order("submission_deadline_at", { ascending: true, nullsFirst: false })
      .order("title", { ascending: true })
      .order("id", { ascending: true });

    if (deliverablesError || !deliverablesData) {
      logger.error("Failed to query deliverables for manager task detail", {
        taskId,
        error: deliverablesError?.message,
      });
      return null;
    }

    const resources: ManagerTaskResource[] = resourcesData.map((r) => ({
      id: r.id,
      taskId: r.task_id,
      name: r.name,
      url: r.url,
      sortOrder: r.sort_order ?? 0,
    }));

    type RawDeliverable = {
      id: string;
      project_id: string;
      task_id: string;
      assignee_id: string | null;
      title: string;
      specifications: string;
      workflow_type: DeliverableWorkflowType;
      status: DeliverableStatus;
      current_version_number: number;
      is_stalled: boolean;
      submission_deadline_at: string | null;
      internal_review_deadline_at: string | null;
      client_delivery_deadline_at: string | null;
      approved_at: string | null;
      delivered_at: string | null;
      created_at: string;
      updated_at: string;
      profiles: ProfileSummary | null;
    };

    const deliverables: ManagerTaskDeliverableSummary[] = (
      deliverablesData as unknown as RawDeliverable[]
    ).map((d) => ({
      id: d.id,
      projectId: d.project_id,
      taskId: d.task_id,
      assigneeId: d.assignee_id,
      title: d.title,
      specifications: d.specifications,
      workflowType: d.workflow_type,
      status: d.status,
      currentVersionNumber: d.current_version_number,
      isStalled: d.is_stalled,
      submissionDeadlineAt: d.submission_deadline_at,
      internalReviewDeadlineAt: d.internal_review_deadline_at,
      clientDeliveryDeadlineAt: d.client_delivery_deadline_at,
      approvedAt: d.approved_at,
      deliveredAt: d.delivered_at,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
      assignee: d.profiles,
    }));

    type RawTaskProfile = ProfileSummary | null;
    const taskAssignee = (task.profiles ?? null) as RawTaskProfile;
    const parentProject = task.projects as { id: string; name: string };

    return {
      taskId: task.id,
      projectId: task.project_id,
      projectName: parentProject.name,
      title: task.title,
      description: task.description,
      taskType: task.task_type,
      status: task.status,
      priority: task.priority,
      deadlineAt: task.deadline_at,
      startedAt: task.started_at,
      completedAt: task.completed_at,
      assignedAt: task.assigned_at,
      assignee: taskAssignee,
      resources,
      deliverables,
    };
  } catch (err) {
    logger.error("Unexpected error in getManagerTaskDetail", { err, taskId });
    return null;
  }
}

export async function getProjectMembershipCapacity(
  supabase: TypedSupabase,
  projectId: string,
  userId: string,
): Promise<"pm_lead" | "pm_watcher"> {
  try {
    const { data, error } = await supabase
      .from("project_members")
      .select("member_type")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error || !data) {
      return "pm_watcher";
    }

    if (data.member_type === "pm_lead") {
      return "pm_lead";
    }

    if (data.member_type === "pm_watcher") {
      return "pm_watcher";
    }

    return "pm_watcher";
  } catch {
    return "pm_watcher";
  }
}
