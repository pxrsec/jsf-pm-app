"use client";

import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from "react-hook-form";
import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateForInput } from "@/lib/utils/date-helpers";

interface DeliverableDeadlinesSectionProps<
  TFieldValues extends FieldValues = FieldValues,
> {
  control: Control<TFieldValues>;
  taskType: "internal_work" | "client_request";
  isClientProject: boolean;
  disabled?: boolean;
}

export function DeliverableDeadlinesSection<TFieldValues extends FieldValues>({
  control,
  taskType,
  isClientProject,
  disabled = false,
}: DeliverableDeadlinesSectionProps<TFieldValues>) {
  const tTasks = useTranslations("projects.tasks");
  const tDeliverables = useTranslations("projects.workspace.deliverables");

  if (taskType === "client_request") {
    return (
      <div className="space-y-1.5 pt-1 border-t border-border/40">
        <Label htmlFor="create-sub-deadline" className="text-xs font-medium">
          {tDeliverables("form.submissionDeadlineLabel")}{" "}
          <span className="text-destructive">*</span>
        </Label>
        <Controller
          control={control}
          name={"submission_deadline_at" as Path<TFieldValues>}
          render={({ field }) => (
            <Input
              id="create-sub-deadline"
              type="datetime-local"
              disabled={disabled}
              value={formatDateForInput(field.value)}
              onChange={(e) =>
                field.onChange(
                  e.target.value
                    ? new Date(e.target.value).toISOString()
                    : null,
                )
              }
              className="text-xs h-10"
            />
          )}
        />
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Info className="size-3 shrink-0" />
          <span>{tTasks("create.submissionDeadlineHelp")}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="pt-1 border-t border-border/40">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="create-rev-deadline" className="text-xs font-medium">
            {tDeliverables("form.internalReviewDeadlineLabel")}{" "}
            <span className="text-destructive">*</span>
          </Label>
          <Controller
            control={control}
            name={"internal_review_deadline_at" as Path<TFieldValues>}
            render={({ field }) => (
              <Input
                id="create-rev-deadline"
                type="datetime-local"
                disabled={disabled}
                value={formatDateForInput(field.value)}
                onChange={(e) =>
                  field.onChange(
                    e.target.value
                      ? new Date(e.target.value).toISOString()
                      : null,
                  )
                }
                className="text-xs h-10"
              />
            )}
          />
        </div>

        {isClientProject && (
          <div className="space-y-1.5">
            <Label
              htmlFor="create-del-deadline"
              className="text-xs font-medium"
            >
              {tDeliverables("form.clientDeliveryDeadlineLabel")}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Controller
              control={control}
              name={"client_delivery_deadline_at" as Path<TFieldValues>}
              render={({ field }) => (
                <Input
                  id="create-del-deadline"
                  type="datetime-local"
                  disabled={disabled}
                  value={formatDateForInput(field.value)}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null,
                    )
                  }
                  className="text-xs h-10"
                />
              )}
            />
          </div>
        )}
      </div>
    </div>
  );
}
