import "server-only";

import { logger } from "@/lib/logger";
import type { Database } from "@/lib/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type ClientProjectListItem,
  type ClientProjectDetail,
  type ClientRequestQueueItem,
  type ClientSubmissionRequirementSummary,
  type ClientProductionReviewQueueItem,
  type ProjectStatus,
  type TaskStatus,
  type TaskPriority,
  type DeliverableStatus,
  type SubmissionProvider,
  sortClientProjects,
  sortClientRequests,
} from "./types";

type TypedSupabase = SupabaseClient<Database>;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CLIENT_PROJECT_SELECT_FIELDS =
  "id, name, status, client_scope, deadline_at, last_deliverable_activity_at" as const;

const CLIENT_TASK_SELECT_FIELDS =
  "id, project_id, project_name, title, description, status, priority, deadline_at, started_at, completed_at, child_submission_count, resources" as const;

const CLIENT_SUBMISSION_SELECT_FIELDS =
  "id, task_id, task_title, project_id, project_name, title, specifications, submission_deadline_at, status, current_version_number, current_submission_provider, current_submission_url, current_submission_note, current_submitted_at" as const;

const CLIENT_DELIVERABLE_SELECT_FIELDS =
  "id, project_id, project_name, title, specifications, status, current_version_number, current_submission_provider, current_submission_url, current_submission_note, current_submitted_at, client_delivery_deadline_at, approved_at, delivered_at, client_feedback_history" as const;

export async function getClientProjects(
  supabase: TypedSupabase,
): Promise<ClientProjectListItem[]> {
  try {
    const { data, error } = await supabase
      .from("client_project_view")
      .select(CLIENT_PROJECT_SELECT_FIELDS);

    if (error) {
      logger.error("Failed to query client_project_view", { error });
      return [];
    }

    if (!data) return [];

    const items: ClientProjectListItem[] = data
      .filter((r): r is typeof r & { id: string } => Boolean(r.id))
      .map((r) => ({
        id: r.id,
        name: r.name ?? "Sin nombre",
        status: (r.status ?? "planning") as ProjectStatus,
        client_scope: r.client_scope,
        deadline_at: r.deadline_at,
        last_deliverable_activity_at: r.last_deliverable_activity_at,
      }));

    return sortClientProjects(items);
  } catch (err) {
    logger.error("Unexpected error in getClientProjects", { err });
    return [];
  }
}

export async function getClientProjectDetail(
  supabase: TypedSupabase,
  projectId: string,
): Promise<ClientProjectDetail | null> {
  if (!UUID_REGEX.test(projectId)) {
    return null;
  }

  try {
    const [projectRes, tasksRes, submissionsRes, deliverablesRes] =
      await Promise.all([
        supabase
          .from("client_project_view")
          .select(CLIENT_PROJECT_SELECT_FIELDS)
          .eq("id", projectId)
          .maybeSingle(),
        supabase
          .from("client_task_view")
          .select(CLIENT_TASK_SELECT_FIELDS)
          .eq("project_id", projectId),
        supabase
          .from("client_submission_view")
          .select(CLIENT_SUBMISSION_SELECT_FIELDS)
          .eq("project_id", projectId),
        supabase
          .from("client_deliverable_view")
          .select(CLIENT_DELIVERABLE_SELECT_FIELDS)
          .eq("project_id", projectId),
      ]);

    if (projectRes.error || !projectRes.data || !projectRes.data.id) {
      return null;
    }

    const pRow = projectRes.data;
    const projectIdVal = pRow.id;
    if (!projectIdVal) {
      return null;
    }

    const project: ClientProjectListItem = {
      id: projectIdVal,
      name: pRow.name ?? "Sin nombre",
      status: (pRow.status ?? "planning") as ProjectStatus,
      client_scope: pRow.client_scope,
      deadline_at: pRow.deadline_at,
      last_deliverable_activity_at: pRow.last_deliverable_activity_at,
    };

    const taskRows = tasksRes.data ?? [];
    const directTaskIds = new Set<string>();

    const directRequests: ClientRequestQueueItem[] = taskRows
      .filter((r): r is typeof r & { id: string } => Boolean(r.id))
      .map((r) => {
        directTaskIds.add(r.id);
        return {
          id: r.id,
          project_id: r.project_id ?? projectIdVal,
          project_name: r.project_name ?? project.name,
          title: r.title ?? "Sin título",
          description: r.description,
          status: (r.status ?? "pending") as TaskStatus,
          priority: (r.priority ?? "medium") as TaskPriority,
          deadline_at: r.deadline_at,
          child_submission_count: r.child_submission_count ?? 0,
          started_at: r.started_at,
          completed_at: r.completed_at,
        };
      });

    const subRows = submissionsRes.data ?? [];
    const directSubmissions: ClientSubmissionRequirementSummary[] = subRows
      .filter((s): s is typeof s & { id: string; task_id: string } =>
        Boolean(s.id && s.task_id && directTaskIds.has(s.task_id)),
      )
      .map((s) => ({
        id: s.id,
        task_id: s.task_id,
        task_title: s.task_title ?? null,
        project_id: s.project_id ?? projectIdVal,
        project_name: s.project_name ?? project.name,
        title: s.title ?? "Sin título",
        specifications: s.specifications,
        submission_deadline_at: s.submission_deadline_at,
        status: (s.status ?? "pending") as DeliverableStatus,
        current_version_number: s.current_version_number,
        current_submission_provider:
          s.current_submission_provider as SubmissionProvider | null,
        current_submission_url: s.current_submission_url,
        current_submission_note: s.current_submission_note,
        current_submitted_at: s.current_submitted_at,
        correctionHistory: [],
      }));

    const delivRows = deliverablesRes.data ?? [];
    const releasedProductionReviews: ClientProductionReviewQueueItem[] =
      delivRows
        .filter((d): d is typeof d & { id: string } => Boolean(d.id))
        .map((d) => ({
          id: d.id,
          project_id: d.project_id ?? projectIdVal,
          project_name: d.project_name ?? project.name,
          title: d.title ?? "Sin título",
          specifications: d.specifications,
          status: (d.status ?? "awaiting_client_review") as DeliverableStatus,
          current_version_number: d.current_version_number,
          current_submission_url: d.current_submission_url,
          current_submission_provider:
            d.current_submission_provider as SubmissionProvider | null,
          client_delivery_deadline_at: d.client_delivery_deadline_at,
          approved_at: d.approved_at,
          delivered_at: d.delivered_at,
        }));

    return {
      project,
      directRequests: sortClientRequests(directRequests),
      directSubmissions,
      releasedProductionReviews,
    };
  } catch (err) {
    logger.error("Unexpected error in getClientProjectDetail", { err });
    return null;
  }
}
