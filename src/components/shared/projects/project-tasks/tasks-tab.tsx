"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Kanban, List, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskFilters } from "./task-filters";
import { TaskKanbanBoard } from "./task-kanban-board";
import { TaskListView } from "./task-list-view";
import { TaskCreateDialog } from "./task-create-dialog";
import { TaskEditDialog } from "./task-edit-dialog";
import { TaskArchiveDialog } from "./task-archive-dialog";
import { TaskDetailSheet } from "./task-detail-sheet";
import type {
  ProjectDetail,
  TaskFilters as TaskFiltersType,
  TaskStatus,
  TaskWithAssignee,
} from "@/lib/projects/queries";

interface TasksTabProps {
  project: ProjectDetail;
  initialTasks: TaskWithAssignee[];
  effectiveCapacity: "admin" | "pm_lead" | "pm_watcher";
  locale: string;
}

export function TasksTab({
  project,
  initialTasks,
  effectiveCapacity,
}: TasksTabProps) {
  const t = useTranslations("projects.tasks");
  const router = useRouter();

  const [overrideTasks, setOverrideTasks] = useState<TaskWithAssignee[] | null>(
    null,
  );
  const tasks = overrideTasks ?? initialTasks;
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [filters, setFilters] = useState<TaskFiltersType>({});

  // Dialog & Sheet States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<TaskWithAssignee | null>(null);
  const [archivingTaskId, setArchivingTaskId] = useState<string | null>(null);

  const isWatcher = effectiveCapacity === "pm_watcher";

  // Client-side filtering
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filters.status && task.status !== filters.status) return false;
      if (filters.priority && task.priority !== filters.priority) return false;
      if (filters.task_type && task.task_type !== filters.task_type)
        return false;
      if (filters.assignee_id && task.assignee_id !== filters.assignee_id)
        return false;
      return true;
    });
  }, [tasks, filters]);

  const activeTask = useMemo(() => {
    if (!openTaskId) return null;
    return tasks.find((t) => t.id === openTaskId) ?? null;
  }, [tasks, openTaskId]);

  const handleMutationSuccess = () => {
    setOverrideTasks(null);
    router.refresh();
  };

  const handleStatusChangeFromSelect = (
    taskId: string,
    newStatus: TaskStatus,
  ) => {
    setOverrideTasks((prev) => {
      const current = prev ?? initialTasks;
      return current.map((t) =>
        t.id === taskId ? { ...t, status: newStatus } : t,
      );
    });
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Top Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground tracking-tight">
            {t("tabTitle")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {tasks.length}{" "}
            {tasks.length === 1 ? "tarea en total" : "tareas en total"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="inline-flex p-1 bg-muted rounded-lg border border-border/60">
            <Button
              type="button"
              variant={viewMode === "kanban" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("kanban")}
              className="h-8 px-2.5 text-xs gap-1.5"
            >
              <Kanban className="size-3.5" />
              <span className="hidden sm:inline">{t("viewKanban")}</span>
            </Button>
            <Button
              type="button"
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="h-8 px-2.5 text-xs gap-1.5"
            >
              <List className="size-3.5" />
              <span className="hidden sm:inline">{t("viewList")}</span>
            </Button>
          </div>

          {/* New Task Button (PM Lead / Admin only, when project not completed) */}
          {!isWatcher && project.status !== "completed" && (
            <Button
              onClick={() => setIsCreateOpen(true)}
              size="sm"
              className="h-9 text-xs gap-1.5 font-medium shadow-xs"
            >
              <Plus className="size-4" />
              <span>{t("newTaskAction")}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <TaskFilters
        members={project.members}
        filters={filters}
        onChange={setFilters}
        onClear={() => setFilters({})}
      />

      {/* Main Task Surface */}
      {tasks.length === 0 ? (
        <div className="text-center py-16 px-4 bg-card rounded-xl border border-border/80 shadow-2xs space-y-4">
          <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto text-primary">
            <Kanban className="size-6" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-semibold text-foreground">
              {t("emptyState.noTasks")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t("emptyState.noTasksDescription")}
            </p>
          </div>
          {!isWatcher && project.status !== "completed" && (
            <Button
              onClick={() => setIsCreateOpen(true)}
              size="sm"
              className="text-xs"
            >
              <Plus className="mr-1.5 size-4" />
              {t("emptyState.createFirstTask")}
            </Button>
          )}
        </div>
      ) : viewMode === "kanban" ? (
        <TaskKanbanBoard
          projectId={project.id}
          tasks={filteredTasks}
          effectiveCapacity={effectiveCapacity}
          onTasksChange={(updated) => setOverrideTasks(updated)}
          onTaskClick={(task) => setOpenTaskId(task.id)}
        />
      ) : (
        <TaskListView
          tasks={filteredTasks}
          isWatcher={isWatcher}
          onViewDetails={(task) => setOpenTaskId(task.id)}
          onEdit={(task) => setEditingTask(task)}
          onArchive={(task) => setArchivingTaskId(task.id)}
        />
      )}

      {/* Create Task Dialog */}
      <TaskCreateDialog
        project={project}
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={handleMutationSuccess}
      />

      {/* Edit Task Dialog */}
      <TaskEditDialog
        project={project}
        task={editingTask}
        isOpen={Boolean(editingTask)}
        onClose={() => setEditingTask(null)}
        onSuccess={handleMutationSuccess}
      />

      {/* Archive Task Dialog */}
      <TaskArchiveDialog
        taskId={archivingTaskId}
        projectId={project.id}
        isOpen={Boolean(archivingTaskId)}
        onClose={() => setArchivingTaskId(null)}
        onSuccess={handleMutationSuccess}
      />

      {/* Task Detail Sheet */}
      <TaskDetailSheet
        task={activeTask}
        project={project}
        effectiveCapacity={effectiveCapacity}
        isOpen={Boolean(openTaskId)}
        onClose={() => setOpenTaskId(null)}
        onEditClick={() => {
          if (activeTask) {
            setEditingTask(activeTask);
            setOpenTaskId(null);
          }
        }}
        onStatusChanged={(newStatus) => {
          if (activeTask) {
            handleStatusChangeFromSelect(activeTask.id, newStatus);
          }
        }}
      />
    </div>
  );
}
