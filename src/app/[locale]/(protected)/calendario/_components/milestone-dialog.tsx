"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import type {
  CalendarColorOverride,
  CalendarMilestoneTargetDto,
} from "@/lib/calendar/types";
import { isCalendarColorOverride } from "@/lib/calendar/types";
import {
  parseMilestoneInputToIso,
  parseIsoToLocalInput,
  formatIsoWithOffset,
} from "@/lib/calendar/date-utils";
import {
  createCalendarMilestoneAction,
  updateCalendarMilestoneAction,
  getCalendarMilestoneForEditAction,
} from "@/lib/calendar/actions";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

interface MilestoneDialogProps {
  isOpen: boolean;
  mode: "create" | "edit";
  editEventId?: string;
  targets: CalendarMilestoneTargetDto[];
  fixedProjectId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function MilestoneDialog({
  isOpen,
  mode,
  editEventId,
  targets,
  fixedProjectId,
  onClose,
  onSuccess,
}: MilestoneDialogProps) {
  const t = useTranslations("calendar");
  const isEdit = mode === "edit";

  const defaultDateStr = useMemo(() => {
    return parseIsoToLocalInput(formatIsoWithOffset(new Date()), true);
  }, []);

  const [projectId, setProjectId] = useState<string>(
    fixedProjectId ?? targets[0]?.project_id ?? "",
  );
  const [taskId, setTaskId] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [isAllDay, setIsAllDay] = useState<boolean>(true);
  const [startDate, setStartDate] = useState<string>(defaultDateStr);
  const [endDate, setEndDate] = useState<string>(defaultDateStr);
  const [colorOverride, setColorOverride] = useState<
    CalendarColorOverride | ""
  >("");

  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const uniqueProjects = useMemo(() => {
    const map = new Map<string, string>();
    for (const target of targets) {
      if (!map.has(target.project_id)) {
        map.set(target.project_id, target.project_name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [targets]);

  const availableTasks = useMemo(() => {
    if (!projectId) return [];
    return targets
      .filter((t) => t.project_id === projectId && t.task_id && t.task_title)
      .map((t) => ({ id: t.task_id as string, title: t.task_title as string }));
  }, [targets, projectId]);

  useEffect(() => {
    if (!isOpen) return;

    let ignore = false;
    if (isEdit && editEventId) {
      const loadDetail = async () => {
        setIsLoadingDetail(true);
        setErrorMessage(null);
        try {
          const result = await getCalendarMilestoneForEditAction({
            eventId: editEventId,
          });
          if (ignore) return;
          if (!result.ok) {
            setErrorMessage(result.error.message);
            return;
          }
          const data = result.data;
          setProjectId(data.project_id);
          setTaskId(data.task_id ?? "");
          setTitle(data.title);
          setDescription(data.description ?? "");
          setIsAllDay(data.is_all_day);
          setStartDate(
            parseIsoToLocalInput(data.starts_at, data.is_all_day, "start"),
          );
          setEndDate(
            parseIsoToLocalInput(
              data.ends_at,
              data.is_all_day,
              "inclusive-end",
            ),
          );
          setColorOverride(data.color_override ?? "");
        } catch {
          if (!ignore) setErrorMessage(t("states.error"));
        } finally {
          if (!ignore) setIsLoadingDetail(false);
        }
      };
      void loadDetail();
    }
    return () => {
      ignore = true;
    };
  }, [isOpen, isEdit, editEventId, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const activeProject = projectId || fixedProjectId || uniqueProjects[0]?.id;
    if (!activeProject) {
      setErrorMessage(t("form.validation.projectRequired"));
      return;
    }
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMessage(t("form.validation.titleRequired"));
      return;
    }
    if (trimmedTitle.length > 160) {
      setErrorMessage(t("form.validation.titleLength"));
      return;
    }
    if (description && description.trim().length > 2000) {
      setErrorMessage(t("form.validation.descriptionTooLong"));
      return;
    }
    if (!startDate) {
      setErrorMessage(t("form.validation.startsAtRequired"));
      return;
    }
    if (endDate && endDate < startDate) {
      setErrorMessage(t("form.validation.endBeforeStart"));
      return;
    }

    const startsAtIso = parseMilestoneInputToIso({
      value: startDate,
      isAllDay,
      boundary: "start",
    });
    const endsAtIso = endDate
      ? parseMilestoneInputToIso({
          value: endDate,
          isAllDay,
          boundary: "inclusive-end",
        })
      : null;

    if (!startsAtIso) {
      setErrorMessage(t("form.validation.startsAtRequired"));
      return;
    }

    setIsSaving(true);
    try {
      const color = isCalendarColorOverride(colorOverride)
        ? colorOverride
        : null;
      if (isEdit && editEventId) {
        const result = await updateCalendarMilestoneAction({
          eventId: editEventId,
          projectId: activeProject,
          taskId: taskId || null,
          title: trimmedTitle,
          description: description.trim() || null,
          startsAt: startsAtIso,
          endsAt: endsAtIso,
          isAllDay,
          colorOverride: color,
        });
        if (!result.ok) {
          setErrorMessage(result.error.message);
          return;
        }
        toast.success(t("states.successUpdate"));
      } else {
        const result = await createCalendarMilestoneAction({
          projectId: activeProject,
          taskId: taskId || null,
          title: trimmedTitle,
          description: description.trim() || null,
          startsAt: startsAtIso,
          endsAt: endsAtIso,
          isAllDay,
          colorOverride: color,
        });
        if (!result.ok) {
          setErrorMessage(result.error.message);
          return;
        }
        toast.success(t("states.successCreate"));
      }
      onSuccess();
      onClose();
    } catch {
      setErrorMessage(t("states.error"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("form.editTitle") : t("form.createTitle")}
          </DialogTitle>
          <DialogDescription>{t("form.dialogDescription")}</DialogDescription>
        </DialogHeader>

        {isLoadingDetail ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {t("states.loadingDetail")}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMessage && (
              <div
                role="alert"
                className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive"
              >
                {errorMessage}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="milestone-project">
                {t("form.projectLabel")}
              </Label>
              <select
                id="milestone-project"
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setTaskId("");
                }}
                disabled={Boolean(fixedProjectId) || isSaving}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                <option value="">{t("form.projectPlaceholder")}</option>
                {uniqueProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="milestone-task">{t("form.taskLabel")}</Label>
              <select
                id="milestone-task"
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                disabled={!projectId || isSaving}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                <option value="">{t("form.taskPlaceholder")}</option>
                {availableTasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="milestone-title">{t("form.titleLabel")}</Label>
              <Input
                id="milestone-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("form.titlePlaceholder")}
                maxLength={160}
                required
                disabled={isSaving}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="milestone-description">
                {t("form.descriptionLabel")}
              </Label>
              <Textarea
                id="milestone-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("form.descriptionPlaceholder")}
                rows={3}
                maxLength={2000}
                disabled={isSaving}
              />
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <Checkbox
                id="milestone-all-day"
                checked={isAllDay}
                onCheckedChange={(checked) => {
                  const allDayVal = Boolean(checked);
                  setIsAllDay(allDayVal);
                  const today = parseIsoToLocalInput(
                    formatIsoWithOffset(new Date()),
                    allDayVal,
                  );
                  setStartDate(today);
                  setEndDate(today);
                }}
                disabled={isSaving}
              />
              <Label
                htmlFor="milestone-all-day"
                className="cursor-pointer text-sm font-medium leading-none"
              >
                {t("form.isAllDayLabel")}
              </Label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="milestone-start">
                  {isAllDay
                    ? t("form.startDateLabel")
                    : t("form.startsAtLabel")}
                </Label>
                <Input
                  id="milestone-start"
                  type={isAllDay ? "date" : "datetime-local"}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="milestone-end">
                  {isAllDay ? t("form.endDateLabel") : t("form.endsAtLabel")}
                </Label>
                <Input
                  id="milestone-end"
                  type={isAllDay ? "date" : "datetime-local"}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="milestone-color">{t("form.colorLabel")}</Label>
              <select
                id="milestone-color"
                value={colorOverride}
                onChange={(e) =>
                  setColorOverride(e.target.value as CalendarColorOverride | "")
                }
                disabled={isSaving}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                <option value="">{t("form.defaultColor")}</option>
                <option value="chart-1">{t("colors.chart-1")}</option>
                <option value="chart-2">{t("colors.chart-2")}</option>
                <option value="chart-3">{t("colors.chart-3")}</option>
                <option value="chart-4">{t("colors.chart-4")}</option>
                <option value="chart-5">{t("colors.chart-5")}</option>
              </select>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSaving}
              >
                {t("actions.cancel")}
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("actions.saving")}
                  </>
                ) : isEdit ? (
                  t("actions.saveChanges")
                ) : (
                  t("actions.save")
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
