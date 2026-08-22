import "server-only";

import { logger } from "@/lib/logger";
import type { Database } from "@/lib/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type ClientRequestQueueItem,
  type ClientRequestDetail,
  type ClientRequestTransitionTarget,
  type ClientSubmissionRequirementSummary,
  type ClientSubmissionTarget,
  type TaskStatus,
  type TaskPriority,
  type DeliverableStatus,
  type SubmissionProvider,
  parseTaskResources,
  parseClientCorrectionHistory,
  computeClientRequestReadiness,
  sortClientRequests,
} from "./types";

type TypedSupabase = SupabaseClient<Database>;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CLIENT_TASK_SELECT_FIELDS =
  "id, project_id, project_name, title, description, status, priority, deadline_at, started_at, completed_at, child_submission_count, resources" as const;

const CLIENT_SUBMISSION_SELECT_FIELDS =
  "id, task_id, task_title, project_id, project_name, title, specifications, submission_deadline_at, status, current_version_number, current_submission_provider, current_submission_url, current_submission_note, current_submitted_at, correction_history" as const;

export async function getClientRequestQueue(
  supabase: TypedSupabase,
): Promise<ClientRequestQueueItem[]> {
  try {
    const { data, error } = await supabase
      .from("client_task_view")
      .select(CLIENT_TASK_SELECT_FIELDS);

    if (error) {
      logger.error("Failed to query client_task_view", { error });
      return [];
    }

    if (!data) return [];

    const items: ClientRequestQueueItem[] = data
      .filter((r): r is typeof r & { id: string; project_id: string } =>
        Boolean(r.id && r.project_id),
      )
      .map((r) => ({
        id: r.id,
        project_id: r.project_id,
        project_name: r.project_name,
        title: r.title ?? null,
        description: r.description,
        status: (r.status ?? "pending") as TaskStatus,
        priority: (r.priority ?? "medium") as TaskPriority,
        deadline_at: r.deadline_at,
        child_submission_count: r.child_submission_count ?? 0,
        started_at: r.started_at,
        completed_at: r.completed_at,
      }));

    return sortClientRequests(items);
  } catch (err) {
    logger.error("Unexpected error in getClientRequestQueue", { err });
    return [];
  }
}

export async function getClientRequestDetail(
  supabase: TypedSupabase,
  taskId: string,
): Promise<ClientRequestDetail | null> {
  if (!UUID_REGEX.test(taskId)) {
    return null;
  }

  try {
    const [taskRes, submissionsRes] = await Promise.all([
      supabase
        .from("client_task_view")
        .select(CLIENT_TASK_SELECT_FIELDS)
        .eq("id", taskId)
        .maybeSingle(),
      supabase
        .from("client_submission_view")
        .select(CLIENT_SUBMISSION_SELECT_FIELDS)
        .eq("task_id", taskId),
    ]);

    if (taskRes.error || !taskRes.data || !taskRes.data.id) {
      return null;
    }

    const t = taskRes.data;
    const taskIdVal = t.id;
    if (!taskIdVal) {
      return null;
    }

    const subRows = submissionsRes.data ?? [];

    const childSubmissions: ClientSubmissionRequirementSummary[] = subRows
      .filter((s): s is typeof s & { id: string } => Boolean(s.id))
      .map((s) => {
        const historyParsed = parseClientCorrectionHistory(
          s.correction_history,
        );
        return {
          id: s.id,
          task_id: s.task_id ?? taskId,
          task_title: s.task_title ?? t.title ?? null,
          project_id: s.project_id ?? t.project_id ?? "",
          project_name: s.project_name ?? t.project_name,
          title: s.title ?? null,
          specifications: s.specifications,
          submission_deadline_at: s.submission_deadline_at,
          status: (s.status ?? "pending") as DeliverableStatus,
          current_version_number: s.current_version_number,
          current_submission_provider:
            s.current_submission_provider as SubmissionProvider | null,
          current_submission_url: s.current_submission_url,
          current_submission_note: s.current_submission_note,
          current_submitted_at: s.current_submitted_at,
          correctionHistory: historyParsed.ok ? historyParsed.items : [],
          correctionHistoryError: !historyParsed.ok,
        };
      });

    const resources = parseTaskResources(t.resources);
    const readinessSummary = computeClientRequestReadiness(childSubmissions);

    return {
      id: taskIdVal,
      project_id: t.project_id ?? "",
      project_name: t.project_name,
      title: t.title ?? null,
      description: t.description,
      status: (t.status ?? "pending") as TaskStatus,
      priority: (t.priority ?? "medium") as TaskPriority,
      deadline_at: t.deadline_at,
      started_at: t.started_at,
      completed_at: t.completed_at,
      resources,
      childSubmissions,
      readinessSummary,
    };
  } catch (err) {
    logger.error("Unexpected error in getClientRequestDetail", { err });
    return null;
  }
}

export async function getClientRequestForTransition(
  supabase: TypedSupabase,
  taskId: string,
): Promise<ClientRequestTransitionTarget | null> {
  if (!UUID_REGEX.test(taskId)) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("client_task_view")
      .select("id, project_id, status, child_submission_count")
      .eq("id", taskId)
      .maybeSingle();

    if (error || !data || !data.id || !data.project_id || !data.status) {
      return null;
    }

    return {
      id: data.id,
      projectId: data.project_id,
      status: data.status as TaskStatus,
      childSubmissionCount: data.child_submission_count ?? 0,
    };
  } catch (err) {
    logger.error("Unexpected error in getClientRequestForTransition", { err });
    return null;
  }
}

export async function getClientSubmissionForSubmission(
  supabase: TypedSupabase,
  deliverableId: string,
): Promise<ClientSubmissionTarget | null> {
  if (!UUID_REGEX.test(deliverableId)) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("client_submission_view")
      .select("id, task_id, project_id, status, current_version_number")
      .eq("id", deliverableId)
      .maybeSingle();

    if (
      error ||
      !data ||
      !data.id ||
      !data.task_id ||
      !data.project_id ||
      !data.status
    ) {
      return null;
    }

    return {
      id: data.id,
      taskId: data.task_id,
      projectId: data.project_id,
      status: data.status as DeliverableStatus,
      currentVersionNumber: data.current_version_number,
    };
  } catch (err) {
    logger.error("Unexpected error in getClientSubmissionForSubmission", {
      err,
    });
    return null;
  }
}
