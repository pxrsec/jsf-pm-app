import type {
  ClientProjectListItem,
  ClientRequestQueueItem,
  ClientProductionReviewQueueItem,
  ProjectStatus,
  TaskPriority,
} from "./types";

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
