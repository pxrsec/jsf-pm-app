"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Edit3, Loader2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { ProjectAssigneeSelect } from "@/components/shared/projects/project-tasks/project-assignee-select";
import { DeliverableDeadlinesSection } from "./deliverable-deadlines-section";
import { DeliverableStatusBadge } from "./deliverable-status-badge";
import {
  UpdateDeliverableSchema,
  type UpdateDeliverableInput,
} from "@/lib/deliverables/schemas";
import { updateDeliverableAction } from "@/lib/deliverables/actions";
import type { ProjectDetail } from "@/lib/projects/queries";
import type { DeliverableListItem } from "@/lib/deliverables/queries";
import type { MemberCapacity } from "@/lib/status-maps";

interface DeliverableEditDialogProps {
  project: ProjectDetail;
  deliverable: DeliverableListItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function DeliverableEditDialog({
  project,
  deliverable,
  isOpen,
  onClose,
  onSuccess,
}: DeliverableEditDialogProps) {
  const t = useTranslations("projects.workspace.deliverables.editDialog");
  const tTasks = useTranslations("projects.tasks");
  const tDeliverables = useTranslations("projects.workspace.deliverables");
  const [serverError, setServerError] = useState<string | null>(null);

  const isClientProject = project.project_type === "client";
  const workflowType = deliverable?.workflow_type ?? "production";
  const taskType =
    workflowType === "production" ? "internal_work" : "client_request";

  const allowedMemberTypes: MemberCapacity[] =
    workflowType === "production"
      ? ["pm_lead", "pm_watcher", "operator"]
      : ["client"];

  const form = useForm<UpdateDeliverableInput>({
    resolver: zodResolver(UpdateDeliverableSchema),
    defaultValues: {
      title: "",
      specifications: "",
      assignee_id: "",
      submission_deadline_at: null,
      internal_review_deadline_at: null,
      client_delivery_deadline_at: null,
    },
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = form;

  useEffect(() => {
    if (deliverable) {
      reset({
        title: deliverable.title,
        specifications: deliverable.specifications,
        assignee_id: deliverable.assignee_id,
        submission_deadline_at: deliverable.submission_deadline_at,
        internal_review_deadline_at: deliverable.internal_review_deadline_at,
        client_delivery_deadline_at: deliverable.client_delivery_deadline_at,
      });
    }
  }, [deliverable, reset]);

  if (!deliverable) return null;

  const onSubmit = async (data: UpdateDeliverableInput) => {
    setServerError(null);
    const result = await updateDeliverableAction({
      deliverableId: deliverable.id,
      projectId: project.id,
      input: data,
    });

    if (result.ok) {
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
          setServerError(null);
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Edit3 className="size-4" />
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

        {/* Read-Only Status, Workflow & Version Context */}
        <div className="flex flex-wrap items-center gap-2.5 bg-muted/40 p-3 rounded-lg border border-border/60">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">{t("statusLabel")}</span>
            <DeliverableStatusBadge status={deliverable.status} />
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <Badge variant="outline" className="text-[11px]">
              {deliverable.workflow_type === "client_submission"
                ? tDeliverables("workflowType.clientSubmission")
                : tDeliverables("workflowType.production")}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">{t("versionLabel")}</span>
            <Badge variant="secondary" className="font-mono text-xs">
              v{deliverable.current_version_number}
            </Badge>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-title" className="text-xs font-medium">
              {t("titleLabel")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-title"
              maxLength={180}
              {...register("title")}
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
                  disabled={isSubmitting}
                  label={t("assigneeLabel")}
                  placeholder={
                    workflowType === "client_submission"
                      ? tDeliverables("form.assigneeClientPlaceholder")
                      : tDeliverables("form.assigneeInternalPlaceholder")
                  }
                  noCompatibleMembersText={
                    workflowType === "client_submission"
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
              htmlFor="edit-specifications"
              className="text-xs font-medium"
            >
              {t("specificationsLabel")}
            </Label>
            <Textarea
              id="edit-specifications"
              maxLength={30000}
              {...register("specifications")}
              rows={3}
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
            disabled={isSubmitting}
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
