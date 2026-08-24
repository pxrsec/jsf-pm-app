"use client";

import { useState } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TaskAssigneeSelect } from "./task-assignee-select";
import { TaskPriorityBadge } from "./task-priority-badge";
import { CreateTaskSchema, type CreateTaskInput } from "@/lib/projects/schemas";
import { createTaskAction } from "@/lib/projects/task-actions";
import type { ProjectDetail, TaskPriority } from "@/lib/projects/queries";

function formatDateForInput(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 16);
  } catch {
    return "";
  }
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
  const tType = useTranslations("projects.tasks.taskType");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isInternalProject = project.project_type === "internal";

  // Find a default active member to pre-select
  const defaultMember = project.members.find(
    (m) => !m.deleted_at && m.profile?.is_active,
  );

  const {
    register,
    handleSubmit,
    control,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateTaskInput>({
    resolver: zodResolver(CreateTaskSchema),
    defaultValues: {
      project_id: project.id,
      task_type: "internal_work",
      title: "",
      description: "",
      priority: "medium",
      assignee_id: defaultMember?.user_id ?? "",
      deadline_at: "",
    },
  });

  const selectedType = useWatch({
    control,
    name: "task_type",
    defaultValue: "internal_work",
  });

  const onSubmit = async (data: CreateTaskInput) => {
    setIsSubmitting(true);
    try {
      // Ensure deadline is ISO formatted
      const isoDeadline = new Date(data.deadline_at).toISOString();
      const payload: CreateTaskInput = {
        ...data,
        deadline_at: isoDeadline,
      };

      const result = await createTaskAction(payload);
      if (!result.ok) {
        toast.error(result.error.message || t("errorToast"));
      } else {
        toast.success(t("successToast"));
        reset();
        onClose();
        onSuccess?.();
      }
    } catch {
      toast.error(t("errorToast"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
          {/* Task Type Toggle */}
          <div className="space-y-2">
            <Label>{t("typeLabel")}</Label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg">
              <Button
                type="button"
                variant={selectedType === "internal_work" ? "default" : "ghost"}
                size="sm"
                className="text-xs h-8"
                onClick={() => setValue("task_type", "internal_work")}
              >
                {tType("internalWork")}
              </Button>

              {isInternalProject ? (
                <Tooltip>
                  <TooltipTrigger
                    type="button"
                    disabled
                    className="text-xs h-8 w-full opacity-50 cursor-not-allowed inline-flex items-center justify-center rounded-md font-medium"
                  >
                    {tType("clientRequest")}
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      {tType("clientRequestOnlyForClientProjects")}
                    </p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  type="button"
                  variant={
                    selectedType === "client_request" ? "default" : "ghost"
                  }
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => setValue("task_type", "client_request")}
                >
                  {tType("clientRequest")}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedType === "internal_work"
                ? tType("internalDescription")
                : tType("clientRequestDescription")}
            </p>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="create-task-title">{t("titleLabel")}</Label>
            <Input
              id="create-task-title"
              placeholder={t("titlePlaceholder")}
              disabled={isSubmitting}
              {...register("title")}
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="create-task-desc">{t("descriptionLabel")}</Label>
            <Textarea
              id="create-task-desc"
              rows={3}
              placeholder={t("descriptionPlaceholder")}
              disabled={isSubmitting}
              {...register("description")}
            />
            {errors.description && (
              <p className="text-xs text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>

          {/* Priority & Deadline Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Priority */}
            <div className="space-y-1.5">
              <Label>{t("priorityLabel")}</Label>
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        ["low", "medium", "high", "blocking"] as TaskPriority[]
                      ).map((p) => (
                        <SelectItem key={p} value={p}>
                          <TaskPriorityBadge priority={p} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.priority && (
                <p className="text-xs text-destructive">
                  {errors.priority.message}
                </p>
              )}
            </div>

            {/* Deadline */}
            <div className="space-y-1.5">
              <Label htmlFor="create-task-deadline">{t("deadlineLabel")}</Label>
              <Controller
                control={control}
                name="deadline_at"
                render={({ field }) => (
                  <Input
                    id="create-task-deadline"
                    type="datetime-local"
                    disabled={isSubmitting}
                    value={field.value ? formatDateForInput(field.value) : ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value
                          ? new Date(e.target.value).toISOString()
                          : "",
                      )
                    }
                  />
                )}
              />
              {errors.deadline_at && (
                <p className="text-xs text-destructive">
                  {errors.deadline_at.message}
                </p>
              )}
            </div>
          </div>

          {/* Assignee */}
          <div className="space-y-1.5">
            <Label>{t("assigneeLabel")}</Label>
            <Controller
              control={control}
              name="assignee_id"
              render={({ field }) => (
                <TaskAssigneeSelect
                  members={project.members}
                  value={field.value}
                  onChange={field.onChange}
                  disabled={isSubmitting}
                  error={errors.assignee_id?.message}
                />
              )}
            />
          </div>

          <DialogFooter className="pt-3 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                onClose();
              }}
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
  );
}
