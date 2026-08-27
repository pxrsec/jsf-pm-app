"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Loader2, Info, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ProjectAssigneeSelect } from "@/components/shared/projects/project-tasks/project-assignee-select";
import { DeliverableDeadlinesSection } from "./deliverable-deadlines-section";
import {
  CreateDeliverableSchema,
  type CreateDeliverableInput,
} from "@/lib/deliverables/schemas";
import { createDeliverableAction } from "@/lib/deliverables/actions";
import type { ProjectDetail, TaskWithAssignee } from "@/lib/projects/queries";
import type { MemberCapacity } from "@/lib/status-maps";

interface DeliverableCreateDialogProps {
  project: ProjectDetail;
  tasks: TaskWithAssignee[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function DeliverableCreateDialog({
  project,
  tasks,
  isOpen,
  onClose,
  onSuccess,
}: DeliverableCreateDialogProps) {
  const t = useTranslations("projects.workspace.deliverables.createDialog");
  const tTasks = useTranslations("projects.tasks");
  const tDeliverables = useTranslations("projects.workspace.deliverables");
  const [serverError, setServerError] = useState<string | null>(null);

  // List all non-deleted project tasks
  const availableTasks = tasks.filter((t) => !t.deleted_at);

  const form = useForm<CreateDeliverableInput>({
    resolver: zodResolver(CreateDeliverableSchema),
    defaultValues: {
      project_id: project.id,
      task_id: availableTasks[0]?.id ?? "",
      assignee_id: "",
      title: "",
      specifications: "",
      submission_deadline_at: null,
      internal_review_deadline_at: null,
      client_delivery_deadline_at: null,
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = form;

  const selectedTaskId = useWatch({ control, name: "task_id" });
  const selectedTask = availableTasks.find((t) => t.id === selectedTaskId);
  const taskType = selectedTask?.task_type ?? "internal_work";

  const isClientProject = project.project_type === "client";
  const hasClientOrg = Boolean(project.client_id);
  const isMissingClientOrg = isClientProject && !hasClientOrg;

  const allowedMemberTypes: MemberCapacity[] =
    taskType === "internal_work"
      ? ["pm_lead", "pm_watcher", "operator"]
      : ["client"];

  const compatibleMembers = project.members.filter(
    (m) =>
      !m.deleted_at &&
      m.profile?.is_active &&
      allowedMemberTypes.includes(m.member_type as MemberCapacity),
  );

  // Derive initial assignee and clear workflow-incompatible dates on task switch
  useEffect(() => {
    if (selectedTask) {
      const isTaskAssigneeCompatible =
        selectedTask.assignee_id &&
        compatibleMembers.some((m) => m.user_id === selectedTask.assignee_id);

      setValue(
        "assignee_id",
        isTaskAssigneeCompatible
          ? (selectedTask.assignee_id ?? "")
          : (compatibleMembers[0]?.user_id ?? ""),
      );

      if (taskType === "internal_work") {
        setValue("submission_deadline_at", null);
      } else {
        setValue("internal_review_deadline_at", null);
        setValue("client_delivery_deadline_at", null);
      }
    }
  }, [selectedTaskId, selectedTask, taskType, compatibleMembers, setValue]);

  // Blocked conditions
  let blockedReason: string | null = null;
  if (availableTasks.length === 0) {
    blockedReason = tTasks("create.noEligibleTasksDescription");
  } else if (taskType === "client_request" && isMissingClientOrg) {
    blockedReason = tTasks("create.incompleteClientSetupForClientRequest");
  } else if (taskType === "internal_work" && isMissingClientOrg) {
    blockedReason = tTasks("create.incompleteClientSetupForClientRequest");
  } else if (taskType === "client_request" && compatibleMembers.length === 0) {
    blockedReason = tTasks("create.noCompatibleClientMembers");
  } else if (compatibleMembers.length === 0) {
    blockedReason = tTasks("create.noCompatibleMembers");
  }

  const isFormBlocked = Boolean(blockedReason);

  const onSubmit = async (data: CreateDeliverableInput) => {
    if (isFormBlocked) return;
    setServerError(null);
    const result = await createDeliverableAction(data);

    if (result.ok) {
      reset();
      onClose();
      onSuccess(t("successToast"));
    } else {
      setServerError(result.error.message);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          reset();
          setServerError(null);
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Plus className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                {t("title")}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {t("description")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          {/* Related Task Selection */}
          <div className="space-y-1.5">
            <Label htmlFor="create-task" className="text-xs font-medium">
              {t("taskLabel")} <span className="text-destructive">*</span>
            </Label>
            <Controller
              control={control}
              name="task_id"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isSubmitting || availableTasks.length === 0}
                  items={availableTasks.map((task) => ({
                    value: task.id,
                    label: `${task.title} (${task.task_type === "internal_work" ? tTasks("taskType.internalWork") : tTasks("taskType.clientRequest")})`,
                  }))}
                >
                  <SelectTrigger id="create-task" className="text-xs h-10">
                    <SelectValue placeholder={t("taskPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTasks.map((task) => (
                      <SelectItem
                        key={task.id}
                        value={task.id}
                        className="text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate max-w-[280px]">
                            {task.title}
                          </span>
                          <Badge
                            variant="secondary"
                            className="text-[10px] py-0 px-1 font-normal shrink-0"
                          >
                            {task.task_type === "internal_work"
                              ? tTasks("taskType.internalWork")
                              : tTasks("taskType.clientRequest")}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.task_id && (
              <p className="text-[11px] text-destructive">
                {errors.task_id.message}
              </p>
            )}
          </div>

          {/* Derived Workflow Notice */}
          <div className="p-3 rounded-lg border border-border/70 bg-muted/30 text-xs text-muted-foreground flex items-center gap-2">
            <Info className="size-4 shrink-0 text-primary" />
            <span>
              {taskType === "internal_work"
                ? tTasks("create.workflowDerivedProductionHint")
                : tTasks("create.workflowDerivedClientSubmissionHint")}
            </span>
          </div>

          {/* Blocked state explanation */}
          {blockedReason && (
            <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>{blockedReason}</span>
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="create-title" className="text-xs font-medium">
              {t("titleLabel")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="create-title"
              maxLength={180}
              {...register("title")}
              placeholder={t("titlePlaceholder")}
              disabled={isSubmitting || isFormBlocked}
              className="text-xs h-10"
            />
            {errors.title && (
              <p className="text-[11px] text-destructive">
                {errors.title.message}
              </p>
            )}
          </div>

          {/* Assignee Selection */}
          <div className="space-y-1.5">
            <Controller
              control={control}
              name="assignee_id"
              render={({ field }) => (
                <ProjectAssigneeSelect
                  members={project.members}
                  allowedMemberTypes={allowedMemberTypes}
                  value={field.value}
                  onChange={field.onChange}
                  disabled={isSubmitting || isFormBlocked}
                  label={t("assigneeLabel")}
                  placeholder={
                    taskType === "client_request"
                      ? tDeliverables("form.assigneeClientPlaceholder")
                      : tDeliverables("form.assigneeInternalPlaceholder")
                  }
                  noCompatibleMembersText={
                    taskType === "client_request"
                      ? tTasks("create.noCompatibleClientMembers")
                      : tTasks("create.noCompatibleMembers")
                  }
                  error={errors.assignee_id?.message}
                />
              )}
            />
          </div>

          {/* Specifications */}
          <div className="space-y-1.5">
            <Label
              htmlFor="create-specifications"
              className="text-xs font-medium"
            >
              {t("specificationsLabel")}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="create-specifications"
              maxLength={30000}
              {...register("specifications")}
              placeholder={t("specificationsPlaceholder")}
              rows={3}
              disabled={isSubmitting || isFormBlocked}
              className="text-xs resize-y"
            />
            {errors.specifications && (
              <p className="text-[11px] text-destructive">
                {errors.specifications.message}
              </p>
            )}
          </div>

          {/* Deadlines Section */}
          <DeliverableDeadlinesSection
            control={control}
            taskType={taskType}
            isClientProject={isClientProject}
            disabled={isSubmitting || isFormBlocked}
          />

          {serverError && (
            <p className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-md">
              {serverError}
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs"
            >
              {t("cancelAction")}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || isFormBlocked}
              className="text-xs gap-1.5"
            >
              {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
              <span>{isSubmitting ? t("submitting") : t("submitAction")}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
