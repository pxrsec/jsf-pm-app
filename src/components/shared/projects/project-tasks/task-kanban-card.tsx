"use client";

import { useTranslations } from "next-intl";
import { format, isPast } from "date-fns";
import { Draggable } from "@hello-pangea/dnd";
import {
  Calendar,
  GripVertical,
  Paperclip,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TaskPriorityBadge } from "./task-priority-badge";
import { type MemberCapacity } from "@/lib/status-maps";
import type { TaskWithAssignee } from "@/lib/projects/queries";
import { cn } from "@/lib/utils";

interface TaskKanbanCardProps {
  task: TaskWithAssignee;
  index: number;
  isWatcher: boolean;
  onClick: (task: TaskWithAssignee) => void;
}

export function TaskKanbanCard({
  task,
  index,
  isWatcher,
  onClick,
}: TaskKanbanCardProps) {
  const t = useTranslations("projects.tasks");
  const tType = useTranslations("projects.tasks.taskType");
  const tProjects = useTranslations("projects.roster.capacities");

  const deadlineDate = task.deadline_at ? new Date(task.deadline_at) : null;
  const isOverdue =
    deadlineDate && isPast(deadlineDate) && task.status !== "completed";
  const isBlocking = task.priority === "blocking";
  const typeKey =
    task.task_type === "internal_work" ? "internalWork" : "clientRequest";

  const assigneeCapacity = task.assignee?.role as MemberCapacity | undefined;

  return (
    <Draggable
      draggableId={task.id}
      index={index}
      isDragDisabled={isWatcher}
    >
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          onClick={() => onClick(task)}
          className={cn(
            "group relative bg-card text-card-foreground rounded-lg border border-border p-3.5 shadow-xs transition-all cursor-pointer hover:shadow-md hover:border-primary/40 select-none",
            isBlocking && "border-l-4 border-l-rose-400 dark:border-l-rose-500",
            snapshot.isDragging &&
              "shadow-lg ring-2 ring-primary/40 rotate-1 z-50 bg-background",
          )}
        >
          {/* Top Row: Badges & Drag Handle */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <TaskPriorityBadge priority={task.priority} />
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 font-normal truncate"
              >
                {tType(typeKey)}
              </Badge>
            </div>

            {/* Drag Handle (Hidden for Watcher) */}
            {!isWatcher ? (
              <div
                {...provided.dragHandleProps}
                className="p-1 rounded text-muted-foreground/50 group-hover:text-muted-foreground hover:bg-muted cursor-grab active:cursor-grabbing shrink-0"
                aria-label={t("kanban.dragHandleLabel", { title: task.title })}
              >
                <GripVertical className="size-4" />
              </div>
            ) : (
              <Tooltip>
                <TooltipTrigger className="text-[10px] text-muted-foreground/60 px-1 cursor-default">
                  👁
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">{t("watcherMode.readOnlyLabel")}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Title */}
          <h4 className="text-xs sm:text-sm font-semibold text-foreground line-clamp-2 leading-snug mb-3">
            {task.title}
          </h4>

          {/* Bottom Row: Assignee & Deadline & Deliverables */}
          <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground border-t border-border/40">
            {/* Assignee Avatar */}
            <Tooltip>
              <TooltipTrigger className="flex items-center gap-1.5 min-w-0 cursor-default text-left">
                <div className="size-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 font-semibold text-[10px] text-primary">
                  {task.assignee?.full_name?.charAt(0) ?? (
                    <User className="size-2.5" />
                  )}
                </div>
                <span className="truncate max-w-[100px] font-medium text-foreground">
                  {task.assignee?.full_name ?? "Sin asignar"}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs font-semibold">
                  {task.assignee?.full_name ?? "Sin asignar"}
                </p>
                {assigneeCapacity && (
                  <p className="text-[10px] text-muted-foreground">
                    {tProjects(assigneeCapacity as Parameters<typeof tProjects>[0])}
                  </p>
                )}
              </TooltipContent>
            </Tooltip>

            <div className="flex items-center gap-2 shrink-0">
              {/* Deliverables Flag */}
              {task.has_deliverables && (
                <Tooltip>
                  <TooltipTrigger className="p-1 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 flex items-center cursor-default">
                    <Paperclip className="size-3" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">{t("hasDeliverablesBadge")}</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Deadline */}
              {deadlineDate && (
                <div
                  className={cn(
                    "flex items-center gap-1 font-medium",
                    isOverdue && "text-destructive font-bold",
                  )}
                >
                  <Calendar className="size-3" />
                  <span>{format(deadlineDate, "dd MMM")}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}
