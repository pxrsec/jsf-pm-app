import type { NotificationTrigger } from "@/lib/notifications/inbox-contracts";

export type NotificationCategoryKey =
  | "invitation"
  | "projectAssignment"
  | "taskAssignment"
  | "taskStatusChanged"
  | "clientTaskBlocking"
  | "clientSubmission"
  | "deliverableSubmitted"
  | "changesRequested"
  | "reviewApproved"
  | "deliverableDelivered"
  | "deadlineReminder"
  | "deadlineOverdue"
  | "reviewInactivityReminder"
  | "linkReportedBroken"
  | "system";

export const NOTIFICATION_TRIGGER_TO_CATEGORY_MAP = {
  user_invited: "invitation",
  invite_expiring: "invitation",
  project_assigned: "projectAssignment",
  task_assigned: "taskAssignment",
  task_status_changed: "taskStatusChanged",
  client_task_blocking: "clientTaskBlocking",
  client_submission_received: "clientSubmission",
  client_submission_reopened: "clientSubmission",
  deliverable_submitted: "deliverableSubmitted",
  internal_changes_requested: "changesRequested",
  client_changes_requested: "changesRequested",
  internal_review_approved: "reviewApproved",
  client_review_approved: "reviewApproved",
  deliverable_delivered: "deliverableDelivered",
  deadline_24h: "deadlineReminder",
  deadline_12h: "deadlineReminder",
  deadline_6h: "deadlineReminder",
  deadline_overdue: "deadlineOverdue",
  review_inactivity_reminder: "reviewInactivityReminder",
  link_reported_broken: "linkReportedBroken",
  system: "system",
} as const satisfies Record<NotificationTrigger, NotificationCategoryKey>;

/**
 * Resolves a database notification trigger enum to its localized category key,
 * safely defaulting to "system" for unknown or future triggers.
 */
export function resolveNotificationCategory(
  trigger: string,
): NotificationCategoryKey {
  if (trigger in NOTIFICATION_TRIGGER_TO_CATEGORY_MAP) {
    return NOTIFICATION_TRIGGER_TO_CATEGORY_MAP[trigger as NotificationTrigger];
  }
  return "system";
}
