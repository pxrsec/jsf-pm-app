"use client";

import {
  useFieldArray,
  type Control,
  type UseFormSetValue,
  type UseFormGetValues,
  type FieldValues,
  type ArrayPath,
  type Path,
  type PathValue,
} from "react-hook-form";

export type TaskDeliverableDraftFormValue = {
  id?: string;
  sameAsTaskAssignee: boolean;
  assignee_id: string;
  title: string;
  specifications: string;
  submission_deadline_at: string | null;
  internal_review_deadline_at: string | null;
  client_delivery_deadline_at: string | null;
};

export function useTaskDeliverableDrafts<
  TFieldValues extends FieldValues = FieldValues,
>(
  control: Control<TFieldValues>,
  setValue: UseFormSetValue<TFieldValues>,
  getValues: UseFormGetValues<TFieldValues>,
) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "deliverables" as ArrayPath<TFieldValues>,
  });

  const addDraft = (defaultAssigneeId: string) => {
    if (fields.length >= 20) return;
    const newDraft: TaskDeliverableDraftFormValue = {
      sameAsTaskAssignee: true,
      assignee_id: defaultAssigneeId,
      title: "",
      specifications: "",
      submission_deadline_at: null,
      internal_review_deadline_at: null,
      client_delivery_deadline_at: null,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    append(newDraft as any);
  };

  const removeDraft = (index: number) => {
    remove(index);
  };

  const clearDrafts = () => {
    setValue(
      "deliverables" as Path<TFieldValues>,
      [] as unknown as PathValue<TFieldValues, Path<TFieldValues>>,
    );
  };

  const syncTaskAssigneeChange = (newTaskAssigneeId: string) => {
    const currentDrafts =
      (getValues(
        "deliverables" as Path<TFieldValues>,
      ) as TaskDeliverableDraftFormValue[]) || [];
    currentDrafts.forEach(
      (draft: TaskDeliverableDraftFormValue, idx: number) => {
        if (draft.sameAsTaskAssignee) {
          setValue(
            `deliverables.${idx}.assignee_id` as Path<TFieldValues>,
            newTaskAssigneeId as PathValue<TFieldValues, Path<TFieldValues>>,
            {
              shouldValidate: true,
            },
          );
        }
      },
    );
  };

  return {
    fields,
    addDraft,
    removeDraft,
    clearDrafts,
    syncTaskAssigneeChange,
    draftCount: fields.length,
    canAddMore: fields.length < 20,
  };
}
