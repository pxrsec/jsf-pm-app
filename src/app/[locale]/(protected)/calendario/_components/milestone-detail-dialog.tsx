"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { getMilestoneDetailAction } from "@/lib/calendar/actions";
import type { MilestoneDetailDto } from "@/lib/calendar/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface MilestoneDetailDialogProps {
  milestoneId?: string;
  isOpen: boolean;
  canManage: boolean;
  onClose: () => void;
  onEdit: (id: string, focusTasks?: boolean) => void;
  onDelete: (id: string, title: string) => void;
}

interface DetailContentProps extends Omit<
  MilestoneDetailDialogProps,
  "isOpen"
> {
  milestoneId: string;
}

export function MilestoneDetailDialog({
  milestoneId,
  isOpen,
  canManage,
  onClose,
  onEdit,
  onDelete,
}: MilestoneDetailDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      {isOpen && milestoneId ? (
        <MilestoneDetailContent
          key={milestoneId}
          milestoneId={milestoneId}
          canManage={canManage}
          onClose={onClose}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ) : null}
    </Dialog>
  );
}

function MilestoneDetailContent({
  milestoneId,
  canManage,
  onClose,
  onEdit,
  onDelete,
}: DetailContentProps) {
  const t = useTranslations("calendar");
  const locale = useLocale();
  const [result, setResult] = useState<
    | { status: "loading" }
    | { status: "unavailable" }
    | { status: "ready"; detail: MilestoneDetailDto }
  >({ status: "loading" });

  useEffect(() => {
    let active = true;

    void getMilestoneDetailAction({ milestoneId })
      .then((response) => {
        if (!active) return;
        setResult(
          response.ok
            ? { status: "ready", detail: response.data }
            : { status: "unavailable" },
        );
      })
      .catch(() => {
        if (active) setResult({ status: "unavailable" });
      });

    return () => {
      active = false;
    };
  }, [milestoneId]);

  const detail = result.status === "ready" ? result.detail : null;
  const progress =
    detail && detail.activeTaskCount > 0
      ? Math.round((detail.completedTaskCount / detail.activeTaskCount) * 100)
      : null;

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t("detail.title")}</DialogTitle>
        <DialogDescription>{t("detail.description")}</DialogDescription>
      </DialogHeader>

      {result.status === "loading" && (
        <Loader2 className="mx-auto my-10 size-6 animate-spin" />
      )}
      {result.status === "unavailable" && (
        <p role="alert" className="text-sm text-muted-foreground">
          {t("detail.unavailable")}
        </p>
      )}
      {detail && (
        <div className="space-y-4 text-sm">
          <p className="font-medium">{detail.title}</p>
          <p>
            {detail.scope === "company"
              ? t("scope.companyMilestone")
              : t("scope.projectMilestone")}
          </p>
          <p>
            {t("detail.targetDate")}:{" "}
            {new Intl.DateTimeFormat(locale, {
              dateStyle: "medium",
              timeZone: "UTC",
            }).format(new Date(`${detail.targetDate}T00:00:00Z`))}
          </p>
          {detail.description && (
            <p className="whitespace-pre-wrap">{detail.description}</p>
          )}
          {detail.projectName && (
            <p>
              {t("detail.project")}: {detail.projectName}
            </p>
          )}
          {progress === null ? (
            <p>{t("detail.untracked")}</p>
          ) : (
            <div className="space-y-1">
              <p>
                {progress}% · {detail.completedTaskCount} /{" "}
                {detail.activeTaskCount}
              </p>
              <div
                role="progressbar"
                aria-label={t("detail.progressLabel")}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                className="h-2 rounded bg-muted"
              >
                <div
                  className="h-full rounded bg-primary"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
          <ul className="space-y-1">
            {detail.tasks.map((task) => (
              <li key={task.taskId}>
                {task.projectName}: {task.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      <DialogFooter>
        {canManage && detail && (
          <>
            <Button
              variant="outline"
              onClick={() => onEdit(detail.milestoneId)}
            >
              {t("actions.editMilestone")}
            </Button>
            <Button
              variant="outline"
              onClick={() => onEdit(detail.milestoneId, true)}
            >
              {t("actions.addTasks")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => onDelete(detail.milestoneId, detail.title)}
            >
              {t("actions.deleteMilestone")}
            </Button>
          </>
        )}
        <Button onClick={onClose}>{t("actions.close")}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
