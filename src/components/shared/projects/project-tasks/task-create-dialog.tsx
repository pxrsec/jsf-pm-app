"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Plus, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DraftDeliverableCard } from "./draft-deliverable-card";
import { TaskTypeToggle } from "./task-type-toggle";
import { TaskTypeChangeAlert } from "./task-type-change-alert";
import { TaskDetailsFields } from "./task-details-fields";
import {
  useTaskDeliverableDrafts,
  type TaskDeliverableDraftFormValue,
} from "./use-task-deliverable-drafts";
import {
  createTaskAction,
  createTaskWithDeliverablesAction,
} from "@/lib/projects/task-actions";
import type { ProjectDetail, TaskPriority } from "@/lib/projects/queries";
import type { MemberCapacity } from "@/lib/status-maps";

interface TaskFormData {
  project_id: string;
  task_type: "internal_work" | "client_request";
  title: string;
  description: string;
  priority: TaskPriority;
  assignee_id: string;
  deadline_at: string;
  deliverables: TaskDeliverableDraftFormValue[];
}

interface TaskCreateDialogProps {
  project: ProjectDetail;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function TaskCreateDialog({
  project,
  isOpen,
  onClose,
  onSuccess,
}: TaskCreateDialogProps) {
  const t = useTranslations("projects.tasks.create");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingTypeChange, setPendingTypeChange] = useState<
    "internal_work" | "client_request" | null
  >(null);

  const isInternalProject = project.project_type === "internal";

  const getFirstCompatibleMember = (
    type: "internal_work" | "client_request",
  ) => {
    const allowed: MemberCapacity[] =
      type === "internal_work"
        ? ["pm_lead", "pm_watcher", "operator"]
        : ["client"];
    return project.members.find(
      (m) =>
        !m.deleted_at &&
        m.profile?.is_active &&
        allowed.includes(m.member_type as MemberCapacity),
    );
  };

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    reset,
    watch,
    formState: { errors },
  } = useForm<TaskFormData>({
    defaultValues: {
      project_id: project.id,
      task_type: "internal_work",
      title: "",
      description: "",
      priority: "medium",
      assignee_id: getFirstCompatibleMember("internal_work")?.user_id ?? "",
      deadline_at: "",
      deliverables: [],
    },
  });

  const {
    fields,
    addDraft,
    removeDraft,
    clearDrafts,
    syncTaskAssigneeChange,
    draftCount,
    canAddMore,
  } = useTaskDeliverableDrafts(control, setValue, getValues);

  const selectedType = useWatch({ control, name: "task_type" });
  const taskAssigneeId = useWatch({ control, name: "assignee_id" });

  const allowedMemberTypes: MemberCapacity[] =
    selectedType === "internal_work"
      ? ["pm_lead", "pm_watcher", "operator"]
      : ["client"];

  const handleTypeChangeRequest = (
    nextType: "internal_work" | "client_request",
  ) => {
    if (nextType === selectedType) return;
    if (draftCount > 0) {
      setPendingTypeChange(nextType);
    } else {
      applyTypeChange(nextType);
    }
  };

  const applyTypeChange = (nextType: "internal_work" | "client_request") => {
    clearDrafts();
    setValue("task_type", nextType);
    const compatible = getFirstCompatibleMember(nextType);
    setValue("assignee_id", compatible?.user_id ?? "", {
      shouldValidate: true,
    });
    setPendingTypeChange(null);
  };

  const handleFormResetAndClose = () => {
    reset();
    clearDrafts();
    onClose();
  };

  const onSubmit = async (data: TaskFormData) => {
    setIsSubmitting(true);
    try {
      const isoDeadline = new Date(data.deadline_at).toISOString();

      if (draftCount === 0) {
        const result = await createTaskAction({
          project_id: data.project_id,
          task_type: data.task_type,
          title: data.title,
          description: data.description,
          priority: data.priority,
          assignee_id: data.assignee_id,
          deadline_at: isoDeadline,
        });

        if (!result.ok) {
          toast.error(result.error.message || t("errorToast"));
        } else {
          toast.success(t("successToast"));
          handleFormResetAndClose();
          onSuccess?.();
        }
      } else {
        const cleanDeliverables = data.deliverables.map((d) => ({
          title: d.title,
          specifications: d.specifications,
          assignee_id: d.sameAsTaskAssignee ? data.assignee_id : d.assignee_id,
          submission_deadline_at: d.submission_deadline_at,
          internal_review_deadline_at: d.internal_review_deadline_at,
          client_delivery_deadline_at: d.client_delivery_deadline_at,
        }));

        const result = await createTaskWithDeliverablesAction({
          project_id: data.project_id,
          task_type: data.task_type,
          title: data.title,
          description: data.description,
          priority: data.priority,
          assignee_id: data.assignee_id,
          deadline_at: isoDeadline,
          deliverables: cleanDeliverables,
        });

        if (!result.ok) {
          toast.error(result.error.message || t("errorToast"));
        } else {
          toast.success(
            t("successCombinedToast", {
              count: result.data.deliverable_ids.length,
            }),
          );
          handleFormResetAndClose();
          onSuccess?.();
        }
      }
    } catch {
      toast.error(t("errorToast"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) handleFormResetAndClose();
        }}
      >
        <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
            <TaskTypeToggle
              selectedType={selectedType}
              isInternalProject={isInternalProject}
              onSelectType={handleTypeChangeRequest}
              disabled={isSubmitting}
            />

            <TaskDetailsFields
              register={register}
              control={control}
              errors={errors}
              selectedType={selectedType}
              members={project.members}
              allowedMemberTypes={allowedMemberTypes}
              isSubmitting={isSubmitting}
              onAssigneeChange={syncTaskAssigneeChange}
            />

            {/* Deliverables Section */}
            <div className="pt-3 border-t border-border/60 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-foreground">
                    {t("deliverablesSectionTitle", { count: draftCount })}
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    {selectedType === "internal_work"
                      ? t("workflowDerivedProductionHint")
                      : t("workflowDerivedClientSubmissionHint")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addDraft(taskAssigneeId)}
                  disabled={!canAddMore || !taskAssigneeId || isSubmitting}
                  className="h-8 text-xs gap-1"
                >
                  <Plus className="size-3.5" />
                  <span>{t("addDeliverableAction")}</span>
                </Button>
              </div>

              {!canAddMore && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertCircle className="size-3 shrink-0" />
                  <span>{t("maxDeliverablesReached")}</span>
                </p>
              )}

              {fields.map((field, idx) => (
                <DraftDeliverableCard
                  key={field.id}
                  index={idx}
                  taskType={selectedType}
                  projectType={project.project_type}
                  members={project.members}
                  taskAssigneeId={taskAssigneeId}
                  register={register}
                  setValue={setValue}
                  watch={watch}
                  errors={errors}
                  onRemove={() => removeDraft(idx)}
                />
              ))}
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleFormResetAndClose}
                disabled={isSubmitting}
              >
                {t("cancelAction")}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    {t("submitting")}
                  </>
                ) : (
                  t("submitAction")
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <TaskTypeChangeAlert
        open={Boolean(pendingTypeChange)}
        onCancel={() => setPendingTypeChange(null)}
        onConfirm={() => {
          if (pendingTypeChange) applyTypeChange(pendingTypeChange);
        }}
      />
    </>
  );
}
