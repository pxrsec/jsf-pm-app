"use client";

import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
  type UseFormRegister,
  type FieldErrors,
} from "react-hook-form";
import { useTranslations } from "next-intl";
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
import { ProjectAssigneeSelect } from "./project-assignee-select";
import { TaskPriorityBadge } from "./task-priority-badge";
import { formatDateForInput } from "@/lib/utils/date-helpers";
import type {
  ProjectMemberWithProfile,
  TaskPriority,
} from "@/lib/projects/queries";
import type { MemberCapacity } from "@/lib/status-maps";

interface TaskDetailsFieldsProps<
  TFieldValues extends FieldValues = FieldValues,
> {
  register: UseFormRegister<TFieldValues>;
  control: Control<TFieldValues>;
  errors: FieldErrors<TFieldValues>;
  selectedType: "internal_work" | "client_request";
  members: ProjectMemberWithProfile[];
  allowedMemberTypes: MemberCapacity[];
  isSubmitting: boolean;
  onAssigneeChange: (newId: string) => void;
}

export function TaskDetailsFields<TFieldValues extends FieldValues>({
  register,
  control,
  errors,
  selectedType,
  members,
  allowedMemberTypes,
  isSubmitting,
  onAssigneeChange,
}: TaskDetailsFieldsProps<TFieldValues>) {
  const t = useTranslations("projects.tasks.create");
  const tDeliverables = useTranslations("projects.workspace.deliverables");

  return (
    <>
      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="create-task-title" className="text-xs font-medium">
          {t("titleLabel")}
        </Label>
        <Input
          id="create-task-title"
          maxLength={200}
          placeholder={t("titlePlaceholder")}
          disabled={isSubmitting}
          {...register("title" as Path<TFieldValues>, { required: true })}
        />
        {errors.title && (
          <p className="text-xs text-destructive">
            {errors.title.message as string}
          </p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="create-task-desc" className="text-xs font-medium">
          {t("descriptionLabel")}
        </Label>
        <Textarea
          id="create-task-desc"
          maxLength={5000}
          rows={3}
          placeholder={t("descriptionPlaceholder")}
          disabled={isSubmitting}
          {...register("description" as Path<TFieldValues>, { required: true })}
        />
        {errors.description && (
          <p className="text-xs text-destructive">
            {errors.description.message as string}
          </p>
        )}
      </div>

      {/* Priority & Deadline Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">{t("priorityLabel")}</Label>
          <Controller
            control={control}
            name={"priority" as Path<TFieldValues>}
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={isSubmitting}
                items={(
                  ["low", "medium", "high", "blocking"] as TaskPriority[]
                ).map((p) => ({
                  value: p,
                  label: <TaskPriorityBadge priority={p} />,
                }))}
              >
                <SelectTrigger className="h-10 text-xs">
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
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="create-task-deadline" className="text-xs font-medium">
            {t("deadlineLabel")}
          </Label>
          <Controller
            control={control}
            name={"deadline_at" as Path<TFieldValues>}
            rules={{ required: true }}
            render={({ field }) => (
              <Input
                id="create-task-deadline"
                type="datetime-local"
                disabled={isSubmitting}
                value={formatDateForInput(field.value)}
                onChange={(e) => field.onChange(e.target.value)}
                className="h-10 text-xs"
              />
            )}
          />
          {errors.deadline_at && (
            <p className="text-xs text-destructive">
              {errors.deadline_at.message as string}
            </p>
          )}
        </div>
      </div>

      {/* Task Assignee */}
      <div className="space-y-1.5">
        <Controller
          control={control}
          name={"assignee_id" as Path<TFieldValues>}
          rules={{ required: true }}
          render={({ field }) => (
            <ProjectAssigneeSelect
              members={members}
              allowedMemberTypes={allowedMemberTypes}
              value={field.value}
              onChange={(newId) => {
                field.onChange(newId);
                onAssigneeChange(newId);
              }}
              disabled={isSubmitting}
              label={t("taskAssigneeLabel")}
              placeholder={
                selectedType === "client_request"
                  ? tDeliverables("form.assigneeClientPlaceholder")
                  : tDeliverables("form.assigneeInternalPlaceholder")
              }
              noCompatibleMembersText={
                selectedType === "client_request"
                  ? t("noCompatibleClientMembers")
                  : t("noCompatibleMembers")
              }
              error={errors.assignee_id?.message as string}
            />
          )}
        />
      </div>
    </>
  );
}
