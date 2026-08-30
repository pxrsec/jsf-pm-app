"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  createMilestoneAction,
  getMilestoneDetailAction,
  updateMilestoneAction,
} from "@/lib/calendar/actions";
import type {
  CalendarColorOverride,
  MilestoneDetailDto,
  MilestoneManagementTargetDto,
  MilestoneScope,
} from "@/lib/calendar/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MilestoneTaskAssociation } from "./milestone-task-association";

interface MilestoneDialogProps {
  isOpen: boolean;
  mode: "create" | "edit";
  milestoneId?: string;
  targets: MilestoneManagementTargetDto[];
  fixedProjectId?: string;
  focusTasks?: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface MilestoneFormValues {
  scope: MilestoneScope;
  projectId: string;
  title: string;
  description: string;
  targetDate: string;
  colorOverride: CalendarColorOverride | "";
  taskIds: string[];
}

const colors: CalendarColorOverride[] = [
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
];

function initialValues(fixedProjectId?: string): MilestoneFormValues {
  return {
    scope: fixedProjectId ? "project" : "company",
    projectId: fixedProjectId ?? "",
    title: "",
    description: "",
    targetDate: "",
    colorOverride: "chart-1",
    taskIds: [],
  };
}

export function MilestoneDialog({ isOpen, ...props }: MilestoneDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && props.onClose()}>
      {isOpen && (
        <MilestoneForm
          key={`${props.mode}:${props.milestoneId ?? "new"}:${props.fixedProjectId ?? ""}`}
          {...props}
        />
      )}
    </Dialog>
  );
}

function MilestoneForm({
  mode,
  milestoneId,
  targets,
  fixedProjectId,
  focusTasks = false,
  onClose,
  onSuccess,
}: Omit<MilestoneDialogProps, "isOpen">) {
  const t = useTranslations("calendar");
  const [values, setValues] = useState<MilestoneFormValues>(() =>
    initialValues(fixedProjectId),
  );
  const [loadState, setLoadState] = useState<
    "ready" | "loading" | "unavailable"
  >(mode === "edit" ? "loading" : "ready");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const projects = Array.from(
    new Map(
      targets.map((target) => [target.projectId, target.projectName]),
    ).entries(),
  ).map(([id, name]) => ({ id, name }));

  useEffect(() => {
    if (mode !== "edit" || !milestoneId) return;
    let active = true;
    void getMilestoneDetailAction({ milestoneId })
      .then((result) => {
        if (!active) return;
        if (!result.ok) return setLoadState("unavailable");
        const detail: MilestoneDetailDto = result.data;
        setValues({
          scope: detail.scope,
          projectId: detail.projectId ?? "",
          title: detail.title,
          description: detail.description ?? "",
          targetDate: detail.targetDate,
          colorOverride: detail.colorOverride ?? "chart-1",
          taskIds: detail.tasks.map((task) => task.taskId),
        });
        setLoadState("ready");
      })
      .catch(() => active && setLoadState("unavailable"));
    return () => {
      active = false;
    };
  }, [milestoneId, mode]);

  const selectedTasksFitProject = (
    projectId: string,
    taskIds = values.taskIds,
  ) =>
    taskIds.every((taskId) =>
      targets.some(
        (target) => target.taskId === taskId && target.projectId === projectId,
      ),
    );

  const updateScope = (scope: MilestoneScope) => {
    if (scope === values.scope) return;
    if (scope === "project" && values.taskIds.length > 0 && !values.projectId) {
      setError(t("form.projectRequiredBeforeScope"));
      return;
    }
    if (scope === "project" && !selectedTasksFitProject(values.projectId)) {
      setError(t("form.removeIncompatibleTasks"));
      return;
    }
    setError(null);
    setValues((current) => ({
      ...current,
      scope,
      projectId:
        scope === "company" ? "" : (fixedProjectId ?? current.projectId),
    }));
  };

  const updateProject = (projectId: string) => {
    if (values.taskIds.length > 0 && !selectedTasksFitProject(projectId)) {
      setError(t("form.removeIncompatibleTasks"));
      return;
    }
    setError(null);
    setValues((current) => ({ ...current, projectId }));
  };

  const toggleTask = (taskId: string) => {
    setError(null);
    setValues((current) => ({
      ...current,
      taskIds: current.taskIds.includes(taskId)
        ? current.taskIds.filter((id) => id !== taskId)
        : current.taskIds.length < 100
          ? [...current.taskIds, taskId]
          : current.taskIds,
    }));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (
      !values.targetDate ||
      !values.title.trim() ||
      (values.scope === "project" && !values.projectId)
    ) {
      setError(t("form.validationError"));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        scope: values.scope,
        projectId: values.scope === "project" ? values.projectId : null,
        title: values.title.trim(),
        description: values.description.trim() || null,
        targetDate: values.targetDate,
        colorOverride: values.colorOverride || "chart-1",
        taskIds: values.taskIds,
      };
      const result =
        mode === "edit" && milestoneId
          ? await updateMilestoneAction({ milestoneId, ...payload })
          : await createMilestoneAction(payload);
      if (!result.ok) {
        setError(
          mode === "edit" ? t("form.updateError") : t("form.createError"),
        );
        return;
      }
      toast.success(
        mode === "edit" ? t("states.successUpdate") : t("states.successCreate"),
      );
      onSuccess();
      onClose();
    } catch {
      setError(mode === "edit" ? t("form.updateError") : t("form.createError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] overflow-y-auto sm:max-w-4xl">
      <DialogHeader className="space-y-2">
        <DialogTitle>
          {mode === "edit" ? t("form.editTitle") : t("form.createTitle")}
        </DialogTitle>
        <DialogDescription>{t("form.dialogDescription")}</DialogDescription>
      </DialogHeader>
      {loadState === "loading" ? (
        <Loader2 className="mx-auto my-12 size-6 animate-spin" />
      ) : loadState === "unavailable" ? (
        <p role="alert" className="text-sm text-muted-foreground">
          {t("detail.unavailable")}
        </p>
      ) : (
        <form className="space-y-6 py-1" onSubmit={submit}>
          {error && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-foreground">
              {t("form.scopeLabel")}
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(["project", "company"] as const).map((scope) => (
                <label
                  key={scope}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-input bg-background px-3 py-2 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
                >
                  <input
                    type="radio"
                    name="milestone-scope"
                    checked={values.scope === scope}
                    disabled={saving}
                    onChange={() => updateScope(scope)}
                    className="size-4 accent-primary"
                  />
                  {scope === "project"
                    ? t("scope.projectMilestone")
                    : t("scope.companyMilestone")}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-5 md:grid-cols-2">
            {values.scope === "project" && (
              <div className="space-y-2">
                <Label htmlFor="milestone-project">
                  {t("form.projectLabel")}
                </Label>
                <select
                  id="milestone-project"
                  value={values.projectId}
                  disabled={Boolean(fixedProjectId) || saving}
                  onChange={(event) => updateProject(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">{t("form.projectPlaceholder")}</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="milestone-target-date">
                {t("form.targetDateLabel")}
              </Label>
              <Input
                id="milestone-target-date"
                type="date"
                required
                value={values.targetDate}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    targetDate: event.target.value,
                  }))
                }
                disabled={saving}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="milestone-title">{t("form.titleLabel")}</Label>
              <Input
                id="milestone-title"
                required
                maxLength={160}
                value={values.title}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                disabled={saving}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="milestone-description">
                {t("form.descriptionLabel")}
              </Label>
              <Textarea
                id="milestone-description"
                maxLength={2000}
                value={values.description}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                disabled={saving}
                className="min-h-24"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="milestone-color">{t("form.colorLabel")}</Label>
              <select
                id="milestone-color"
                value={values.colorOverride}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    colorOverride: event.target.value as
                      CalendarColorOverride | "",
                  }))
                }
                disabled={saving}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                {colors.map((color) => (
                  <option key={color} value={color}>
                    {t(`colors.${color}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <MilestoneTaskAssociation
            scope={values.scope}
            projectId={values.projectId}
            targets={targets}
            selectedTaskIds={values.taskIds}
            disabled={saving}
            focusOnMount={focusTasks}
            onToggleTask={toggleTask}
          />
          <DialogFooter className="gap-2 border-t border-border pt-5 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
            >
              {t("actions.cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              {mode === "edit" ? t("actions.saveChanges") : t("actions.save")}
            </Button>
          </DialogFooter>
        </form>
      )}
    </DialogContent>
  );
}
