"use client";

import { useTranslations } from "next-intl";
import { TASK_STATUS_MAP, type TaskStatus } from "@/lib/status-maps";
import { cn } from "@/lib/utils";

interface TaskStatusBadgeProps {
  status: TaskStatus;
  className?: string;
  showIcon?: boolean;
}

export const STATUS_TRANSLATION_KEYS: Record<
  TaskStatus,
  "pending" | "inProgress" | "inReview" | "completed" | "blocked"
> = {
  pending: "pending",
  in_progress: "inProgress",
  in_review: "inReview",
  completed: "completed",
  blocked: "blocked",
};

export function TaskStatusBadge({
  status,
  className,
  showIcon = true,
}: TaskStatusBadgeProps) {
  const t = useTranslations("projects.tasks.taskStatus");
  const config = TASK_STATUS_MAP[status];

  if (!config) return null;

  const Icon = config.icon;
  const translationKey = STATUS_TRANSLATION_KEYS[status] ?? "pending";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0",
        config.badgeBg,
        config.badgeFg,
        className,
      )}
      role="status"
    >
      {showIcon && <Icon className="size-3.5 shrink-0" aria-hidden="true" />}
      <span>{t(translationKey)}</span>
    </span>
  );
}
