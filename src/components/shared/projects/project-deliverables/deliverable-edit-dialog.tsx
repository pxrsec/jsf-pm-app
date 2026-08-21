"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useForm, useWatch } from "react-hook-form";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UpdateDeliverableSchema,
  type UpdateDeliverableInput,
} from "@/lib/deliverables/schemas";
import { updateDeliverableAction } from "@/lib/deliverables/actions";
import { DeliverableStatusBadge } from "./deliverable-status-badge";
import type { ProjectDetail } from "@/lib/projects/queries";
import type { DeliverableListItem } from "@/lib/deliverables/queries";

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
  const [serverError, setServerError] = useState<string | null>(null);

  const eligibleAssignees = project.members.filter(
    (m) =>
      !m.deleted_at &&
      m.profile?.is_active &&
      ["pm_lead", "pm_watcher", "operator"].includes(m.member_type),
  );

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
    setValue,
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

  const selectedAssigneeId = useWatch({ control, name: "assignee_id" });

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

        {/* Read-Only Status & Version Context */}
        <div className="flex items-center gap-3 bg-muted/40 p-3 rounded-lg border border-border/60">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">{t("statusLabel")}</span>
            <DeliverableStatusBadge status={deliverable.status} />
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
            <Input id="edit-title" {...register("title")} className="text-xs" />
            {errors.title && (
              <p className="text-[11px] text-destructive">
                {errors.title.message}
              </p>
            )}
          </div>

          {/* Assignee Selection */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-assignee" className="text-xs font-medium">
              {t("assigneeLabel")}
            </Label>
            <Select
              value={selectedAssigneeId}
              onValueChange={(val) => {
                if (val) setValue("assignee_id", val);
              }}
            >
              <SelectTrigger id="edit-assignee" className="text-xs">
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
              htmlFor="edit-specifications"
              className="text-xs font-medium"
            >
              {t("specificationsLabel")}
            </Label>
            <Textarea
              id="edit-specifications"
              {...register("specifications")}
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
                htmlFor="edit-sub-deadline"
                className="text-[11px] font-medium"
              >
                {t("submissionDeadlineLabel")}
              </Label>
              <Input
                id="edit-sub-deadline"
                type="datetime-local"
                defaultValue={
                  deliverable.submission_deadline_at
                    ? new Date(deliverable.submission_deadline_at)
                        .toISOString()
                        .slice(0, 16)
                    : ""
                }
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
                htmlFor="edit-rev-deadline"
                className="text-[11px] font-medium"
              >
                {t("internalReviewDeadlineLabel")}
              </Label>
              <Input
                id="edit-rev-deadline"
                type="datetime-local"
                defaultValue={
                  deliverable.internal_review_deadline_at
                    ? new Date(deliverable.internal_review_deadline_at)
                        .toISOString()
                        .slice(0, 16)
                    : ""
                }
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
                htmlFor="edit-del-deadline"
                className="text-[11px] font-medium"
              >
                {t("clientDeliveryDeadlineLabel")}
              </Label>
              <Input
                id="edit-del-deadline"
                type="datetime-local"
                defaultValue={
                  deliverable.client_delivery_deadline_at
                    ? new Date(deliverable.client_delivery_deadline_at)
                        .toISOString()
                        .slice(0, 16)
                    : ""
                }
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
