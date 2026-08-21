"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { transitionProjectStatusAction } from "@/lib/projects/actions";
import { getCompletionReadinessAction } from "@/lib/projects/lifecycle-actions";
import type { ProjectCompletionReadiness } from "@/lib/projects/commands";

interface ProjectCompleteDialogProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ProjectCompleteDialog({
  projectId,
  isOpen,
  onClose,
  onSuccess,
}: ProjectCompleteDialogProps) {
  const t = useTranslations("projects.workspace");
  const router = useRouter();

  const [phase, setPhase] = useState<"loading" | "ready" | "fetch-error">(
    "loading",
  );
  const [readiness, setReadiness] = useState<ProjectCompletionReadiness | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleClose = () => {
    setPhase("loading");
    setReadiness(null);
    setErrorMessage(null);
    onClose();
  };

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    getCompletionReadinessAction(projectId).then((result) => {
      if (!isMounted) return;
      if (result.ok) {
        setReadiness(result.data);
        setPhase("ready");
      } else {
        setPhase("fetch-error");
        setErrorMessage(
          result.error?.code === "UNAUTHORIZED"
            ? t("completion.errors.unauthorized")
            : t("completion.errors.generic"),
        );
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, projectId, t]);

  const mapErrorCode = (code?: string) => {
    switch (code) {
      case "UNAUTHORIZED":
        return t("completion.errors.unauthorized");
      case "INVALID_TRANSITION":
        return t("completion.errors.invalidTransition");
      case "NOT_FOUND":
        return t("completion.errors.notFound");
      default:
        return t("completion.errors.generic");
    }
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await transitionProjectStatusAction({
        project_id: projectId,
        next_status: "completed",
        confirm_unfinished: true,
      });

      if (!result.ok) {
        setErrorMessage(mapErrorCode(result.error?.code));
        setIsSubmitting(false);
        return;
      }

      onClose();
      onSuccess?.();
      router.refresh();
    } catch {
      setErrorMessage(t("completion.errors.generic"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("completion.dialogTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("completion.dialogDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Phase-based display */}
        <div className="py-2 space-y-3">
          {phase === "loading" && (
            <div className="flex items-center justify-center gap-2.5 py-6 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>{t("completion.loadingReadiness")}</span>
            </div>
          )}

          {phase === "fetch-error" && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
              {errorMessage ?? t("completion.errors.generic")}
            </div>
          )}

          {phase === "ready" && readiness && (
            <>
              {readiness.is_ready ? (
                <div className="rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-3.5 flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-xs">
                    <p className="font-semibold text-green-900 dark:text-green-100">
                      {t("completion.readyTitle")}
                    </p>
                    <p className="text-green-800/90 dark:text-green-200/90">
                      {t("completion.readyDescription")}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3.5 space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="space-y-1 text-xs">
                      <p className="font-semibold text-amber-900 dark:text-amber-100">
                        {t("completion.unfinishedTitle")}
                      </p>
                      <p className="text-amber-800/90 dark:text-amber-200/90">
                        {t("completion.unfinishedDescription", {
                          taskCount: readiness.unfinished_task_count,
                          deliverableCount:
                            readiness.unfinished_deliverable_count,
                        })}
                      </p>
                    </div>
                  </div>

                  {readiness.unfinished_tasks.length > 0 && (
                    <div className="pt-1 pl-7 text-xs text-amber-900 dark:text-amber-100 space-y-1">
                      <p className="font-medium text-[11px] text-amber-950 dark:text-amber-200">
                        {t("completion.unfinishedTasksLabel")}
                      </p>
                      <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                        {readiness.unfinished_tasks.slice(0, 5).map((task) => (
                          <li key={task.id} className="truncate max-w-xs">
                            {task.title}
                          </li>
                        ))}
                      </ul>
                      {readiness.unfinished_tasks.length > 5 && (
                        <p className="text-[11px] text-amber-800 dark:text-amber-300 italic pt-0.5">
                          {t("completion.unfinishedTasksMore", {
                            count: readiness.unfinished_tasks.length - 5,
                          })}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {errorMessage && phase === "ready" && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
              {errorMessage}
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting} onClick={handleClose}>
            {t("completion.cancelAction")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={
              isSubmitting || phase === "loading" || phase === "fetch-error"
            }
          >
            {isSubmitting
              ? t("completion.submitting")
              : t("completion.confirmAction")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
