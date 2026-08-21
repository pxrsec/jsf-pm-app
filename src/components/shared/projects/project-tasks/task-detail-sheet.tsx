"use client";

import { useTranslations } from "next-intl";
import { format, isPast, isToday } from "date-fns";
import { Calendar, Edit2, Paperclip, User } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TaskStatusBadge } from "./task-status-badge";
import { TaskPriorityBadge } from "./task-priority-badge";
import { TaskStatusSelect } from "./task-status-select";
import { TaskCommentsSection } from "./task-comments-section";
import type {
  ProjectDetail,
  TaskStatus,
  TaskWithAssignee,
} from "@/lib/projects/queries";
import { cn } from "@/lib/utils";

interface TaskDetailSheetProps {
  task: TaskWithAssignee | null;
  project: ProjectDetail;
  effectiveCapacity: "admin" | "pm_lead" | "pm_watcher";
  isOpen: boolean;
  onClose: () => void;
  onEditClick: () => void;
  onStatusChanged: (newStatus: TaskStatus) => void;
}

export function TaskDetailSheet({
  task,
  project,
  effectiveCapacity,
  isOpen,
  onClose,
  onEditClick,
  onStatusChanged,
}: TaskDetailSheetProps) {
  const t = useTranslations("projects.tasks.detail");
  const tType = useTranslations("projects.tasks.taskType");
  const tTasks = useTranslations("projects.tasks");

  if (!task) return null;

  const isWatcher = effectiveCapacity === "pm_watcher";
  const deadlineDate = task.deadline_at ? new Date(task.deadline_at) : null;
  const isOverdue =
    deadlineDate && isPast(deadlineDate) && task.status !== "completed";
  const isDueToday = deadlineDate && isToday(deadlineDate);
  const typeKey =
    task.task_type === "internal_work" ? "internalWork" : "clientRequest";

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[540px] p-0 flex flex-col h-full bg-background"
        aria-label={t("ariaLabel", { title: task.title })}
      >
        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Header */}
          <SheetHeader className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <TaskStatusBadge status={task.status} />
                <TaskPriorityBadge priority={task.priority} />
                <Badge variant="outline" className="text-[11px] font-normal">
                  {tType(typeKey)}
                </Badge>
              </div>

              {!isWatcher && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onEditClick}
                  className="h-8 text-xs gap-1.5 shrink-0"
                >
                  <Edit2 className="size-3.5" />
                  <span>{t("editAction")}</span>
                </Button>
              )}
            </div>

            <SheetTitle className="text-lg sm:text-xl font-bold text-foreground text-left leading-snug">
              {task.title}
            </SheetTitle>
          </SheetHeader>

          {/* Meta Details Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3.5 bg-muted/30 rounded-lg border border-border/60 text-xs">
            {/* Assignee */}
            <div className="space-y-1">
              <span className="text-muted-foreground font-medium">
                {t("assignedTo")}
              </span>
              <div className="flex items-center gap-2 pt-0.5">
                <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 font-semibold text-primary">
                  {task.assignee?.full_name?.charAt(0) ?? (
                    <User className="size-3" />
                  )}
                </div>
                <span className="font-medium text-foreground truncate">
                  {task.assignee?.full_name ?? "Sin asignar"}
                </span>
              </div>
            </div>

            {/* Deadline */}
            <div className="space-y-1">
              <span className="text-muted-foreground font-medium">
                {t("deadline")}
              </span>
              <div className="flex items-center gap-1.5 pt-0.5">
                <Calendar
                  className={cn(
                    "size-3.5 shrink-0",
                    isOverdue
                      ? "text-destructive"
                      : isDueToday
                        ? "text-orange-500"
                        : "text-muted-foreground",
                  )}
                />
                <span
                  className={cn(
                    "font-medium",
                    isOverdue
                      ? "text-destructive font-semibold"
                      : isDueToday
                        ? "text-orange-600 dark:text-orange-400 font-semibold"
                        : "text-foreground",
                  )}
                >
                  {deadlineDate
                    ? format(deadlineDate, "PPp")
                    : "Sin fecha límite"}
                </span>
                {isOverdue && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-destructive/10 text-destructive font-bold">
                    {tTasks("overdue")}
                  </span>
                )}
                {isDueToday && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 font-bold">
                    {tTasks("dueToday")}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Status Machine Select (Hidden for Watcher) */}
          {!isWatcher && (
            <div className="space-y-2 p-3 bg-muted/20 rounded-lg border border-border/50">
              <span className="text-xs font-semibold text-foreground">
                {t("statusLabel")}
              </span>
              <div>
                <TaskStatusSelect
                  taskId={task.id}
                  projectId={project.id}
                  currentStatus={task.status}
                  taskType={task.task_type}
                  onStatusChanged={onStatusChanged}
                />
              </div>
            </div>
          )}

          {/* Deliverables Flag */}
          {task.has_deliverables && (
            <div className="flex items-center gap-2 p-2.5 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/50 dark:border-indigo-800/40 rounded-lg text-xs text-indigo-900 dark:text-indigo-200">
              <Paperclip className="size-4 shrink-0" />
              <span>{t("hasDeliverables")}</span>
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t("description")}
            </h4>
            <div className="p-3 bg-muted/20 rounded-md border border-border/40 text-xs sm:text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {task.description || "Sin descripción proporcionada."}
            </div>
          </div>

          <Separator />

          {/* Collaboration Comments */}
          <TaskCommentsSection
            projectId={project.id}
            taskId={task.id}
            effectiveCapacity={effectiveCapacity}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
