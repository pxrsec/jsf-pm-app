"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Loader2 } from "lucide-react";
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
import {
  CreateDeliverableSchema,
  type CreateDeliverableInput,
} from "@/lib/deliverables/schemas";
import { createDeliverableAction } from "@/lib/deliverables/actions";
import type { ProjectDetail, TaskWithAssignee } from "@/lib/projects/queries";

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
  const [serverError, setServerError] = useState<string | null>(null);

  // Filter tasks admitting deliverables
  const eligibleTasks = tasks.filter(
    (t) => t.has_deliverables && !t.deleted_at,
  );

  // Filter active compatible project members (PM Leads, Watchers, Operators)
  const eligibleAssignees = project.members.filter(
    (m) =>
      !m.deleted_at &&
      m.profile?.is_active &&
      ["pm_lead", "pm_watcher", "operator"].includes(m.member_type),
  );

  const form = useForm<CreateDeliverableInput>({
    resolver: zodResolver(CreateDeliverableSchema),
    defaultValues: {
      project_id: project.id,
      task_id: eligibleTasks[0]?.id ?? "",
      assignee_id: eligibleAssignees[0]?.user_id ?? "",
      title: "",
      specifications: "",
      workflow_type: "production",
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
  const selectedAssigneeId = useWatch({ control, name: "assignee_id" });

  const onSubmit = async (data: CreateDeliverableInput) => {
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
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="create-title" className="text-xs font-medium">
              {t("titleLabel")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="create-title"
              {...register("title")}
              placeholder={t("titlePlaceholder")}
              className="text-xs"
            />
            {errors.title && (
              <p className="text-[11px] text-destructive">
                {errors.title.message}
              </p>
            )}
          </div>

          {/* Task Selection */}
          <div className="space-y-1.5">
            <Label htmlFor="create-task" className="text-xs font-medium">
              {t("taskLabel")} <span className="text-destructive">*</span>
            </Label>
            <Select
              value={selectedTaskId}
              onValueChange={(val) => {
                if (val) setValue("task_id", val);
              }}
            >
              <SelectTrigger id="create-task" className="text-xs">
                <SelectValue placeholder={t("taskPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {eligibleTasks.map((task) => (
                  <SelectItem key={task.id} value={task.id} className="text-xs">
                    {task.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.task_id && (
              <p className="text-[11px] text-destructive">
                {errors.task_id.message}
              </p>
            )}
          </div>

          {/* Assignee Selection */}
          <div className="space-y-1.5">
            <Label htmlFor="create-assignee" className="text-xs font-medium">
              {t("assigneeLabel")} <span className="text-destructive">*</span>
            </Label>
            <Select
              value={selectedAssigneeId}
              onValueChange={(val) => {
                if (val) setValue("assignee_id", val);
              }}
            >
              <SelectTrigger id="create-assignee" className="text-xs">
                <SelectValue placeholder={t("assigneePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {eligibleAssignees.map((member) => (
                  <SelectItem
                    key={member.user_id}
                    value={member.user_id}
                    className="text-xs"
                  >
                    {member.profile?.full_name || t("userFallback")} (
                    {member.member_type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.assignee_id && (
              <p className="text-[11px] text-destructive">
                {errors.assignee_id.message}
              </p>
            )}
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
              {...register("specifications")}
              placeholder={t("specificationsPlaceholder")}
              rows={4}
              className="text-xs resize-none"
            />
            {errors.specifications && (
              <p className="text-[11px] text-destructive">
                {errors.specifications.message}
              </p>
            )}
          </div>

          {/* Deadlines Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="space-y-1.5">
              <Label
                htmlFor="create-sub-deadline"
                className="text-[11px] font-medium"
              >
                {t("submissionDeadlineLabel")}
              </Label>
              <Input
                id="create-sub-deadline"
                type="datetime-local"
                onChange={(e) =>
                  setValue(
                    "submission_deadline_at",
                    e.target.value
                      ? new Date(e.target.value).toISOString()
                      : null,
                  )
                }
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="create-rev-deadline"
                className="text-[11px] font-medium"
              >
                {t("internalReviewDeadlineLabel")}
              </Label>
              <Input
                id="create-rev-deadline"
                type="datetime-local"
                onChange={(e) =>
                  setValue(
                    "internal_review_deadline_at",
                    e.target.value
                      ? new Date(e.target.value).toISOString()
                      : null,
                  )
                }
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="create-del-deadline"
                className="text-[11px] font-medium"
              >
                {t("clientDeliveryDeadlineLabel")}
              </Label>
              <Input
                id="create-del-deadline"
                type="datetime-local"
                onChange={(e) =>
                  setValue(
                    "client_delivery_deadline_at",
                    e.target.value
                      ? new Date(e.target.value).toISOString()
                      : null,
                  )
                }
                className="text-xs"
              />
            </div>
          </div>

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
              disabled={isSubmitting}
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
