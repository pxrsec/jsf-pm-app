import "server-only";

import { logger } from "@/lib/logger";
import type { Database } from "@/lib/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type ClientProductionReviewQueueItem,
  type ClientProductionReviewDetail,
  type ClientProductionReviewTarget,
  type DeliverableStatus,
  type SubmissionProvider,
  parseClientFeedbackHistory,
  sortClientReviews,
} from "./types";

type TypedSupabase = SupabaseClient<Database>;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CLIENT_DELIVERABLE_SELECT_FIELDS =
  "id, project_id, project_name, title, specifications, status, current_version_number, current_submission_provider, current_submission_url, current_submission_note, current_submitted_at, client_delivery_deadline_at, approved_at, delivered_at, client_feedback_history" as const;

export async function getClientProductionReviewQueue(
  supabase: TypedSupabase,
): Promise<ClientProductionReviewQueueItem[]> {
  try {
    const { data, error } = await supabase
      .from("client_deliverable_view")
      .select(CLIENT_DELIVERABLE_SELECT_FIELDS);

    if (error) {
      logger.error("Failed to query client_deliverable_view", { error });
      return [];
    }

    if (!data) return [];

    const items: ClientProductionReviewQueueItem[] = data
      .filter((d): d is typeof d & { id: string; project_id: string } =>
        Boolean(d.id && d.project_id),
      )
      .map((d) => ({
        id: d.id,
        project_id: d.project_id,
        project_name: d.project_name,
        title: d.title ?? null,
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

    return sortClientReviews(items);
  } catch (err) {
    logger.error("Unexpected error in getClientProductionReviewQueue", { err });
    return [];
  }
}

export async function getClientProductionReviewDetail(
  supabase: TypedSupabase,
  deliverableId: string,
): Promise<ClientProductionReviewDetail | null> {
  if (!UUID_REGEX.test(deliverableId)) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("client_deliverable_view")
      .select(CLIENT_DELIVERABLE_SELECT_FIELDS)
      .eq("id", deliverableId)
      .maybeSingle();

    if (error || !data || !data.id || !data.project_id) {
      return null;
    }

    const feedbackResult = parseClientFeedbackHistory(
      data.client_feedback_history,
    );

    return {
      id: data.id,
      project_id: data.project_id,
      project_name: data.project_name,
      title: data.title ?? null,
      specifications: data.specifications,
      status: (data.status ?? "awaiting_client_review") as DeliverableStatus,
      current_version_number: data.current_version_number,
      current_submission_url: data.current_submission_url,
      current_submission_provider:
        data.current_submission_provider as SubmissionProvider | null,
      current_submission_note: data.current_submission_note,
      current_submitted_at: data.current_submitted_at,
      client_delivery_deadline_at: data.client_delivery_deadline_at,
      approved_at: data.approved_at,
      delivered_at: data.delivered_at,
      feedbackResult,
    };
  } catch (err) {
    logger.error("Unexpected error in getClientProductionReviewDetail", {
      err,
    });
    return null;
  }
}

export async function getClientProductionReviewForDecision(
  supabase: TypedSupabase,
  deliverableId: string,
): Promise<ClientProductionReviewTarget | null> {
  if (!UUID_REGEX.test(deliverableId)) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from("client_deliverable_view")
      .select("id, project_id, status, current_version_number")
      .eq("id", deliverableId)
      .maybeSingle();

    if (error || !data || !data.id || !data.project_id || !data.status) {
      return null;
    }

    return {
      id: data.id,
      projectId: data.project_id,
      status: data.status as DeliverableStatus,
      currentVersionNumber: data.current_version_number,
    };
  } catch (err) {
    logger.error("Unexpected error in getClientProductionReviewForDecision", {
      err,
    });
    return null;
  }
}
