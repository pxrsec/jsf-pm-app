"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { reopenProjectAction } from "@/lib/projects/lifecycle-actions";

interface ProjectReopenDialogProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ProjectReopenDialog({
  projectId,
  isOpen,
  onClose,
  onSuccess,
}: ProjectReopenDialogProps) {
  const t = useTranslations("projects.workspace");
  const router = useRouter();

  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleClose = () => {
    setReason("");
    setReasonError(null);
    setErrorMessage(null);
    onClose();
  };

  const mapErrorCode = (code?: string) => {
    switch (code) {
      case "UNAUTHORIZED":
        return t("reopen.errors.unauthorized");
      case "INVALID_TRANSITION":
        return t("reopen.errors.invalidTransition");
      case "VALIDATION_FAILED":
      case "REASON_REQUIRED":
        return t("reopen.errors.reasonRequired");
      case "NOT_FOUND":
        return t("reopen.errors.notFound");
      default:
        return t("reopen.errors.generic");
    }
  };

  const handleReasonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setReason(value);
    if (reasonError && value.trim().length >= 1) {
      setReasonError(null);
    }
  };

  const handleConfirm = async () => {
    const trimmed = reason.trim();
    if (trimmed.length < 1) {
      setReasonError(t("reopen.reasonRequired"));
      return;
    }

    if (reason.length > 500) {
      setReasonError(t("reopen.reasonTooLong"));
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setReasonError(null);

    try {
      const result = await reopenProjectAction({
        project_id: projectId,
        reopen_reason: trimmed,
      });

      if (!result.ok) {
        setErrorMessage(mapErrorCode(result.error?.code));
        setIsSubmitting(false);
        return;
      }

      onClose();
      setReason("");
      onSuccess?.();
      router.refresh();
    } catch {
      setErrorMessage(t("reopen.errors.generic"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isTooLong = reason.length > 500;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("reopen.dialogTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("reopen.dialogDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-2 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="reopen-reason" className="text-xs font-medium">
              {t("reopen.reasonLabel")}{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reopen-reason"
              value={reason}
              onChange={handleReasonChange}
              placeholder={t("reopen.reasonPlaceholder")}
              rows={3}
              disabled={isSubmitting}
              className={`text-xs resize-none ${
                reasonError || isTooLong
                  ? "border-destructive focus-visible:ring-destructive"
                  : ""
              }`}
            />
            <div className="flex items-center justify-between text-[11px]">
              {reasonError ? (
                <span className="text-destructive font-medium">
                  {reasonError}
                </span>
              ) : isTooLong ? (
                <span className="text-destructive font-medium">
                  {t("reopen.reasonTooLong")}
                </span>
              ) : (
                <span />
              )}
              <span
                className={`text-muted-foreground ${
                  isTooLong ? "text-destructive font-semibold" : ""
                }`}
              >
                {reason.length}/500
              </span>
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
              {errorMessage}
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting} onClick={handleClose}>
            {t("reopen.cancelAction")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={isSubmitting || isTooLong}
          >
            {isSubmitting ? t("reopen.submitting") : t("reopen.confirmAction")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
