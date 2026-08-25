import { z } from "zod";
import type {
  NotificationDestination,
  RecipientInboxNotification,
  NotificationTrigger,
} from "./inbox-contracts";

export const NOTIFICATION_TRIGGERS = [
  "user_invited",
  "project_assigned",
  "task_assigned",
  "task_status_changed",
  "client_task_blocking",
  "client_submission_received",
  "client_submission_reopened",
  "deliverable_submitted",
  "internal_changes_requested",
  "internal_review_approved",
  "client_changes_requested",
  "client_review_approved",
  "deliverable_delivered",
  "deadline_24h",
  "deadline_12h",
  "deadline_6h",
  "deadline_overdue",
  "review_inactivity_reminder",
  "link_reported_broken",
  "invite_expiring",
  "system",
] as const satisfies readonly NotificationTrigger[];

export const MarkNotificationReadSchema = z
  .object({
    notificationRecipientId: z.string().uuid(),
  })
  .strict();

export type MarkNotificationReadInput = z.infer<
  typeof MarkNotificationReadSchema
>;

export const MarkAllNotificationsReadSchema = z.object({}).strict();

export type MarkAllNotificationsReadInput = z.infer<
  typeof MarkAllNotificationsReadSchema
>;

export const AcknowledgeNotificationNavigationSchema = z
  .object({
    notificationRecipientId: z.string().uuid(),
  })
  .strict();

export type AcknowledgeNotificationNavigationInput = z.infer<
  typeof AcknowledgeNotificationNavigationSchema
>;

export const NotificationReadFilterSchema = z.enum(["all", "unread", "read"]);

export const RecipientInboxQuerySchema = z
  .object({
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true }),
    readFilter: NotificationReadFilterSchema,
  })
  .strict()
  .refine(
    (data) => {
      const fromTime = new Date(data.from).getTime();
      const toTime = new Date(data.to).getTime();
      return fromTime < toTime && toTime - fromTime <= 93 * 24 * 60 * 60 * 1000;
    },
    {
      message:
        "Invalid notification date range (from must be < to and <= 93 days)",
    },
  );

export const RecipientInboxCursorSchema = z
  .object({
    beforeCreatedAt: z.string().datetime({ offset: true }),
    beforeRecipientId: z.string().uuid(),
  })
  .strict();

export const LoadRecipientInboxPageSchema = z
  .object({
    query: RecipientInboxQuerySchema,
    cursor: RecipientInboxCursorSchema.nullable().optional(),
  })
  .strict();

export type LoadRecipientInboxPageInput = z.infer<
  typeof LoadRecipientInboxPageSchema
>;

export const RawNotificationRpcRowSchema = z
  .object({
    recipient_id: z.string().uuid(),
    trigger: z.enum(NOTIFICATION_TRIGGERS),
    created_at: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid created_at timestamp",
    }),
    occurred_at: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: "Invalid occurred_at timestamp",
    }),
    read_at: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: "Invalid read_at timestamp",
      })
      .nullable()
      .optional(),
    subject_kind: z.enum([
      "project",
      "task",
      "deliverable",
      "invitation",
      "system",
    ]),
    subject_title: z.string().nullable().optional(),
    project_name: z.string().nullable().optional(),
    context_kind: z.enum(["none", "task_deadline"]),
    context_value: z.string().nullable().optional(),
    navigation_kind: z.enum([
      "none",
      "admin_project_tasks",
      "admin_project_deliverables",
      "admin_project_overview",
      "pm_project_tasks",
      "pm_project_deliverables",
      "pm_project_overview",
      "operator_task",
      "client_task",
      "client_deliverable_review",
      "client_project",
    ]),
    navigation_project_id: z.string().uuid().nullable().optional(),
    navigation_task_id: z.string().uuid().nullable().optional(),
    navigation_deliverable_id: z.string().uuid().nullable().optional(),
  })
  .strict();

export type RawNotificationRpcRow = z.infer<typeof RawNotificationRpcRowSchema>;

/**
 * Validates a raw RPC returned row against all S08-04 destination, context,
 * and timestamp invariants, failing closed if any field is invalid.
 */
export function parseAndValidateNotificationRow(
  raw: unknown,
): RecipientInboxNotification {
  const parsed = RawNotificationRpcRowSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Invalid notification row structure");
  }

  const row = parsed.data;

  // Validate context_kind / context_value invariants
  if (row.context_kind === "none" && row.context_value != null) {
    throw new Error("Non-null context_value with context_kind 'none'");
  }
  if (row.context_kind === "task_deadline") {
    if (!row.context_value || isNaN(Date.parse(row.context_value))) {
      throw new Error(
        "Invalid or missing task_deadline timestamp in context_value",
      );
    }
  }

  // Validate destination kind and ID invariants
  let destination: NotificationDestination;

  switch (row.navigation_kind) {
    case "none": {
      if (
        row.navigation_project_id != null ||
        row.navigation_task_id != null ||
        row.navigation_deliverable_id != null
      ) {
        throw new Error(
          "Navigation IDs present when navigation_kind is 'none'",
        );
      }
      destination = { kind: "none" };
      break;
    }
    case "admin_project_overview":
    case "admin_project_tasks":
    case "admin_project_deliverables":
    case "pm_project_overview":
    case "pm_project_tasks":
    case "pm_project_deliverables":
    case "client_project": {
      if (!row.navigation_project_id) {
        throw new Error(
          `Missing required projectId for ${row.navigation_kind}`,
        );
      }
      if (
        row.navigation_task_id != null ||
        row.navigation_deliverable_id != null
      ) {
        throw new Error(
          `Unexpected task or deliverable ID for ${row.navigation_kind}`,
        );
      }
      destination = {
        kind: row.navigation_kind,
        projectId: row.navigation_project_id,
      };
      break;
    }
    case "operator_task":
    case "client_task": {
      if (!row.navigation_task_id) {
        throw new Error(`Missing required taskId for ${row.navigation_kind}`);
      }
      if (
        row.navigation_project_id != null ||
        row.navigation_deliverable_id != null
      ) {
        throw new Error(
          `Unexpected project or deliverable ID for ${row.navigation_kind}`,
        );
      }
      destination = {
        kind: row.navigation_kind,
        taskId: row.navigation_task_id,
      };
      break;
    }
    case "client_deliverable_review": {
      if (!row.navigation_deliverable_id) {
        throw new Error(
          `Missing required deliverableId for ${row.navigation_kind}`,
        );
      }
      if (row.navigation_project_id != null || row.navigation_task_id != null) {
        throw new Error(
          `Unexpected project or task ID for ${row.navigation_kind}`,
        );
      }
      destination = {
        kind: "client_deliverable_review",
        deliverableId: row.navigation_deliverable_id,
      };
      break;
    }
  }

  return {
    recipientId: row.recipient_id,
    trigger: row.trigger,
    createdAt: row.created_at,
    occurredAt: row.occurred_at,
    readAt: row.read_at ?? null,
    subjectKind: row.subject_kind,
    subjectTitle: row.subject_title ?? null,
    projectName: row.project_name ?? null,
    contextKind: row.context_kind,
    contextValue: row.context_value ?? null,
    destination,
  };
}
