"use client";

import { useTranslations } from "next-intl";
import { TASK_PRIORITY_MAP, type TaskPriority } from "@/lib/status-maps";
import { cn } from "@/lib/utils";

interface TaskPriorityBadgeProps {
  priority: TaskPriority;
  className?: string;
  showIcon?: boolean;
}

export function TaskPriorityBadge({
  priority,
  className,
  showIcon = true,
}: TaskPriorityBadgeProps) {
  const t = useTranslations("projects.tasks.priority");
  const config = TASK_PRIORITY_MAP[priority];

  if (!config) return null;

  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium shrink-0",
        config.badgeBg,
        config.badgeFg,
        className,
      )}
      role="status"
    >
      {showIcon && <Icon className="size-3.5 shrink-0" aria-hidden="true" />}
      <span>{t(priority)}</span>
    </span>
  );
}
