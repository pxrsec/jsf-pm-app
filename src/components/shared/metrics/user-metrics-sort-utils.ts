import { CALENDAR_TIME_ZONE } from "@/lib/operations-metrics/date-utils";
import type {
  SortDirection,
  UserOperationsMetricDto,
  UserOperationsSortField,
} from "@/lib/user-operations-metrics/types";

/**
 * Sorts user operational metrics rows according to the specified field and direction.
 * In both ascending and descending modes, null values (averages and timestamps) sort after numeric values.
 */
export function sortUserOperationsMetrics(
  rows: readonly UserOperationsMetricDto[],
  sortField: UserOperationsSortField | null,
  sortDirection: SortDirection = "asc",
): UserOperationsMetricDto[] {
  const result = [...rows];

  if (!sortField) {
    // Default sort matching RPC: unstarted desc, unread-24h desc, name asc, id asc
    return result.sort((a, b) => {
      if (b.unstartedTaskCountAtRangeEnd !== a.unstartedTaskCountAtRangeEnd) {
        return b.unstartedTaskCountAtRangeEnd - a.unstartedTaskCountAtRangeEnd;
      }
      if (
        b.inAppNotificationUnreadOver24hCountAtRangeEnd !==
        a.inAppNotificationUnreadOver24hCountAtRangeEnd
      ) {
        return (
          b.inAppNotificationUnreadOver24hCountAtRangeEnd -
          a.inAppNotificationUnreadOver24hCountAtRangeEnd
        );
      }
      const nameCompare = a.fullName.localeCompare(b.fullName);
      if (nameCompare !== 0) return nameCompare;
      return a.userId.localeCompare(b.userId);
    });
  }

  return result.sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case "name":
        comparison = a.fullName.localeCompare(b.fullName);
        break;

      case "role":
        comparison = a.applicationRole.localeCompare(b.applicationRole);
        break;

      case "currentActiveTaskCount":
        comparison = a.currentActiveTaskCount - b.currentActiveTaskCount;
        break;

      case "unstartedTaskCountAtRangeEnd":
        comparison =
          a.unstartedTaskCountAtRangeEnd - b.unstartedTaskCountAtRangeEnd;
        break;

      case "inAppNotificationUnreadOver24hCountAtRangeEnd":
        comparison =
          a.inAppNotificationUnreadOver24hCountAtRangeEnd -
          b.inAppNotificationUnreadOver24hCountAtRangeEnd;
        break;

      case "averageAssignmentToStartHours": {
        const aVal = a.averageAssignmentToStartHours;
        const bVal = b.averageAssignmentToStartHours;
        if (aVal === null && bVal === null) return 0;
        if (aVal === null) return 1; // null sorts to end
        if (bVal === null) return -1;
        comparison = aVal - bVal;
        break;
      }

      case "averageInAppNotificationReadHours": {
        const aVal = a.averageInAppNotificationReadHours;
        const bVal = b.averageInAppNotificationReadHours;
        if (aVal === null && bVal === null) return 0;
        if (aVal === null) return 1; // null sorts to end
        if (bVal === null) return -1;
        comparison = aVal - bVal;
        break;
      }

      case "taskCompletedCount":
        comparison = a.taskCompletedCount - b.taskCompletedCount;
        break;

      case "deliverableReviewCount":
        comparison = a.deliverableReviewCount - b.deliverableReviewCount;
        break;

      case "lastWorkflowActionAt": {
        const aVal = a.lastWorkflowActionAt;
        const bVal = b.lastWorkflowActionAt;
        if (aVal === null && bVal === null) return 0;
        if (aVal === null) return 1; // null sorts to end
        if (bVal === null) return -1;
        comparison = Date.parse(aVal) - Date.parse(bVal);
        break;
      }
    }

    if (comparison !== 0) {
      return sortDirection === "asc" ? comparison : -comparison;
    }

    // Deterministic tie-breaker
    const nameCompare = a.fullName.localeCompare(b.fullName);
    if (nameCompare !== 0) return nameCompare;
    return a.userId.localeCompare(b.userId);
  });
}

/**
 * Formats a metric integer count using active locale.
 */
export function formatMetricCount(val: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(val);
}

/**
 * Formats average duration in hours using active locale.
 */
export function formatMetricHours(
  val: number | null,
  locale: string,
  noDataLabel: string,
  unitLabel: string,
): string {
  if (val === null) return noDataLabel;
  const num = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  }).format(val);
  return `${num} ${unitLabel}`;
}

/**
 * Formats an ISO timestamp in Mexico City timezone using active locale.
 */
export function formatMetricTimestamp(
  val: string | null,
  locale: string,
  noDataLabel: string,
): string {
  if (val === null) return noDataLabel;
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return noDataLabel;
    return new Intl.DateTimeFormat(locale, {
      timeZone: CALENDAR_TIME_ZONE,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return noDataLabel;
  }
}
