import type { Database } from "@/lib/database.types";

export type NotificationTrigger =
  Database["public"]["Enums"]["notification_trigger"];

export type NotificationReadFilter = "all" | "unread" | "read";

export type NotificationDestination =
  | Readonly<{ kind: "none" }>
  | Readonly<{
      kind: "admin_project_tasks";
      projectId: string;
      taskId?: string;
    }>
  | Readonly<{ kind: "admin_project_deliverables"; projectId: string }>
  | Readonly<{ kind: "admin_project_overview"; projectId: string }>
  | Readonly<{ kind: "pm_project_tasks"; projectId: string; taskId?: string }>
  | Readonly<{ kind: "pm_project_deliverables"; projectId: string }>
  | Readonly<{ kind: "pm_project_overview"; projectId: string }>
  | Readonly<{ kind: "operator_task"; taskId: string }>
  | Readonly<{ kind: "client_task"; taskId: string }>
  | Readonly<{ kind: "client_deliverable_review"; deliverableId: string }>
  | Readonly<{ kind: "client_project"; projectId: string }>;

export type RecipientInboxNotification = Readonly<{
  recipientId: string;
  trigger: NotificationTrigger;
  createdAt: string;
  occurredAt: string;
  readAt: string | null;
  subjectKind: "project" | "task" | "deliverable" | "invitation" | "system";
  subjectTitle: string | null;
  projectName: string | null;
  contextKind: "none" | "task_deadline";
  contextValue: string | null;
  destination: NotificationDestination;
}>;

export type RecipientInboxCursor = Readonly<{
  beforeCreatedAt: string;
  beforeRecipientId: string;
}>;

export type RecipientInboxPage = Readonly<{
  notifications: readonly RecipientInboxNotification[];
  nextCursor: RecipientInboxCursor | null;
  hasMore: boolean;
}>;

export type RecipientInboxQuery = Readonly<{
  from: string;
  to: string;
  readFilter: NotificationReadFilter;
}>;
