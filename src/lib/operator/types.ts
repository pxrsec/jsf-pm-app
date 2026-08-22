import type { Database } from "@/lib/database.types";

export const OPERATOR_URGENCY_CATEGORIES = [
  "new",
  "normal",
  "upcoming",
  "urgent",
  "overdue",
  "completed",
] as const;

export type OperatorUrgencyCategory =
  (typeof OPERATOR_URGENCY_CATEGORIES)[number];

type AgendaViewRow = Database["public"]["Views"]["operator_agenda_view"]["Row"];

export type AgendaSelectRow = Pick<
  AgendaViewRow,
  | "task_id"
  | "task_title"
  | "task_description"
  | "task_status"
  | "task_priority"
  | "task_started_at"
  | "task_deadline_at"
  | "assigned_at"
  | "urgency_category"
  | "project_id"
  | "project_name"
  | "deliverable_id"
  | "deliverable_title"
  | "deliverable_status"
  | "deliverable_workflow_type"
  | "current_version_number"
  | "internal_review_deadline_at"
  | "client_delivery_deadline_at"
>;

export type TaskDetailSelectRow = Pick<
  AgendaViewRow,
  | "task_id"
  | "project_id"
  | "project_name"
  | "task_title"
  | "task_description"
  | "task_status"
  | "task_priority"
  | "task_deadline_at"
  | "task_started_at"
  | "assigned_at"
  | "urgency_category"
  | "task_resources"
  | "deliverable_id"
  | "deliverable_title"
  | "deliverable_status"
  | "deliverable_workflow_type"
  | "current_version_number"
  | "deliverable_specifications"
  | "submission_deadline_at"
  | "internal_review_deadline_at"
  | "client_delivery_deadline_at"
>;

export interface OperatorDeliverableSummary {
  deliverableId: string;
  deliverableTitle: string;
  deliverableStatus: Database["public"]["Enums"]["deliverable_status"] | null;
  deliverableWorkflowType:
    Database["public"]["Enums"]["deliverable_workflow_type"] | null;
  currentVersionNumber: number | null;
  internalReviewDeadlineAt: string | null;
  clientDeliveryDeadlineAt: string | null;
}

export interface OperatorTaskResource {
  id: string;
  name: string;
  url: string;
  sortOrder: number;
}

export interface OperatorTaskDeliverableDetail {
  deliverableId: string;
  deliverableTitle: string;
  deliverableStatus: Database["public"]["Enums"]["deliverable_status"] | null;
  deliverableWorkflowType:
    Database["public"]["Enums"]["deliverable_workflow_type"] | null;
  currentVersionNumber: number | null;
  deliverableSpecifications: string | null;
  submissionDeadlineAt: string | null;
  internalReviewDeadlineAt: string | null;
  clientDeliveryDeadlineAt: string | null;
}

export interface OperatorTaskDetail {
  taskId: string;
  taskTitle: string;
  taskDescription: string | null;
  taskStatus: Database["public"]["Enums"]["task_status"];
  taskPriority: Database["public"]["Enums"]["task_priority"];
  taskStartedAt: string | null;
  taskDeadlineAt: string | null;
  assignedAt: string | null;
  urgencyCategory: OperatorUrgencyCategory;
  projectId: string;
  projectName: string;
  resources: OperatorTaskResource[];
  deliverables: OperatorTaskDeliverableDetail[];
}

export interface OperatorDeliverableForSubmission {
  taskId: string;
  projectId: string;
  deliverableId: string;
  deliverableTitle: string;
  deliverableWorkflowType:
    Database["public"]["Enums"]["deliverable_workflow_type"] | null;
  deliverableStatus: Database["public"]["Enums"]["deliverable_status"] | null;
}

export interface OperatorAgendaItem {
  taskId: string;
  taskTitle: string;
  taskDescription: string | null;
  taskStatus: Database["public"]["Enums"]["task_status"];
  taskPriority: Database["public"]["Enums"]["task_priority"];
  taskStartedAt: string | null;
  taskDeadlineAt: string | null;
  assignedAt: string | null;
  urgencyCategory: OperatorUrgencyCategory;
  projectId: string;
  projectName: string;
  deliverables: OperatorDeliverableSummary[];
}

export interface OperatorOwnWorkProject {
  projectId: string;
  projectName: string;
  ownTaskCount: number;
  activeTaskCount: number;
  completedTaskCount: number;
  nearestDeadline: string | null;
  urgencyCategories: OperatorUrgencyCategory[];
}

export interface OperatorOwnWorkProjectDetail {
  projectId: string;
  projectName: string;
  tasks: OperatorAgendaItem[];
}

export const OPERATOR_DELIVERABLE_STATUS_KEYS: Record<string, string> = {
  pending: "pending",
  awaiting_internal_review: "awaitingInternalReview",
  awaiting_client_review: "awaitingClientReview",
  approved: "approved",
  changes_requested: "changesRequested",
  delivered: "delivered",
  submitted: "awaitingInternalReview",
};

export const OPERATOR_TASK_STATUS_KEYS: Record<string, string> = {
  pending: "pending",
  in_progress: "inProgress",
  in_review: "inReview",
  completed: "completed",
  blocked: "blocked",
};
