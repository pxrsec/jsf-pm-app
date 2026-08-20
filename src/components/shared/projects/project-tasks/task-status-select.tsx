"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TASK_STATUS_MAP, type TaskStatus } from "@/lib/status-maps";
import { STATUS_TRANSLATION_KEYS } from "./task-status-badge";
import { transitionTaskStatusAction } from "@/lib/projects/task-actions";
import type { TaskType } from "@/lib/projects/queries";

const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ["in_progress", "blocked"],
  in_progress: ["in_review", "completed", "blocked"],
  in_review: ["in_progress", "completed", "blocked"],
  completed: ["in_progress"],
  blocked: ["pending", "in_progress"],
};

export function getAllowedNextStatuses(
  current: TaskStatus,
  taskType: TaskType,
): TaskStatus[] {
  const possible = [current, ...(VALID_TRANSITIONS[current] ?? [])];
  if (taskType === "client_request") {
    return possible.filter((s) => s !== "in_review");
  }
  return possible;
}

interface TaskStatusSelectProps {
  taskId: string;
  projectId: string;
  currentStatus: TaskStatus;
  taskType: TaskType;
  disabled?: boolean;
  onStatusChanged?: (newStatus: TaskStatus) => void;
}

export function TaskStatusSelect({
  taskId,
  projectId,
  currentStatus,
  taskType,
  disabled = false,
  onStatusChanged,
}: TaskStatusSelectProps) {
  const t = useTranslations("projects.tasks.taskStatus");
  const tErrors = useTranslations("projects.tasks.errors");
  const tStatusChange = useTranslations("projects.tasks.statusChange");
  const [status, setStatus] = useState<TaskStatus>(currentStatus);
  const [isPending, setIsPending] = useState(false);

  const allowedStatuses: TaskStatus[] = getAllowedNextStatuses(
    status,
    taskType,
  );

  const handleStatusChange = async (nextStatus: string | null) => {
    if (!nextStatus) return;
    const targetStatus = nextStatus as TaskStatus;
    if (targetStatus === status) return;

    if (taskType === "client_request" && targetStatus === "in_review") {
      toast.error(tStatusChange("clientRequestNoReview"));
      return;
    }

    const previousStatus = status;
    setStatus(targetStatus);
    setIsPending(true);

    try {
      const result = await transitionTaskStatusAction(taskId, projectId, {
        task_id: taskId,
        next_status: targetStatus,
      });

      if (!result.ok) {
        setStatus(previousStatus);
        const errorCode = result.error.code;
        if (errorCode === "UNAUTHORIZED") {
          toast.error(tErrors("unauthorized"));
        } else if (
          errorCode === "INVALID_TRANSITION" ||
          errorCode === "INVARIANT_VIOLATION"
        ) {
          toast.error(tErrors("invalidTransition"));
        } else if (errorCode === "NOT_FOUND") {
          toast.error(tErrors("notFound"));
        } else {
          toast.error(tStatusChange("errorToast"));
        }
      } else {
        const transKey = STATUS_TRANSLATION_KEYS[targetStatus] ?? "pending";
        toast.success(tStatusChange("successToast", { status: t(transKey) }));
        onStatusChanged?.(targetStatus);
      }
    } catch {
      setStatus(previousStatus);
      toast.error(tStatusChange("errorToast"));
    } finally {
      setIsPending(false);
    }
  };

  const currentTransKey = STATUS_TRANSLATION_KEYS[status] ?? "pending";

  return (
    <div className="inline-flex items-center gap-2">
      <Select
        value={status}
        onValueChange={handleStatusChange}
        disabled={disabled || isPending}
      >
        <SelectTrigger className="h-8 min-w-[140px] text-xs font-medium">
          {isPending ? (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              <span>{t(currentTransKey)}</span>
            </div>
          ) : (
            <SelectValue />
          )}
        </SelectTrigger>
        <SelectContent>
          {allowedStatuses.map((s: TaskStatus) => {
            const config = TASK_STATUS_MAP[s];
            const Icon = config.icon;
            const itemTransKey = STATUS_TRANSLATION_KEYS[s] ?? "pending";
            return (
              <SelectItem key={s} value={s} className="text-xs">
                <div className="flex items-center gap-2">
                  <Icon className="size-3.5" aria-hidden="true" />
                  <span>{t(itemTransKey)}</span>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
