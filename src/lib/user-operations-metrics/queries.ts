import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { AppRole } from "@/lib/auth/routes";
import { logger } from "@/lib/logger";
import type {
  UserOperationsMetricDto,
  UserOperationsMetricsQuery,
  UserOperationsMetricsSectionResult,
} from "./types";
import {
  adminUserMetricsQuerySchema,
  pmUserMetricsQuerySchema,
} from "./schemas";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const KNOWN_APPLICATION_ROLES: readonly AppRole[] = [
  "admin",
  "pm",
  "operator",
  "client",
];

function isNonNegativeSafeInteger(val: unknown): val is number {
  return typeof val === "number" && Number.isSafeInteger(val) && val >= 0;
}

function isNullableNonNegativeFiniteNumber(val: unknown): val is number | null {
  if (val === null) return true;
  return typeof val === "number" && Number.isFinite(val) && val >= 0;
}

function isNullableIsoTimestamp(val: unknown): val is string | null {
  if (val === null) return true;
  if (typeof val !== "string") return false;
  return !isNaN(Date.parse(val));
}

export async function fetchScopedUserOperationsMetrics(
  supabase: SupabaseClient<Database>,
  query: UserOperationsMetricsQuery,
  role: AppRole,
): Promise<UserOperationsMetricsSectionResult> {
  // Authorization boundary: Only admin and pm callers may access this adapter
  if (role !== "admin" && role !== "pm") {
    logger.debug("user-operations-metrics-adapter-role-denied");
    return { status: "unavailable", code: "UNAVAILABLE" };
  }

  const schema =
    role === "pm" ? pmUserMetricsQuerySchema : adminUserMetricsQuerySchema;
  const parsed = schema.safeParse(query);
  if (!parsed.success) {
    logger.debug("user-operations-metrics-adapter-query-invalid");
    return { status: "unavailable", code: "UNAVAILABLE" };
  }

  try {
    const { data, error } = await supabase.rpc(
      "list_scoped_user_operations_metrics",
      {
        p_project_id: query.projectId ?? undefined,
        p_user_id: query.userId ?? undefined,
        p_from: query.from,
        p_to: query.to,
      },
    );

    if (error || !data) {
      logger.debug("user-operations-metrics-adapter-rpc-error");
      return { status: "unavailable", code: "UNAVAILABLE" };
    }

    const rawRows: unknown = data;
    if (!Array.isArray(rawRows)) {
      logger.debug("user-operations-metrics-adapter-invalid-shape");
      return { status: "unavailable", code: "UNAVAILABLE" };
    }

    const requestedFromMs = Date.parse(query.from);
    const requestedToMs = Date.parse(query.to);
    const dtos: UserOperationsMetricDto[] = [];

    for (const raw of rawRows) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        logger.debug("user-operations-metrics-adapter-malformed-row");
        return { status: "unavailable", code: "UNAVAILABLE" };
      }

      const row = raw as Record<string, unknown>;

      // 1. Identity & Profile
      if (typeof row.user_id !== "string" || !UUID_REGEX.test(row.user_id)) {
        logger.debug("user-operations-metrics-adapter-invalid-user-id");
        return { status: "unavailable", code: "UNAVAILABLE" };
      }

      if (
        typeof row.full_name !== "string" ||
        row.full_name.trim().length === 0
      ) {
        logger.debug("user-operations-metrics-adapter-invalid-full-name");
        return { status: "unavailable", code: "UNAVAILABLE" };
      }

      if (
        typeof row.application_role !== "string" ||
        !KNOWN_APPLICATION_ROLES.includes(row.application_role as AppRole)
      ) {
        logger.debug("user-operations-metrics-adapter-invalid-role");
        return { status: "unavailable", code: "UNAVAILABLE" };
      }

      if (typeof row.is_active !== "boolean") {
        logger.debug("user-operations-metrics-adapter-invalid-active-state");
        return { status: "unavailable", code: "UNAVAILABLE" };
      }

      // 2. Counts
      if (
        !isNonNegativeSafeInteger(row.current_active_task_count) ||
        !isNonNegativeSafeInteger(row.task_assigned_count) ||
        !isNonNegativeSafeInteger(row.task_started_count) ||
        !isNonNegativeSafeInteger(row.task_completed_count) ||
        !isNonNegativeSafeInteger(row.unstarted_task_count_at_range_end) ||
        !isNonNegativeSafeInteger(
          row.production_deliverable_submission_count,
        ) ||
        !isNonNegativeSafeInteger(row.client_submission_count) ||
        !isNonNegativeSafeInteger(row.deliverable_review_count) ||
        !isNonNegativeSafeInteger(row.deliverable_delivered_count) ||
        !isNonNegativeSafeInteger(row.in_app_notification_received_count) ||
        !isNonNegativeSafeInteger(row.in_app_notification_read_count) ||
        !isNonNegativeSafeInteger(
          row.in_app_notification_unread_count_at_range_end,
        ) ||
        !isNonNegativeSafeInteger(
          row.in_app_notification_unread_over_24h_count_at_range_end,
        )
      ) {
        logger.debug("user-operations-metrics-adapter-invalid-counts");
        return { status: "unavailable", code: "UNAVAILABLE" };
      }

      // 3. Nullable averages & timestamps
      if (
        !isNullableNonNegativeFiniteNumber(
          row.average_assignment_to_start_hours,
        ) ||
        !isNullableNonNegativeFiniteNumber(
          row.average_in_app_notification_read_hours,
        )
      ) {
        logger.debug("user-operations-metrics-adapter-invalid-averages");
        return { status: "unavailable", code: "UNAVAILABLE" };
      }

      if (!isNullableIsoTimestamp(row.last_workflow_action_at)) {
        logger.debug("user-operations-metrics-adapter-invalid-timestamp");
        return { status: "unavailable", code: "UNAVAILABLE" };
      }

      // 4. Semantic range instant equality
      if (
        typeof row.range_from !== "string" ||
        typeof row.range_to !== "string"
      ) {
        logger.debug("user-operations-metrics-adapter-missing-range-bounds");
        return { status: "unavailable", code: "UNAVAILABLE" };
      }

      const returnedFromMs = Date.parse(row.range_from);
      const returnedToMs = Date.parse(row.range_to);

      if (
        isNaN(returnedFromMs) ||
        isNaN(returnedToMs) ||
        returnedFromMs !== requestedFromMs ||
        returnedToMs !== requestedToMs
      ) {
        logger.debug("user-operations-metrics-adapter-range-mismatch");
        return { status: "unavailable", code: "UNAVAILABLE" };
      }

      dtos.push({
        userId: row.user_id,
        fullName: row.full_name,
        applicationRole: row.application_role as AppRole,
        isActive: row.is_active,
        currentActiveTaskCount: row.current_active_task_count,
        taskAssignedCount: row.task_assigned_count,
        taskStartedCount: row.task_started_count,
        taskCompletedCount: row.task_completed_count,
        averageAssignmentToStartHours: row.average_assignment_to_start_hours,
        unstartedTaskCountAtRangeEnd: row.unstarted_task_count_at_range_end,
        productionDeliverableSubmissionCount:
          row.production_deliverable_submission_count,
        clientSubmissionCount: row.client_submission_count,
        deliverableReviewCount: row.deliverable_review_count,
        deliverableDeliveredCount: row.deliverable_delivered_count,
        inAppNotificationReceivedCount: row.in_app_notification_received_count,
        inAppNotificationReadCount: row.in_app_notification_read_count,
        inAppNotificationUnreadCountAtRangeEnd:
          row.in_app_notification_unread_count_at_range_end,
        inAppNotificationUnreadOver24hCountAtRangeEnd:
          row.in_app_notification_unread_over_24h_count_at_range_end,
        averageInAppNotificationReadHours:
          row.average_in_app_notification_read_hours,
        lastWorkflowActionAt: row.last_workflow_action_at,
        rangeFrom: row.range_from,
        rangeTo: row.range_to,
      });
    }

    return { status: "available", data: dtos };
  } catch (err) {
    logger.debug("user-operations-metrics-adapter-failed", { err });
    return { status: "unavailable", code: "UNAVAILABLE" };
  }
}
