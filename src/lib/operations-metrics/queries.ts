import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { AppRole } from "@/lib/auth/routes";
import { logger } from "@/lib/logger";
import type {
  DeliverableStatus,
  DeliverableStatusDistribution,
  OperationsMetricsQuery,
  OperationsMetricsSectionResult,
  OperationsMetricsSummaryDto,
  OperationsMetricTrendPointDto,
  ProjectStatus,
  ProjectStatusDistribution,
} from "./types";
import { adminMetricsQuerySchema, pmMetricsQuerySchema } from "./schemas";
export { fetchScopedMetricsProjectFilterOptions } from "./project-filter-options";

const KNOWN_PROJECT_STATUSES: readonly ProjectStatus[] = [
  "planning",
  "in_progress",
  "paused",
  "completed",
  "cancelled",
];

const KNOWN_DELIVERABLE_STATUSES: readonly DeliverableStatus[] = [
  "pending",
  "awaiting_internal_review",
  "awaiting_client_review",
  "approved",
  "changes_requested",
  "delivered",
  "submitted",
];

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function isNonNegativeSafeInteger(val: unknown): val is number {
  return typeof val === "number" && Number.isSafeInteger(val) && val >= 0;
}

function isNonNegativeFiniteNumber(val: unknown): val is number {
  return typeof val === "number" && Number.isFinite(val) && val >= 0;
}

export function validateProjectStatusDistribution(
  raw: unknown,
): ProjectStatusDistribution | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const rawObj = raw as Record<string, unknown>;
  const result: Record<string, number> = {};

  for (const status of KNOWN_PROJECT_STATUSES) {
    result[status] = 0;
  }

  for (const [key, value] of Object.entries(rawObj)) {
    if (!KNOWN_PROJECT_STATUSES.includes(key as ProjectStatus)) {
      return null;
    }
    if (!isNonNegativeSafeInteger(value)) {
      return null;
    }
    result[key] = value;
  }

  return result as ProjectStatusDistribution;
}

export function validateDeliverableStatusDistribution(
  raw: unknown,
): DeliverableStatusDistribution | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const rawObj = raw as Record<string, unknown>;
  const result: Record<string, number> = {};

  for (const status of KNOWN_DELIVERABLE_STATUSES) {
    result[status] = 0;
  }

  for (const [key, value] of Object.entries(rawObj)) {
    if (!KNOWN_DELIVERABLE_STATUSES.includes(key as DeliverableStatus)) {
      return null;
    }
    if (!isNonNegativeSafeInteger(value)) {
      return null;
    }
    result[key] = value;
  }

  return result as DeliverableStatusDistribution;
}

export async function fetchScopedOperationsMetrics(
  supabase: SupabaseClient<Database>,
  query: OperationsMetricsQuery,
  role: AppRole,
): Promise<OperationsMetricsSectionResult<OperationsMetricsSummaryDto>> {
  const schema = role === "pm" ? pmMetricsQuerySchema : adminMetricsQuerySchema;
  const parsed = schema.safeParse(query);
  if (!parsed.success) {
    logger.debug("fetchScopedOperationsMetrics: query validation failed", {
      errors: parsed.error.errors,
    });
    return { status: "unavailable", code: "UNAVAILABLE" };
  }

  try {
    const { data, error } = await supabase.rpc(
      "get_scoped_operations_metrics",
      {
        p_project_id: query.projectId ?? undefined,
        p_from: query.from,
        p_to: query.to,
      },
    );

    if (error || !data) {
      logger.debug("fetchScopedOperationsMetrics: RPC error", {
        error: error?.message,
      });
      return { status: "unavailable", code: "UNAVAILABLE" };
    }

    if (!Array.isArray(data) || data.length !== 1) {
      logger.debug("fetchScopedOperationsMetrics: invalid row count", {
        count: Array.isArray(data) ? data.length : typeof data,
      });
      return { status: "unavailable", code: "UNAVAILABLE" };
    }

    const row = data[0];
    if (!row) {
      return { status: "unavailable", code: "UNAVAILABLE" };
    }

    // Validate semantic instant equality of returned range
    const requestedFromMs = Date.parse(query.from);
    const requestedToMs = Date.parse(query.to);
    const returnedFromMs = Date.parse(row.range_from);
    const returnedToMs = Date.parse(row.range_to);

    if (
      isNaN(returnedFromMs) ||
      isNaN(returnedToMs) ||
      returnedFromMs !== requestedFromMs ||
      returnedToMs !== requestedToMs
    ) {
      logger.debug("fetchScopedOperationsMetrics: range instant mismatch", {
        requested: { from: query.from, to: query.to },
        returned: { from: row.range_from, to: row.range_to },
      });
      return { status: "unavailable", code: "UNAVAILABLE" };
    }

    // Validate integer counts
    if (
      !isNonNegativeSafeInteger(row.active_task_count) ||
      !isNonNegativeSafeInteger(row.overdue_task_count) ||
      !isNonNegativeSafeInteger(row.deadline_attention_count) ||
      !isNonNegativeSafeInteger(row.finalized_deliverable_count) ||
      !isNonNegativeSafeInteger(row.client_review_cycle_count) ||
      !isNonNegativeSafeInteger(row.completion_cycle_count) ||
      !isNonNegativeSafeInteger(row.reopening_cycle_count) ||
      !isNonNegativeSafeInteger(row.unresolved_link_report_count)
    ) {
      logger.debug("fetchScopedOperationsMetrics: invalid counts in row");
      return { status: "unavailable", code: "UNAVAILABLE" };
    }

    // Validate nullable averages
    if (
      row.average_client_review_hours !== null &&
      !isNonNegativeFiniteNumber(row.average_client_review_hours)
    ) {
      logger.debug(
        "fetchScopedOperationsMetrics: invalid average_client_review_hours",
      );
      return { status: "unavailable", code: "UNAVAILABLE" };
    }

    if (
      row.average_completion_cycle_duration_days !== null &&
      !isNonNegativeFiniteNumber(row.average_completion_cycle_duration_days)
    ) {
      logger.debug(
        "fetchScopedOperationsMetrics: invalid average_completion_cycle_duration_days",
      );
      return { status: "unavailable", code: "UNAVAILABLE" };
    }

    // Validate nullable queue counts
    if (
      row.unread_in_app_queue_count !== null &&
      !isNonNegativeSafeInteger(row.unread_in_app_queue_count)
    ) {
      logger.debug(
        "fetchScopedOperationsMetrics: invalid unread_in_app_queue_count",
      );
      return { status: "unavailable", code: "UNAVAILABLE" };
    }

    if (
      row.suppressed_external_queue_count !== null &&
      !isNonNegativeSafeInteger(row.suppressed_external_queue_count)
    ) {
      logger.debug(
        "fetchScopedOperationsMetrics: invalid suppressed_external_queue_count",
      );
      return { status: "unavailable", code: "UNAVAILABLE" };
    }

    // Validate JSON distributions
    const projectCountsByStatus = validateProjectStatusDistribution(
      row.project_counts_by_status,
    );
    if (!projectCountsByStatus) {
      logger.debug(
        "fetchScopedOperationsMetrics: project_counts_by_status invalid",
      );
      return { status: "unavailable", code: "UNAVAILABLE" };
    }

    const productionDeliverableCountsByStatus =
      validateDeliverableStatusDistribution(
        row.production_deliverable_counts_by_status,
      );
    if (!productionDeliverableCountsByStatus) {
      logger.debug(
        "fetchScopedOperationsMetrics: production_deliverable_counts_by_status invalid",
      );
      return { status: "unavailable", code: "UNAVAILABLE" };
    }

    const dto: OperationsMetricsSummaryDto = {
      projectCountsByStatus,
      activeTaskCount: row.active_task_count,
      overdueTaskCount: row.overdue_task_count,
      deadlineAttentionCount: row.deadline_attention_count,
      productionDeliverableCountsByStatus,
      finalizedDeliverableCount: row.finalized_deliverable_count,
      clientReviewCycleCount: row.client_review_cycle_count,
      averageClientReviewHours: row.average_client_review_hours,
      completionCycleCount: row.completion_cycle_count,
      reopeningCycleCount: row.reopening_cycle_count,
      averageCompletionCycleDurationDays:
        row.average_completion_cycle_duration_days,
      unreadInAppQueueCount: row.unread_in_app_queue_count,
      suppressedExternalQueueCount: row.suppressed_external_queue_count,
      unresolvedLinkReportCount: row.unresolved_link_report_count,
      rangeFrom: row.range_from,
      rangeTo: row.range_to,
    };

    return { status: "available", data: dto };
  } catch (err) {
    logger.debug("fetchScopedOperationsMetrics failed", { err });
    return { status: "unavailable", code: "UNAVAILABLE" };
  }
}

export async function fetchScopedOperationsMetricTrend(
  supabase: SupabaseClient<Database>,
  query: OperationsMetricsQuery,
  role: AppRole,
): Promise<
  OperationsMetricsSectionResult<readonly OperationsMetricTrendPointDto[]>
> {
  const schema = role === "pm" ? pmMetricsQuerySchema : adminMetricsQuerySchema;
  const parsed = schema.safeParse(query);
  if (!parsed.success) {
    logger.debug("fetchScopedOperationsMetricTrend: query validation failed", {
      errors: parsed.error.errors,
    });
    return { status: "unavailable", code: "UNAVAILABLE" };
  }

  try {
    const { data, error } = await supabase.rpc(
      "list_scoped_operations_metric_trend",
      {
        p_project_id: query.projectId ?? undefined,
        p_from: query.from,
        p_to: query.to,
      },
    );

    if (error || !data) {
      logger.debug("fetchScopedOperationsMetricTrend: RPC error", {
        error: error?.message,
      });
      return { status: "unavailable", code: "UNAVAILABLE" };
    }

    if (!Array.isArray(data)) {
      return { status: "unavailable", code: "UNAVAILABLE" };
    }

    if (data.length === 0 || data.length > 14) {
      logger.debug("fetchScopedOperationsMetricTrend: invalid bucket count", {
        count: data.length,
      });
      return { status: "unavailable", code: "UNAVAILABLE" };
    }

    const requestedFromMs = Date.parse(query.from);
    const requestedToMs = Date.parse(query.to);

    const firstBucketStartMs = Date.parse(data[0].period_start);
    const lastBucketEndMs = Date.parse(data[data.length - 1].period_end);

    if (
      firstBucketStartMs !== requestedFromMs ||
      lastBucketEndMs !== requestedToMs
    ) {
      logger.debug(
        "fetchScopedOperationsMetricTrend: boundary instant mismatch",
      );
      return { status: "unavailable", code: "UNAVAILABLE" };
    }

    const points: OperationsMetricTrendPointDto[] = [];
    let prevEndMs: number | null = null;

    for (let i = 0; i < data.length; i++) {
      const bucket = data[i];
      const startMs = Date.parse(bucket.period_start);
      const endMs = Date.parse(bucket.period_end);

      if (isNaN(startMs) || isNaN(endMs) || startMs >= endMs) {
        logger.debug(
          "fetchScopedOperationsMetricTrend: invalid bucket interval",
        );
        return { status: "unavailable", code: "UNAVAILABLE" };
      }

      if (prevEndMs !== null && startMs !== prevEndMs) {
        logger.debug(
          "fetchScopedOperationsMetricTrend: non-contiguous bucket sequence",
        );
        return { status: "unavailable", code: "UNAVAILABLE" };
      }

      const durationMs = endMs - startMs;
      const isFinal = i === data.length - 1;

      if (!isFinal && durationMs !== SEVEN_DAYS_MS) {
        logger.debug(
          "fetchScopedOperationsMetricTrend: non-final bucket duration != 7 days",
        );
        return { status: "unavailable", code: "UNAVAILABLE" };
      }

      if (isFinal && (durationMs <= 0 || durationMs > SEVEN_DAYS_MS)) {
        logger.debug(
          "fetchScopedOperationsMetricTrend: final bucket duration out of range",
        );
        return { status: "unavailable", code: "UNAVAILABLE" };
      }

      if (
        !isNonNegativeSafeInteger(bucket.finalized_deliverable_count) ||
        !isNonNegativeSafeInteger(bucket.client_review_cycle_count) ||
        !isNonNegativeSafeInteger(bucket.completion_cycle_count) ||
        !isNonNegativeSafeInteger(bucket.reopening_cycle_count)
      ) {
        logger.debug("fetchScopedOperationsMetricTrend: invalid bucket counts");
        return { status: "unavailable", code: "UNAVAILABLE" };
      }

      points.push({
        periodStart: bucket.period_start,
        periodEnd: bucket.period_end,
        finalizedDeliverableCount: bucket.finalized_deliverable_count,
        clientReviewCycleCount: bucket.client_review_cycle_count,
        completionCycleCount: bucket.completion_cycle_count,
        reopeningCycleCount: bucket.reopening_cycle_count,
      });

      prevEndMs = endMs;
    }

    return { status: "available", data: points };
  } catch (err) {
    logger.debug("fetchScopedOperationsMetricTrend failed", { err });
    return { status: "unavailable", code: "UNAVAILABLE" };
  }
}
