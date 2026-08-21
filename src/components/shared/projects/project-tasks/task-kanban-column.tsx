"use client";

import { useTranslations } from "next-intl";
import { Droppable } from "@hello-pangea/dnd";
import { TASK_STATUS_MAP, type TaskStatus } from "@/lib/status-maps";
import { TaskKanbanCard } from "./task-kanban-card";
import { STATUS_TRANSLATION_KEYS } from "./task-status-badge";
import type { TaskWithAssignee } from "@/lib/projects/queries";
import { cn } from "@/lib/utils";

interface TaskKanbanColumnProps {
  status: TaskStatus;
  tasks: TaskWithAssignee[];
  isWatcher: boolean;
  onTaskClick: (task: TaskWithAssignee) => void;
}

export function TaskKanbanColumn({
  status,
  tasks,
  isWatcher,
  onTaskClick,
}: TaskKanbanColumnProps) {
  const t = useTranslations("projects.tasks");
  const tStatus = useTranslations("projects.tasks.taskStatus");
  const config = TASK_STATUS_MAP[status];
  const Icon = config.icon;

  const isBlocked = status === "blocked";
  const transKey = STATUS_TRANSLATION_KEYS[status] ?? "pending";

  return (
    <div
      className="flex flex-col flex-1 min-w-[260px] max-w-[320px] bg-muted/40 rounded-xl border border-border/70 overflow-hidden shadow-2xs"
      aria-label={t("kanban.columnAriaLabel", {
        status: tStatus(transKey),
        count: tasks.length,
      })}
    >
      {/* Column Header */}
      <div
        className={cn(
          "flex items-center justify-between px-3.5 py-3 border-b border-border/70 bg-card/60",
          isBlocked &&
            "bg-red-50/70 dark:bg-red-950/30 border-red-200 dark:border-red-900/50",
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              "p-1 rounded-md shrink-0",
              config.badgeBg,
              config.badgeFg,
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
          </span>
          <span className="font-semibold text-xs sm:text-sm text-foreground truncate">
            {tStatus(transKey)}
          </span>
        </div>

        <span
          className={cn(
            "text-xs font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground",
            tasks.length > 0 && "bg-primary/10 text-primary font-bold",
            isBlocked &&
              tasks.length > 0 &&
              "bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-200",
          )}
        >
          {tasks.length}
        </span>
      </div>

      {/* Droppable Card Area */}
      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex-1 p-2.5 space-y-2.5 overflow-y-auto min-h-[300px] transition-colors",
              snapshot.isDraggingOver && "bg-primary/5",
            )}
          >
            {tasks.map((task, index) => (
              <TaskKanbanCard
                key={task.id}
                task={task}
                index={index}
                isWatcher={isWatcher}
                onClick={onTaskClick}
              />
            ))}
            {provided.placeholder}

            {tasks.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex items-center justify-center h-28 border border-dashed border-border/50 rounded-lg text-center p-3">
                <p className="text-xs text-muted-foreground/70">
                  {t("kanban.columnEmpty")}
                </p>
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}
