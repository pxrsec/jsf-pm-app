import type { AppRole } from "@/lib/auth/routes";

export type UserOperationsMetricDto = Readonly<{
  userId: string;
  fullName: string;
  applicationRole: AppRole;
  isActive: boolean;
  currentActiveTaskCount: number;
  taskAssignedCount: number;
  taskStartedCount: number;
  taskCompletedCount: number;
  averageAssignmentToStartHours: number | null;
  unstartedTaskCountAtRangeEnd: number;
  productionDeliverableSubmissionCount: number;
  clientSubmissionCount: number;
  deliverableReviewCount: number;
  deliverableDeliveredCount: number;
  inAppNotificationReceivedCount: number;
  inAppNotificationReadCount: number;
  inAppNotificationUnreadCountAtRangeEnd: number;
  inAppNotificationUnreadOver24hCountAtRangeEnd: number;
  averageInAppNotificationReadHours: number | null;
  lastWorkflowActionAt: string | null;
  rangeFrom: string;
  rangeTo: string;
}>;

export type UserOperationsMetricsQuery = Readonly<{
  from: string;
  to: string;
  projectId?: string;
  userId?: string;
}>;

export type UserOperationsMetricsSectionResult =
  | { status: "available"; data: readonly UserOperationsMetricDto[] }
  | { status: "unavailable"; code: "UNAVAILABLE" };

export type UserOperationsSortField =
  | "name"
  | "role"
  | "currentActiveTaskCount"
  | "unstartedTaskCountAtRangeEnd"
  | "inAppNotificationUnreadOver24hCountAtRangeEnd"
  | "averageAssignmentToStartHours"
  | "averageInAppNotificationReadHours"
  | "taskCompletedCount"
  | "deliverableReviewCount"
  | "lastWorkflowActionAt";

export type SortDirection = "asc" | "desc";
