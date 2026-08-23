"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { evaluateNotificationAlertsAction } from "@/lib/notifications/alert-evaluator-actions";
import type {
  ManualAlertEvaluationControl,
  AlertEvaluationSummary,
} from "@/lib/notifications/alert-evaluator-schemas";

export type ManualAlertEvaluationDialogProps = {
  control: ManualAlertEvaluationControl;
};

function isAllZero(summary: AlertEvaluationSummary): boolean {
  return (
    summary.tasksEvaluated === 0 &&
    summary.reviewsEvaluated === 0 &&
    summary.eventsCreated === 0 &&
    summary.inAppRecipientsCreated === 0 &&
    summary.externalSuppressionsCreated === 0
  );
}

/**
 * Controlled dialog for manual notification alert evaluation in development demo posture.
 * Provides accessible confirmation, safe project selection (for PM), pending state disabling,
 * localized truthfulness note, and non-leaking aggregate result feedback.
 */
export function ManualAlertEvaluationDialog({
  control,
}: ManualAlertEvaluationDialogProps) {
  const t = useTranslations("notificationOperations.manualEvaluation");
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>(
    control.kind === "pm-project" ? (control.projects[0]?.id ?? "") : "",
  );
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [summary, setSummary] = React.useState<AlertEvaluationSummary | null>(
    null,
  );
  const [errorCode, setErrorCode] = React.useState<
    "validation" | "unauthorized" | "unavailable" | null
  >(null);

  const effectiveProjectId = React.useMemo(() => {
    if (control.kind !== "pm-project") return "";
    const isValid = control.projects.some((p) => p.id === selectedProjectId);
    return isValid ? selectedProjectId : (control.projects[0]?.id ?? "");
  }, [control, selectedProjectId]);

  if (control.kind === "pm-project" && control.projects.length === 0) {
    return null;
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (isSubmitting) return;
    setOpen(nextOpen);
    if (!nextOpen) {
      setSummary(null);
      setErrorCode(null);
    }
  };

  const handleConfirm = async () => {
    setErrorCode(null);
    setSummary(null);
    setIsSubmitting(true);

    try {
      const input =
        control.kind === "admin-global"
          ? {}
          : { projectId: effectiveProjectId };

      const result = await evaluateNotificationAlertsAction(input);

      if (result.ok) {
        setSummary(result.data);
        router.refresh();
      } else {
        if (result.error.code === "VALIDATION_FAILED") {
          setErrorCode("validation");
        } else if (result.error.code === "UNAUTHORIZED") {
          setErrorCode("unauthorized");
        } else {
          setErrorCode("unavailable");
        }
      }
    } catch {
      setErrorCode("unavailable");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger
        render={
          <Button
            variant="outline"
            className="min-h-[44px] px-4 text-sm font-medium"
            aria-label={t("triggerAria")}
          />
        }
      >
        {t("trigger")}
      </AlertDialogTrigger>

      <AlertDialogContent size="default" className="space-y-4">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("dialogTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("dialogDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="rounded-md bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
          {t("noSendExplanation")}
        </div>

        {control.kind === "pm-project" && (
          <div className="space-y-1.5">
            <Label htmlFor="manual-eval-project-select">
              {t("projectLabel")}
            </Label>
            <select
              id="manual-eval-project-select"
              aria-label={t("projectAria")}
              value={effectiveProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              disabled={isSubmitting}
              className="min-h-[44px] h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {control.projects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div role="status" aria-live="polite" className="text-xs">
          {isSubmitting && (
            <p className="text-muted-foreground animate-pulse font-medium">
              {t("pending")}
            </p>
          )}

          {summary && !isSubmitting && (
            <div className="space-y-1.5 rounded-md bg-accent/40 p-3 border border-border">
              <p className="font-medium text-foreground">{t("successTitle")}</p>
              {isAllZero(summary) ? (
                <p className="text-muted-foreground">{t("zeroResult")}</p>
              ) : (
                <ul className="space-y-0.5 text-muted-foreground list-disc list-inside">
                  <li>
                    {t("summary.tasksEvaluated", {
                      count: summary.tasksEvaluated,
                    })}
                  </li>
                  <li>
                    {t("summary.reviewsEvaluated", {
                      count: summary.reviewsEvaluated,
                    })}
                  </li>
                  <li>
                    {t("summary.eventsCreated", {
                      count: summary.eventsCreated,
                    })}
                  </li>
                  <li>
                    {t("summary.inAppRecipientsCreated", {
                      count: summary.inAppRecipientsCreated,
                    })}
                  </li>
                  <li>
                    {t("summary.externalSuppressionsCreated", {
                      count: summary.externalSuppressionsCreated,
                    })}
                  </li>
                </ul>
              )}
            </div>
          )}
        </div>

        {errorCode && !isSubmitting && (
          <div
            role="alert"
            className="rounded-md bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive"
          >
            {t(`errors.${errorCode}`)}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>
            {t("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={isSubmitting}
            onClick={(e) => {
              e.preventDefault();
              void handleConfirm();
            }}
          >
            {isSubmitting ? t("pending") : t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
