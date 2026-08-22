"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  startClientRequestAction,
  completeClientRequestAction,
} from "@/lib/client/actions";
import {
  CLIENT_ERROR_KEY_BY_CODE,
  type TaskStatus,
  type ClientRequestReadinessSummary,
} from "@/lib/client/types";
import { Play, CheckCircle, AlertTriangle, AlertCircle } from "lucide-react";

interface ClientRequestActionsProps {
  taskId: string;
  currentStatus: TaskStatus;
  readinessSummary: ClientRequestReadinessSummary;
}

export function ClientRequestActions({
  taskId,
  currentStatus,
  readinessSummary,
}: ClientRequestActionsProps) {
  const t = useTranslations("projects.clientRequests.actions");
  const router = useRouter();
  const [isPending, startActionTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function handleStart() {
    setErrorMessage(null);
    setSuccessMessage(null);

    startActionTransition(async () => {
      try {
        const result = await startClientRequestAction({ task_id: taskId });
        if (!result.ok) {
          const errorKey =
            CLIENT_ERROR_KEY_BY_CODE[
              result.error.code as keyof typeof CLIENT_ERROR_KEY_BY_CODE
            ] ?? "generic";
          setErrorMessage(t(`errors.${errorKey}`));
          if (
            result.error.code === "CONFLICT" ||
            result.error.code === "INVALID_TRANSITION" ||
            result.error.code === "NOT_FOUND"
          ) {
            router.refresh();
          }
          return;
        }

        setSuccessMessage(t("startSuccess"));
        router.refresh();
      } catch {
        setErrorMessage(t("errors.generic"));
      }
    });
  }

  function handleComplete() {
    setErrorMessage(null);
    setSuccessMessage(null);

    startActionTransition(async () => {
      try {
        const result = await completeClientRequestAction({ task_id: taskId });
        if (!result.ok) {
          const errorKey =
            CLIENT_ERROR_KEY_BY_CODE[
              result.error.code as keyof typeof CLIENT_ERROR_KEY_BY_CODE
            ] ?? "generic";
          setErrorMessage(t(`errors.${errorKey}`));
          if (
            result.error.code === "CONFLICT" ||
            result.error.code === "INVALID_TRANSITION" ||
            result.error.code === "NOT_FOUND" ||
            result.error.code === "INVARIANT_VIOLATION"
          ) {
            router.refresh();
          }
          return;
        }

        setSuccessMessage(t("completeSuccess"));
        router.refresh();
      } catch {
        setErrorMessage(t("errors.generic"));
      }
    });
  }

  if (currentStatus === "completed") {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
        <CheckCircle className="h-4 w-4" aria-hidden="true" />
        <span>{t("completedNotice")}</span>
      </div>
    );
  }

  if (currentStatus === "blocked" || currentStatus === "in_review") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground italic">
        <AlertCircle className="h-4 w-4" aria-hidden="true" />
        <span>{t("nonActionableNotice")}</span>
      </div>
    );
  }

  const hasPendingSubmissions =
    readinessSummary.status === "pending_submissions";

  return (
    <div className="space-y-4">
      {/* Advisory Prerequisite Notice */}
      {hasPendingSubmissions && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-300"
        >
          <AlertTriangle
            className="h-4 w-4 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div>
            <p className="font-semibold">{t("prerequisiteTitle")}</p>
            <p className="mt-0.5">
              {t("prerequisiteMessage", {
                count: readinessSummary.pendingCount,
              })}
            </p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Success Message */}
      {successMessage && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2"
        >
          <CheckCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        {currentStatus === "pending" && (
          <Button
            type="button"
            onClick={handleStart}
            disabled={isPending}
            className="gap-2"
            aria-label={t("startRequestAria")}
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            <span>{isPending ? t("starting") : t("startRequest")}</span>
          </Button>
        )}

        {(currentStatus === "pending" || currentStatus === "in_progress") && (
          <Button
            type="button"
            variant={currentStatus === "pending" ? "outline" : "default"}
            onClick={handleComplete}
            disabled={isPending}
            className="gap-2"
            aria-label={t("completeRequestAria")}
          >
            <CheckCircle className="h-4 w-4" aria-hidden="true" />
            <span>{isPending ? t("completing") : t("completeRequest")}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
