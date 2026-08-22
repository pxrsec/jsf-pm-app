import type { Database, Json } from "@/lib/database.types";

export type ProjectStatus = Database["public"]["Enums"]["project_status"];
export type TaskStatus = Database["public"]["Enums"]["task_status"];
export type TaskPriority = Database["public"]["Enums"]["task_priority"];
export type DeliverableStatus =
  Database["public"]["Enums"]["deliverable_status"];
export type SubmissionProvider =
  Database["public"]["Enums"]["submission_provider"];
export type ReviewDecision = Database["public"]["Enums"]["review_decision"];
export type ReviewStage = Database["public"]["Enums"]["review_stage"];

export interface ClientTaskResource {
  name: string;
  url: string;
  type?: string;
}

export interface ClientProjectListItem {
  id: string;
  name: string;
  status: ProjectStatus;
  client_scope: string | null;
  deadline_at: string | null;
  last_deliverable_activity_at: string | null;
}

export interface ClientSubmissionRequirementSummary {
  id: string;
  task_id: string;
  task_title: string | null;
  project_id: string;
  project_name: string | null;
  title: string;
  specifications: string | null;
  submission_deadline_at: string | null;
  status: DeliverableStatus;
  current_version_number: number | null;
  current_submission_provider: SubmissionProvider | null;
  current_submission_url: string | null;
  current_submission_note: string | null;
  current_submitted_at: string | null;
}

export type ReadinessStatus =
  | "no_requirements"
  | "all_submitted"
  | "pending_submissions"
  | "unexpected_state";

export interface ClientRequestReadinessSummary {
  status: ReadinessStatus;
  pendingCount: number;
  totalCount: number;
}

export interface ClientRequestQueueItem {
  id: string;
  project_id: string;
  project_name: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  deadline_at: string | null;
  child_submission_count: number;
  started_at: string | null;
  completed_at: string | null;
}

export interface ClientRequestDetail {
  id: string;
  project_id: string;
  project_name: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  deadline_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  resources: ClientTaskResource[];
  childSubmissions: ClientSubmissionRequirementSummary[];
  readinessSummary: ClientRequestReadinessSummary;
}

export interface ClientProductionReviewQueueItem {
  id: string;
  project_id: string;
  project_name: string | null;
  title: string;
  specifications: string | null;
  status: DeliverableStatus;
  current_version_number: number | null;
  current_submission_url: string | null;
  current_submission_provider: SubmissionProvider | null;
  client_delivery_deadline_at: string | null;
  approved_at: string | null;
  delivered_at: string | null;
}

export interface ClientStageFeedbackItem {
  decision: ReviewDecision;
  comments: string | null;
  reviewedAt: string;
}

export type FeedbackParseResult =
  | { ok: true; items: ClientStageFeedbackItem[] }
  | { ok: false; reason: "malformed_json" };

export interface ClientProductionReviewDetail {
  id: string;
  project_id: string;
  project_name: string | null;
  title: string;
  specifications: string | null;
  status: DeliverableStatus;
  current_version_number: number | null;
  current_submission_url: string | null;
  current_submission_provider: SubmissionProvider | null;
  current_submission_note: string | null;
  current_submitted_at: string | null;
  client_delivery_deadline_at: string | null;
  approved_at: string | null;
  delivered_at: string | null;
  feedbackResult: FeedbackParseResult;
}

export interface ClientProjectDetail {
  project: ClientProjectListItem;
  directRequests: ClientRequestQueueItem[];
  directSubmissions: ClientSubmissionRequirementSummary[];
  releasedProductionReviews: ClientProductionReviewQueueItem[];
}

export interface ClientRequestTransitionTarget {
  id: string;
  projectId: string;
  status: TaskStatus;
  childSubmissionCount: number;
}

export interface ClientProductionReviewTarget {
  id: string;
  projectId: string;
  status: DeliverableStatus;
  currentVersionNumber: number | null;
}

export const CLIENT_ERROR_KEY_BY_CODE = {
  VALIDATION_FAILED: "validationFailed",
  UNAUTHORIZED: "unauthorized",
  NOT_FOUND: "notFound",
  INVALID_TRANSITION: "invalidTransition",
  CONFLICT: "conflict",
  INVARIANT_VIOLATION: "invariantViolation",
  UNKNOWN: "generic",
} as const;

export type ClientErrorCode = keyof typeof CLIENT_ERROR_KEY_BY_CODE;

export function parseTaskResources(raw: Json | null): ClientTaskResource[] {
  if (!raw) return [];
  if (!Array.isArray(raw)) return [];
  const resources: ClientTaskResource[] = [];
  for (const item of raw) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      const rec = item as Record<string, unknown>;
      if (typeof rec.name === "string" && typeof rec.url === "string") {
        resources.push({
          name: rec.name,
          url: rec.url,
          type: typeof rec.type === "string" ? rec.type : undefined,
        });
      }
    }
  }
  return resources;
}

export function parseClientFeedbackHistory(
  raw: Json | null | unknown,
): FeedbackParseResult {
  if (raw === null || raw === undefined) {
    return { ok: true, items: [] };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, reason: "malformed_json" };
  }
  if (raw.length === 0) {
    return { ok: true, items: [] };
  }

  const items: ClientStageFeedbackItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return { ok: false, reason: "malformed_json" };
    }
    const rec = entry as Record<string, unknown>;
    const decision = rec.decision;
    if (decision !== "approved" && decision !== "changes_requested") {
      return { ok: false, reason: "malformed_json" };
    }
    if (typeof rec.reviewed_at !== "string") {
      return { ok: false, reason: "malformed_json" };
    }
    const comments =
      typeof rec.comments === "string"
        ? rec.comments
        : rec.comments === null || rec.comments === undefined
          ? null
          : null;

    items.push({
      decision,
      comments,
      reviewedAt: rec.reviewed_at,
    });
  }

  return { ok: true, items };
}

export function computeClientRequestReadiness(
  submissions: ClientSubmissionRequirementSummary[],
): ClientRequestReadinessSummary {
  if (submissions.length === 0) {
    return {
      status: "no_requirements",
      pendingCount: 0,
      totalCount: 0,
    };
  }

  let pendingCount = 0;
  let unexpected = false;

  for (const sub of submissions) {
    if (sub.status === "submitted") {
      // Completed / submitted child
    } else if (sub.status === "pending") {
      pendingCount++;
    } else {
      unexpected = true;
    }
  }

  if (unexpected) {
    return {
      status: "unexpected_state",
      pendingCount,
      totalCount: submissions.length,
    };
  }

  if (pendingCount > 0) {
    return {
      status: "pending_submissions",
      pendingCount,
      totalCount: submissions.length,
    };
  }

  return {
    status: "all_submitted",
    pendingCount: 0,
    totalCount: submissions.length,
  };
}

const compareDatesAsc = (a: string | null, b: string | null): number =>
  !a && !b
    ? 0
    : !a
      ? 1
      : !b
        ? -1
        : new Date(a).getTime() - new Date(b).getTime();

const compareDatesDesc = (a: string | null, b: string | null): number =>
  !a && !b
    ? 0
    : !a
      ? 1
      : !b
        ? -1
        : new Date(b).getTime() - new Date(a).getTime();

const PROJECT_STATUS_RANK: Record<ProjectStatus, number> = {
  in_progress: 1,
  planning: 2,
  paused: 3,
  completed: 4,
  cancelled: 5,
};

export function sortClientProjects(
  items: ClientProjectListItem[],
): ClientProjectListItem[] {
  return [...items].sort((a, b) => {
    const rankDiff =
      (PROJECT_STATUS_RANK[a.status] ?? 99) -
      (PROJECT_STATUS_RANK[b.status] ?? 99);
    if (rankDiff !== 0) return rankDiff;

    const deadlineDiff = compareDatesAsc(a.deadline_at, b.deadline_at);
    if (deadlineDiff !== 0) return deadlineDiff;

    const nameDiff = a.name.localeCompare(b.name);
    if (nameDiff !== 0) return nameDiff;

    return a.id.localeCompare(b.id);
  });
}

const PRIORITY_RANK: Record<TaskPriority, number> = {
  blocking: 1,
  high: 2,
  medium: 3,
  low: 4,
};

export function sortClientRequests(
  items: ClientRequestQueueItem[],
): ClientRequestQueueItem[] {
  const now = new Date().getTime();

  return [...items].sort((a, b) => {
    const aCompleted = a.status === "completed";
    const bCompleted = b.status === "completed";

    if (aCompleted && !bCompleted) return 1;
    if (!aCompleted && bCompleted) return -1;

    if (aCompleted && bCompleted) {
      const compDiff = compareDatesDesc(a.completed_at, b.completed_at);
      if (compDiff !== 0) return compDiff;
      return a.id.localeCompare(b.id);
    }

    // Both active
    const aOverdue =
      a.deadline_at && new Date(a.deadline_at).getTime() < now ? 1 : 0;
    const bOverdue =
      b.deadline_at && new Date(b.deadline_at).getTime() < now ? 1 : 0;

    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    if (aOverdue && bOverdue) {
      const overdueDiff = compareDatesAsc(a.deadline_at, b.deadline_at);
      if (overdueDiff !== 0) return overdueDiff;
    }

    const priorityDiff =
      (PRIORITY_RANK[a.priority] ?? 99) - (PRIORITY_RANK[b.priority] ?? 99);
    if (priorityDiff !== 0) return priorityDiff;

    const deadlineDiff = compareDatesAsc(a.deadline_at, b.deadline_at);
    if (deadlineDiff !== 0) return deadlineDiff;

    return a.id.localeCompare(b.id);
  });
}

export function sortClientReviews(
  items: ClientProductionReviewQueueItem[],
): ClientProductionReviewQueueItem[] {
  return [...items].sort((a, b) => {
    const aAwaiting = a.status === "awaiting_client_review";
    const bAwaiting = b.status === "awaiting_client_review";

    if (aAwaiting && !bAwaiting) return -1;
    if (!aAwaiting && bAwaiting) return 1;

    if (aAwaiting && bAwaiting) {
      const deadlineDiff = compareDatesAsc(
        a.client_delivery_deadline_at,
        b.client_delivery_deadline_at,
      );
      if (deadlineDiff !== 0) return deadlineDiff;
      return a.id.localeCompare(b.id);
    }

    const dateDiff = compareDatesDesc(
      a.approved_at ?? a.delivered_at,
      b.approved_at ?? b.delivered_at,
    );
    if (dateDiff !== 0) return dateDiff;

    return a.id.localeCompare(b.id);
  });
}
