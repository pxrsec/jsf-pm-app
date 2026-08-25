import type {
  NotificationTrigger,
  RecipientInboxNotification,
} from "@/lib/notifications/inbox-contracts";

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

/**
 * Pure helper that formats the event-specific localized sentence for an inbox notification row.
 * Interpolates substantive subject title and project name when safely available.
 */
export function formatNotificationSentence(
  notification: RecipientInboxNotification,
  t: (key: string, params?: Record<string, string>) => string,
): string {
  const { trigger, subjectTitle, projectName } = notification;

  switch (trigger) {
    case "user_invited":
      return t("sentences.user_invited");
    case "invite_expiring":
      return t("sentences.invite_expiring");
    case "project_assigned":
      return projectName
        ? t("sentences.project_assigned", { projectName })
        : t("sentences.project_assigned_fallback");
    case "task_assigned":
      return subjectTitle && projectName
        ? t("sentences.task_assigned", {
            taskTitle: subjectTitle,
            projectName,
          })
        : t("sentences.task_assigned_fallback");
    case "task_status_changed":
      return subjectTitle && projectName
        ? t("sentences.task_status_changed", {
            taskTitle: subjectTitle,
            projectName,
          })
        : t("sentences.task_status_changed_fallback");
    case "client_task_blocking":
      return subjectTitle && projectName
        ? t("sentences.client_task_blocking", {
            taskTitle: subjectTitle,
            projectName,
          })
        : t("sentences.client_task_blocking_fallback");
    case "client_submission_received":
      return subjectTitle && projectName
        ? t("sentences.client_submission_received", {
            deliverableTitle: subjectTitle,
            projectName,
          })
        : t("sentences.client_submission_received_fallback");
    case "client_submission_reopened":
      return subjectTitle && projectName
        ? t("sentences.client_submission_reopened", {
            deliverableTitle: subjectTitle,
            projectName,
          })
        : t("sentences.client_submission_reopened_fallback");
    case "deliverable_submitted":
      return subjectTitle && projectName
        ? t("sentences.deliverable_submitted", {
            deliverableTitle: subjectTitle,
            projectName,
          })
        : t("sentences.deliverable_submitted_fallback");
    case "internal_changes_requested":
      return subjectTitle && projectName
        ? t("sentences.internal_changes_requested", {
            deliverableTitle: subjectTitle,
            projectName,
          })
        : t("sentences.internal_changes_requested_fallback");
    case "internal_review_approved":
      return subjectTitle && projectName
        ? t("sentences.internal_review_approved", {
            deliverableTitle: subjectTitle,
            projectName,
          })
        : t("sentences.internal_review_approved_fallback");
    case "client_changes_requested":
      return subjectTitle && projectName
        ? t("sentences.client_changes_requested", {
            deliverableTitle: subjectTitle,
            projectName,
          })
        : t("sentences.client_changes_requested_fallback");
    case "client_review_approved":
      return subjectTitle && projectName
        ? t("sentences.client_review_approved", {
            deliverableTitle: subjectTitle,
            projectName,
          })
        : t("sentences.client_review_approved_fallback");
    case "deliverable_delivered":
      return subjectTitle && projectName
        ? t("sentences.deliverable_delivered", {
            deliverableTitle: subjectTitle,
            projectName,
          })
        : t("sentences.deliverable_delivered_fallback");
    case "deadline_24h":
      return subjectTitle && projectName
        ? t("sentences.deadline_24h", {
            taskTitle: subjectTitle,
            projectName,
          })
        : t("sentences.deadline_24h_fallback");
    case "deadline_12h":
      return subjectTitle && projectName
        ? t("sentences.deadline_12h", {
            taskTitle: subjectTitle,
            projectName,
          })
        : t("sentences.deadline_12h_fallback");
    case "deadline_6h":
      return subjectTitle && projectName
        ? t("sentences.deadline_6h", {
            taskTitle: subjectTitle,
            projectName,
          })
        : t("sentences.deadline_6h_fallback");
    case "deadline_overdue":
      return subjectTitle && projectName
        ? t("sentences.deadline_overdue", {
            taskTitle: subjectTitle,
            projectName,
          })
        : t("sentences.deadline_overdue_fallback");
    case "review_inactivity_reminder":
      return subjectTitle && projectName
        ? t("sentences.review_inactivity_reminder", {
            deliverableTitle: subjectTitle,
            projectName,
          })
        : t("sentences.review_inactivity_reminder_fallback");
    case "link_reported_broken":
      return subjectTitle && projectName
        ? t("sentences.link_reported_broken", {
            deliverableTitle: subjectTitle,
            projectName,
          })
        : t("sentences.link_reported_broken_fallback");
    case "system":
      return projectName
        ? t("sentences.system", { projectName })
        : t("sentences.system_fallback");
    default:
      return t("sentences.genericHistoricalFallback");
  }
}

/**
 * Returns an accessible aria-label for the primary detail action button or link.
 */
export function formatNotificationDetailAriaLabel(
  notification: RecipientInboxNotification,
  categoryTitle: string,
  t: (key: string, params?: Record<string, string>) => string,
): string {
  const { subjectTitle, projectName } = notification;

  if (subjectTitle && projectName) {
    return t("viewDetailsAria", {
      category: categoryTitle,
      subject: subjectTitle,
      project: projectName,
    });
  }

  if (subjectTitle) {
    return t("viewDetailsAriaNoProject", {
      category: categoryTitle,
      subject: subjectTitle,
    });
  }

  return t("viewDetailsAriaGeneric", {
    category: categoryTitle,
  });
}
