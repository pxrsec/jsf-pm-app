"use client";

import { useTranslations } from "next-intl";
import { Trash2, Link2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ProjectAssigneeSelect } from "./project-assignee-select";
import { formatDateForInput } from "@/lib/utils/date-helpers";
import type { ProjectMemberWithProfile } from "@/lib/projects/queries";
import type { MemberCapacity } from "@/lib/status-maps";
import type {
  UseFormRegister,
  UseFormSetValue,
  UseFormWatch,
  FieldErrors,
} from "react-hook-form";

interface DraftDeliverableCardProps {
  index: number;
  taskType: "internal_work" | "client_request";
  projectType: "client" | "internal";
  members: ProjectMemberWithProfile[];
  taskAssigneeId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setValue: UseFormSetValue<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  watch: UseFormWatch<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: FieldErrors<any>;
  onRemove: () => void;
}

export function DraftDeliverableCard({
  index,
  taskType,
  projectType,
  members,
  taskAssigneeId,
  register,
  setValue,
  watch,
  errors,
  onRemove,
}: DraftDeliverableCardProps) {
  const t = useTranslations("projects.tasks.create");
  const tDeliverables = useTranslations("projects.workspace.deliverables");

  const sameAsTaskAssignee = watch(`deliverables.${index}.sameAsTaskAssignee`);
  const assigneeId = watch(`deliverables.${index}.assignee_id`);
  const submissionDeadline = watch(
    `deliverables.${index}.submission_deadline_at`,
  );
  const internalReviewDeadline = watch(
    `deliverables.${index}.internal_review_deadline_at`,
  );
  const clientDeliveryDeadline = watch(
    `deliverables.${index}.client_delivery_deadline_at`,
  );

  const allowedMemberTypes: MemberCapacity[] =
    taskType === "internal_work"
      ? ["pm_lead", "pm_watcher", "operator"]
      : ["client"];

  const draftErrors = (errors.deliverables as Record<string, unknown>)?.[
    index
  ] as Record<string, { message?: string }> | undefined;

  return (
    <div className="p-4 rounded-xl border border-border/80 bg-card/60 space-y-3.5 shadow-2xs">
      <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">
            #{index + 1}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <Link2 className="size-3 text-primary/70" />
            <span>{t("linkedToTaskNotice")}</span>
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="size-7 text-muted-foreground hover:text-destructive"
          aria-label={t("removeDeliverableAria", { number: index + 1 })}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <div className="space-y-3">
        {/* Title */}
        <div className="space-y-1">
          <Label className="text-xs font-medium">{t("draftTitleLabel")}</Label>
          <Input
            {...register(`deliverables.${index}.title`)}
            maxLength={180}
            placeholder={t("draftTitlePlaceholder")}
            className="h-9 text-xs"
          />
          {draftErrors?.title?.message && (
            <p className="text-[11px] text-destructive">
              {draftErrors.title.message}
            </p>
          )}
        </div>

        {/* Specifications */}
        <div className="space-y-1">
          <Label className="text-xs font-medium">
            {t("draftSpecificationsLabel")}
          </Label>
          <Textarea
            {...register(`deliverables.${index}.specifications`)}
            maxLength={30000}
            placeholder={t("draftSpecificationsPlaceholder")}
            className="text-xs min-h-[70px] resize-y"
          />
          {draftErrors?.specifications?.message && (
            <p className="text-[11px] text-destructive">
              {draftErrors.specifications.message}
            </p>
          )}
        </div>

        {/* Assignee Selection */}
        <div className="space-y-2 pt-1 border-t border-border/40">
          <div className="flex items-center gap-2">
            <Checkbox
              id={`draft-${index}-same-assignee`}
              checked={sameAsTaskAssignee}
              onCheckedChange={(checked) => {
                const isSame = Boolean(checked);
                setValue(`deliverables.${index}.sameAsTaskAssignee`, isSame);
                if (isSame && taskAssigneeId) {
                  setValue(
                    `deliverables.${index}.assignee_id`,
                    taskAssigneeId,
                    {
                      shouldValidate: true,
                    },
                  );
                }
              }}
            />
            <Label
              htmlFor={`draft-${index}-same-assignee`}
              className="text-xs font-normal text-muted-foreground cursor-pointer"
            >
              {t("sameAsTaskAssignee")}
            </Label>
          </div>

          {!sameAsTaskAssignee && (
            <ProjectAssigneeSelect
              members={members}
              allowedMemberTypes={allowedMemberTypes}
              value={assigneeId}
              onChange={(newId) =>
                setValue(`deliverables.${index}.assignee_id`, newId, {
                  shouldValidate: true,
                })
              }
              label={t("deliverableAssigneeLabel")}
              placeholder={
                taskType === "client_request"
                  ? tDeliverables("form.assigneeClientPlaceholder")
                  : tDeliverables("form.assigneeInternalPlaceholder")
              }
              noCompatibleMembersText={
                taskType === "client_request"
                  ? t("noCompatibleClientMembers")
                  : t("noCompatibleMembers")
              }
              error={draftErrors?.assignee_id?.message}
            />
          )}
        </div>

        {/* Workflow Deadlines */}
        <div className="pt-1 border-t border-border/40 space-y-2">
          {taskType === "client_request" ? (
            <div className="space-y-1">
              <Label className="text-xs font-medium">
                {tDeliverables("form.submissionDeadlineLabel")}
              </Label>
              <Input
                type="datetime-local"
                value={formatDateForInput(submissionDeadline)}
                onChange={(e) => {
                  const val = e.target.value
                    ? new Date(e.target.value).toISOString()
                    : null;
                  setValue(
                    `deliverables.${index}.submission_deadline_at`,
                    val,
                    {
                      shouldValidate: true,
                    },
                  );
                }}
                className="h-9 text-xs"
              />
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Info className="size-3 shrink-0" />
                <span>{t("submissionDeadlineHelp")}</span>
              </p>
              {draftErrors?.submission_deadline_at?.message && (
                <p className="text-[11px] text-destructive">
                  {draftErrors.submission_deadline_at.message}
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-medium">
                  {tDeliverables("form.internalReviewDeadlineLabel")}
                </Label>
                <Input
                  type="datetime-local"
                  value={formatDateForInput(internalReviewDeadline)}
                  onChange={(e) => {
                    const val = e.target.value
                      ? new Date(e.target.value).toISOString()
                      : null;
                    setValue(
                      `deliverables.${index}.internal_review_deadline_at`,
                      val,
                      { shouldValidate: true },
                    );
                  }}
                  className="h-9 text-xs"
                />
                {draftErrors?.internal_review_deadline_at?.message && (
                  <p className="text-[11px] text-destructive">
                    {draftErrors.internal_review_deadline_at.message}
                  </p>
                )}
              </div>

              {projectType === "client" && (
                <div className="space-y-1">
                  <Label className="text-xs font-medium">
                    {tDeliverables("form.clientDeliveryDeadlineLabel")}
                  </Label>
                  <Input
                    type="datetime-local"
                    value={formatDateForInput(clientDeliveryDeadline)}
                    onChange={(e) => {
                      const val = e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null;
                      setValue(
                        `deliverables.${index}.client_delivery_deadline_at`,
                        val,
                        { shouldValidate: true },
                      );
                    }}
                    className="h-9 text-xs"
                  />
                  {draftErrors?.client_delivery_deadline_at?.message && (
                    <p className="text-[11px] text-destructive">
                      {draftErrors.client_delivery_deadline_at.message}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
