"use client";

import { useTranslations } from "next-intl";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { toast } from "sonner";
import { TaskKanbanColumn } from "./task-kanban-column";
import { STATUS_TRANSLATION_KEYS } from "./task-status-badge";
import { transitionTaskStatusAction } from "@/lib/projects/task-actions";
import type { TaskStatus, TaskWithAssignee } from "@/lib/projects/queries";

const KANBAN_COLUMNS: TaskStatus[] = [
  "pending",
  "in_progress",
  "in_review",
  "completed",
  "blocked",
];

interface TaskKanbanBoardProps {
  projectId: string;
  tasks: TaskWithAssignee[];
  effectiveCapacity: "admin" | "pm_lead" | "pm_watcher";
  onTasksChange: (updatedTasks: TaskWithAssignee[]) => void;
  onTaskClick: (task: TaskWithAssignee) => void;
}

export function TaskKanbanBoard({
  projectId,
  tasks,
  effectiveCapacity,
  onTasksChange,
  onTaskClick,
}: TaskKanbanBoardProps) {
  const t = useTranslations("projects.tasks");
  const tStatus = useTranslations("projects.tasks.taskStatus");
  const tErrors = useTranslations("projects.tasks.errors");
  const isWatcher = effectiveCapacity === "pm_watcher";

  const onDragEnd = async (result: DropResult) => {
    if (isWatcher) return;

    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    const task = tasks.find((t) => t.id === draggableId);
    if (!task) return;

    const targetStatus = destination.droppableId as TaskStatus;

    // Constraint: client_request tasks cannot enter in_review
    if (task.task_type === "client_request" && targetStatus === "in_review") {
      toast.error(t("kanban.clientRequestNoReview"));
      return;
    }

    // Optimistic UI update
    const previousTasks = [...tasks];
    const updatedTasks = tasks.map((t) =>
      t.id === draggableId ? { ...t, status: targetStatus } : t,
    );
    onTasksChange(updatedTasks);

    try {
      const response = await transitionTaskStatusAction(task.id, projectId, {
        task_id: task.id,
        next_status: targetStatus,
      });

      if (!response.ok) {
        // Rollback
        onTasksChange(previousTasks);
        const errorCode = response.error.code;
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
          toast.error(t("kanban.movedError"));
        }
      } else {
        const transKey = STATUS_TRANSLATION_KEYS[targetStatus] ?? "pending";
        toast.success(
          t("kanban.movedSuccess", { status: tStatus(transKey) }),
        );
      }
    } catch {
      // Rollback
      onTasksChange(previousTasks);
      toast.error(t("kanban.movedError"));
    }
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-6 pt-2 snap-x">
        {KANBAN_COLUMNS.map((columnStatus) => {
          const columnTasks = tasks.filter((t) => t.status === columnStatus);
          return (
            <TaskKanbanColumn
              key={columnStatus}
              status={columnStatus}
              tasks={columnTasks}
              isWatcher={isWatcher}
              onTaskClick={onTaskClick}
            />
          );
        })}
      </div>
    </DragDropContext>
  );
}
