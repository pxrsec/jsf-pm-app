import type { Database } from "@/lib/database.types";

export type ProjectStatus = Database["public"]["Enums"]["project_status"];
export type DeliverableStatus =
  Database["public"]["Enums"]["deliverable_status"];

export type ProjectStatusDistribution = Readonly<Record<ProjectStatus, number>>;
export type DeliverableStatusDistribution = Readonly<
  Record<DeliverableStatus, number>
>;

export type OperationsMetricsSummaryDto = Readonly<{
  projectCountsByStatus: ProjectStatusDistribution;
  activeTaskCount: number;
  overdueTaskCount: number;
  deadlineAttentionCount: number;
  productionDeliverableCountsByStatus: DeliverableStatusDistribution;
  finalizedDeliverableCount: number;
  clientReviewCycleCount: number;
  averageClientReviewHours: number | null;
  completionCycleCount: number;
  reopeningCycleCount: number;
  averageCompletionCycleDurationDays: number | null;
  unreadInAppQueueCount: number | null;
  suppressedExternalQueueCount: number | null;
  unresolvedLinkReportCount: number;
  rangeFrom: string;
  rangeTo: string;
}>;

export type OperationsMetricTrendPointDto = Readonly<{
  periodStart: string;
  periodEnd: string;
  finalizedDeliverableCount: number;
  clientReviewCycleCount: number;
  completionCycleCount: number;
  reopeningCycleCount: number;
}>;

export type OperationsMetricsQuery = Readonly<{
  from: string;
  to: string;
  projectId?: string;
}>;

export type OperationsMetricsSectionResult<T> =
  | { status: "available"; data: T }
  | { status: "unavailable"; code: "UNAVAILABLE" };
