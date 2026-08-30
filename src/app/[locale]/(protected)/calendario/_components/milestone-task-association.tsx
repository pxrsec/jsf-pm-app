"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  MilestoneManagementTargetDto,
  MilestoneScope,
} from "@/lib/calendar/types";

interface MilestoneTaskAssociationProps {
  scope: MilestoneScope;
  projectId: string;
  targets: MilestoneManagementTargetDto[];
  selectedTaskIds: string[];
  disabled: boolean;
  focusOnMount: boolean;
  onToggleTask: (taskId: string) => void;
}

const statusKeys: Record<string, string> = {
  pending: "pending",
  in_progress: "in_progress",
  in_review: "in_review",
  blocked: "blocked",
  completed: "completed",
};

export function MilestoneTaskAssociation({
  scope,
  projectId,
  targets,
  selectedTaskIds,
  disabled,
  focusOnMount,
  onToggleTask,
}: MilestoneTaskAssociationProps) {
  const t = useTranslations("calendar.form");
  const tStatus = useTranslations("projects.workspace.overview");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [companyProjectId, setCompanyProjectId] = useState("");

  useEffect(() => {
    if (focusOnMount) searchInputRef.current?.focus();
  }, [focusOnMount]);

  const projects = useMemo(
    () =>
      Array.from(
        new Map(
          targets.map((target) => [target.projectId, target.projectName]),
        ).entries(),
      ).map(([id, name]) => ({ id, name })),
    [targets],
  );
  const selectedTasks = useMemo(
    () =>
      selectedTaskIds.flatMap((taskId) => {
        const target = targets.find((item) => item.taskId === taskId);
        return target ? [target] : [];
      }),
    [selectedTaskIds, targets],
  );
  const activeProjectId = scope === "project" ? projectId : companyProjectId;
  const availableTasks = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return targets.filter(
      (target) =>
        target.projectId === activeProjectId &&
        !selectedTaskIds.includes(target.taskId) &&
        (!normalizedSearch ||
          target.taskTitle.toLocaleLowerCase().includes(normalizedSearch)),
    );
  }, [activeProjectId, search, selectedTaskIds, targets]);

  const canBrowse =
    scope === "project" ? Boolean(projectId) : Boolean(companyProjectId);

  return (
    <section
      className="space-y-4 border-t border-border pt-5"
      aria-labelledby="milestone-tasks-heading"
    >
      <div className="space-y-1">
        <h3
          id="milestone-tasks-heading"
          className="text-sm font-semibold text-foreground"
        >
          {t("tasksLabel")}
        </h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("tasksHelp")}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3 sm:p-4">
          <div className="space-y-2">
            <Label htmlFor="milestone-task-project">
              {t("browseProjectLabel")}
            </Label>
            <select
              id="milestone-task-project"
              value={activeProjectId}
              disabled={disabled || (scope === "project" && Boolean(projectId))}
              onChange={(event) => setCompanyProjectId(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">{t("browseProjectPlaceholder")}</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="milestone-task-search">
              {t("searchTasksLabel")}
            </Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                ref={searchInputRef}
                id="milestone-task-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("searchTasksPlaceholder")}
                disabled={disabled || !canBrowse}
                className="pl-9"
              />
            </div>
          </div>
          <div
            className="max-h-64 space-y-2 overflow-y-auto pr-1"
            aria-live="polite"
          >
            {!canBrowse ? (
              <p className="py-5 text-center text-sm text-muted-foreground">
                {t("browseProjectRequired")}
              </p>
            ) : availableTasks.length === 0 ? (
              <p className="py-5 text-center text-sm text-muted-foreground">
                {t("noMatchingTasks")}
              </p>
            ) : (
              availableTasks.map((task) => (
                <label
                  key={task.taskId}
                  className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-border bg-background p-3 text-sm hover:bg-muted/50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
                >
                  <input
                    type="checkbox"
                    checked={false}
                    disabled={disabled}
                    onChange={() => onToggleTask(task.taskId)}
                    className="mt-0.5 size-4 accent-primary"
                    aria-label={t("selectTaskAria", { title: task.taskTitle })}
                  />
                  <span className="min-w-0 space-y-0.5">
                    <span className="block break-words font-medium text-foreground">
                      {task.taskTitle}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {tStatus(
                        `taskStatus.${statusKeys[task.taskStatus] ?? "pending"}`,
                      )}
                    </span>
                  </span>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-card p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-foreground">
              {t("relatedTasksTitle")}
            </h4>
            <span
              className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
              aria-label={t("tasksSelected", { count: selectedTasks.length })}
            >
              {selectedTasks.length}
            </span>
          </div>
          {selectedTasks.length === 0 ? (
            <p className="py-5 text-center text-sm text-muted-foreground">
              {t("noRelatedTasks")}
            </p>
          ) : (
            <ul
              className="max-h-64 space-y-2 overflow-y-auto pr-1"
              aria-label={t("relatedTasksTitle")}
            >
              {selectedTasks.map((task) => (
                <li
                  key={task.taskId}
                  className="flex min-h-11 items-start justify-between gap-3 rounded-md border border-border p-3"
                >
                  <span className="min-w-0 space-y-0.5">
                    <span className="block break-words text-sm font-medium text-foreground">
                      {task.taskTitle}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {task.projectName} ·{" "}
                      {tStatus(
                        `taskStatus.${statusKeys[task.taskStatus] ?? "pending"}`,
                      )}
                    </span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 shrink-0"
                    disabled={disabled}
                    onClick={() => onToggleTask(task.taskId)}
                    aria-label={t("removeTaskAria", { title: task.taskTitle })}
                  >
                    <X className="size-4" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
