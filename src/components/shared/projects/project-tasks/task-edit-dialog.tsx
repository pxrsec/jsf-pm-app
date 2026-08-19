"use client";

import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
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
import { TaskAssigneeSelect } from "./task-assignee-select";
import { TaskPriorityBadge } from "./task-priority-badge";
import { UpdateTaskSchema, type UpdateTaskInput } from "@/lib/projects/schemas";
import { updateTaskAction } from "@/lib/projects/task-actions";
import type {
  ProjectDetail,
  TaskPriority,
  TaskWithAssignee,
} from "@/lib/projects/queries";

interface TaskEditDialogProps {
  project: ProjectDetail;
  task: TaskWithAssignee | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

function formatDateForInput(isoString?: string | null): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 16);
  } catch {
    return "";
  }
}

export function TaskEditDialog({
  project,
  task,
  isOpen,
  onClose,
  onSuccess,
}: TaskEditDialogProps) {
  const t = useTranslations("projects.tasks.edit");
  const tType = useTranslations("projects.tasks.taskType");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<UpdateTaskInput>({
    resolver: zodResolver(UpdateTaskSchema),
    defaultValues: {
      title: task?.title ?? "",
      description: task?.description ?? "",
      priority: task?.priority ?? "medium",
      assignee_id: task?.assignee_id ?? "",
      deadline_at: formatDateForInput(task?.deadline_at),
    },
  });

  useEffect(() => {
    if (task) {
      reset({
        title: task.title,
        description: task.description,
        priority: task.priority,
        assignee_id: task.assignee_id,
        deadline_at: formatDateForInput(task.deadline_at),
      });
    }
  }, [task, reset]);

  if (!task) return null;

  const onSubmit = async (data: UpdateTaskInput) => {
    setIsSubmitting(true);
    try {
      const payload: UpdateTaskInput = {
        title: data.title,
        description: data.description,
        priority: data.priority,
        assignee_id: data.assignee_id,
        deadline_at: data.deadline_at
          ? new Date(data.deadline_at).toISOString()
          : undefined,
      };

      const result = await updateTaskAction(task.id, task.project_id, payload);
      if (!result.ok) {
        toast.error(result.error.message || t("errorToast"));
      } else {
        toast.success(t("successToast"));
        onClose();
        onSuccess?.();
      }
    } catch {
      toast.error(t("errorToast"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const typeKey =
    task.task_type === "internal_work" ? "internalWork" : "clientRequest";

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
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
          {/* Read-only Task Type */}
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">
              {t("typeReadOnly")}
            </Label>
            <div className="px-3 py-2 bg-muted/60 rounded-md text-sm font-medium text-foreground">
              {tType(typeKey)}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-task-title">{t("titleLabel")}</Label>
            <Input
              id="edit-task-title"
              disabled={isSubmitting}
              {...register("title")}
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-task-desc">{t("descriptionLabel")}</Label>
            <Textarea
              id="edit-task-desc"
              rows={3}
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
                      {(["low", "medium", "high", "blocking"] as TaskPriority[]).map(
                        (p) => (
                          <SelectItem key={p} value={p}>
                            <TaskPriorityBadge priority={p} />
                          </SelectItem>
                        ),
                      )}
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
              <Label htmlFor="edit-task-deadline">
                {t("deadlineLabel")}
              </Label>
              <Input
                id="edit-task-deadline"
                type="datetime-local"
                disabled={isSubmitting}
                {...register("deadline_at")}
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
              onClick={onClose}
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
