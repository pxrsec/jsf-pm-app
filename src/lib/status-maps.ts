import type { LucideIcon } from "lucide-react";
import {
  Clock,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  Flag,
  CircleDot,
  ArrowRight,
  Send,
  ThumbsUp,
  RotateCcw,
  Truck,
  AlertCircle,
  ShieldCheck,
  User,
  UserCheck,
  Users,
} from "lucide-react";

// ── Project status ────────────────────────────────────────────────────────────

export type ProjectStatus =
  "planning" | "in_progress" | "paused" | "completed" | "cancelled";

export interface StatusConfig {
  badgeBg: string;
  badgeFg: string;
  icon: LucideIcon;
  labelKey: string;
}

export const PROJECT_STATUS_MAP: Record<ProjectStatus, StatusConfig> = {
  planning: {
    badgeBg: "bg-blue-100 dark:bg-blue-950/60",
    badgeFg: "text-blue-800 dark:text-blue-200",
    icon: Clock,
    labelKey: "planning",
  },
  in_progress: {
    badgeBg: "bg-yellow-100 dark:bg-yellow-950/60",
    badgeFg: "text-yellow-800 dark:text-yellow-200",
    icon: Play,
    labelKey: "inProgress",
  },
  paused: {
    badgeBg: "bg-muted",
    badgeFg: "text-muted-foreground",
    icon: Pause,
    labelKey: "paused",
  },
  completed: {
    badgeBg: "bg-green-100 dark:bg-green-950/60",
    badgeFg: "text-green-800 dark:text-green-200",
    icon: CheckCircle,
    labelKey: "completed",
  },
  cancelled: {
    badgeBg: "bg-red-100 dark:bg-red-950/60",
    badgeFg: "text-red-800 dark:text-red-200",
    icon: XCircle,
    labelKey: "cancelled",
  },
};

// ── Task status ───────────────────────────────────────────────────────────────

export type TaskStatus =
  "pending" | "in_progress" | "in_review" | "completed" | "blocked";

export const TASK_STATUS_MAP: Record<TaskStatus, StatusConfig> = {
  pending: {
    badgeBg: "bg-blue-100 dark:bg-blue-950/60",
    badgeFg: "text-blue-800 dark:text-blue-200",
    icon: Clock,
    labelKey: "taskStatus.pending",
  },
  in_progress: {
    badgeBg: "bg-indigo-100 dark:bg-indigo-950/60",
    badgeFg: "text-indigo-800 dark:text-indigo-200",
    icon: CircleDot,
    labelKey: "taskStatus.inProgress",
  },
  in_review: {
    badgeBg: "bg-purple-100 dark:bg-purple-950/60",
    badgeFg: "text-purple-800 dark:text-purple-200",
    icon: Eye,
    labelKey: "taskStatus.inReview",
  },
  completed: {
    badgeBg: "bg-green-100 dark:bg-green-950/60",
    badgeFg: "text-green-800 dark:text-green-200",
    icon: CheckCircle,
    labelKey: "taskStatus.completed",
  },
  blocked: {
    // IMPORTANT: blocked STATUS != blocking PRIORITY.
    // blocked = this task cannot proceed due to external blocker.
    // Uses AlertTriangle icon to distinguish from blocking priority (ShieldCheck).
    badgeBg: "bg-red-100 dark:bg-red-950/60",
    badgeFg: "text-red-800 dark:text-red-200",
    icon: AlertTriangle,
    labelKey: "taskStatus.blocked",
  },
};

// ── Task priority ─────────────────────────────────────────────────────────────

export type TaskPriority = "low" | "medium" | "high" | "blocking";

export const TASK_PRIORITY_MAP: Record<TaskPriority, StatusConfig> = {
  low: {
    badgeBg: "bg-green-100 dark:bg-green-950/60",
    badgeFg: "text-green-800 dark:text-green-200",
    icon: ArrowRight,
    labelKey: "priority.low",
  },
  medium: {
    badgeBg: "bg-yellow-100 dark:bg-yellow-950/60",
    badgeFg: "text-yellow-800 dark:text-yellow-200",
    icon: Flag,
    labelKey: "priority.medium",
  },
  high: {
    badgeBg: "bg-orange-100 dark:bg-orange-950/60",
    badgeFg: "text-orange-800 dark:text-orange-200",
    icon: AlertCircle,
    labelKey: "priority.high",
  },
  blocking: {
    // IMPORTANT: blocking PRIORITY != blocked STATUS.
    // blocking = this task blocks other work from proceeding.
    // Uses ShieldCheck icon and rose hue to distinguish from blocked status (AlertTriangle + red).
    badgeBg: "bg-rose-200 dark:bg-rose-950/80",
    badgeFg: "text-rose-900 dark:text-rose-100 font-semibold",
    icon: ShieldCheck,
    labelKey: "priority.blocking",
  },
};

// ── Deliverable lifecycle state ───────────────────────────────────────────────

export type DeliverableStatus =
  | "pending"
  | "awaiting_internal_review"
  | "awaiting_client_review"
  | "approved"
  | "changes_requested"
  | "delivered";

export const DELIVERABLE_STATUS_MAP: Record<DeliverableStatus, StatusConfig> = {
  pending: {
    badgeBg: "bg-blue-100 dark:bg-blue-950/60",
    badgeFg: "text-blue-800 dark:text-blue-200",
    icon: Clock,
    labelKey: "deliverableStatus.pending",
  },
  awaiting_internal_review: {
    badgeBg: "bg-indigo-100 dark:bg-indigo-950/60",
    badgeFg: "text-indigo-800 dark:text-indigo-200",
    icon: Eye,
    labelKey: "deliverableStatus.awaitingInternalReview",
  },
  awaiting_client_review: {
    badgeBg: "bg-purple-100 dark:bg-purple-950/60",
    badgeFg: "text-purple-800 dark:text-purple-200",
    icon: Send,
    labelKey: "deliverableStatus.awaitingClientReview",
  },
  approved: {
    badgeBg: "bg-green-100 dark:bg-green-950/60",
    badgeFg: "text-green-800 dark:text-green-200",
    icon: ThumbsUp,
    labelKey: "deliverableStatus.approved",
  },
  changes_requested: {
    badgeBg: "bg-orange-100 dark:bg-orange-950/60",
    badgeFg: "text-orange-800 dark:text-orange-200",
    icon: RotateCcw,
    labelKey: "deliverableStatus.changesRequested",
  },
  delivered: {
    badgeBg: "bg-teal-100 dark:bg-teal-950/60",
    badgeFg: "text-teal-800 dark:text-teal-200",
    icon: Truck,
    labelKey: "deliverableStatus.delivered",
  },
};

// ── Project membership capacity ───────────────────────────────────────────────

export type MemberCapacity = "pm_lead" | "pm_watcher" | "operator" | "client";

export interface CapacityConfig {
  icon: LucideIcon;
  labelKey: string;
}

export const MEMBER_CAPACITY_MAP: Record<MemberCapacity, CapacityConfig> = {
  pm_lead: { icon: UserCheck, labelKey: "capacity.pmLead" },
  pm_watcher: { icon: Eye, labelKey: "capacity.pmWatcher" },
  operator: { icon: User, labelKey: "capacity.operator" },
  client: { icon: Users, labelKey: "capacity.client" },
};
