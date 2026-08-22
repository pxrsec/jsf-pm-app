"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/routing";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { isValidGoogleDriveUrl } from "@/lib/deliverables/validators";
import { submitOperatorDeliverableVersionAction } from "@/lib/operator/actions";
import {
  Upload,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Info,
  RefreshCw,
} from "lucide-react";

interface OperatorSubmissionDialogProps {
  deliverableId: string;
  deliverableTitle: string;
  currentVersionNumber: number | null;
  status: "pending" | "changes_requested";
  translations: {
    dialogTitle: string;
    dialogTitleRevision: string;
    dialogDescription: string;
    truthfulnessNotice: string;
    revisionNotice: (nextVersion: string) => string;
    urlLabel: string;
    urlPlaceholder: string;
    urlHelp: string;
    urlError: string;
    noteLabel: string;
    notePlaceholder: string;
    noteHelp: string;
    charCount: (count: string) => string;
    cancelAction: string;
    submitAction: string;
    submitting: string;
    successToast: (version: string) => string;
    submitCta: string;
    resubmitCta: string;
    errors: {
      validationFailed: string;
      unauthorized: string;
      notFound: string;
      invalidTransition: string;
      conflict: string;
      invariantViolation: string;
      generic: string;
    };
  };
}

export function OperatorSubmissionDialog({
  deliverableId,
  deliverableTitle,
  currentVersionNumber,
  status,
  translations,
}: OperatorSubmissionDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [urlTouched, setUrlTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isRevision = status === "changes_requested";
  const nextVersionNum = (currentVersionNumber ?? 0) + 1;
  const isUrlValid = isValidGoogleDriveUrl(url);
  const showUrlError = urlTouched && url.length > 0 && !isUrlValid;

  function resetForm() {
    setUrl("");
    setNote("");
    setUrlTouched(false);
    setServerError(null);
    setSuccessMessage(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!isPending) {
      setOpen(nextOpen);
      if (!nextOpen) {
        resetForm();
      }
    }
  }

  function getErrorMessage(code: string): string {
    switch (code) {
      case "VALIDATION_FAILED":
        return translations.errors.validationFailed;
      case "UNAUTHORIZED":
        return translations.errors.unauthorized;
      case "NOT_FOUND":
        return translations.errors.notFound;
      case "INVALID_TRANSITION":
        return translations.errors.invalidTransition;
      case "CONFLICT":
        return translations.errors.conflict;
      case "INVARIANT_VIOLATION":
        return translations.errors.invariantViolation;
      default:
        return translations.errors.generic;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setUrlTouched(true);

    if (!isValidGoogleDriveUrl(url)) {
      return;
    }

    setServerError(null);

    startTransition(async () => {
      try {
        const result = await submitOperatorDeliverableVersionAction({
          deliverable_id: deliverableId,
          submission_url: url,
          submission_note: note.trim() ? note.trim() : null,
        });

        if (!result.ok) {
          setServerError(getErrorMessage(result.error.code));
          if (
            result.error.code === "CONFLICT" ||
            result.error.code === "INVALID_TRANSITION" ||
            result.error.code === "NOT_FOUND"
          ) {
            router.refresh();
          }
          return;
        }

        const successText = translations.successToast(
          result.data.version_number.toString(),
        );
        setSuccessMessage(successText);
        resetForm();
        setOpen(false);
        router.refresh();
      } catch {
        setServerError(translations.errors.generic);
      }
    });
  }

  return (
    <div>
      {successMessage && (
        <div
          role="status"
          className="mb-3 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/40 p-3 text-xs font-medium text-emerald-800 dark:text-emerald-200"
        >
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      <Button
        type="button"
        variant="default"
        size="sm"
        data-testid="open-submission-dialog-btn"
        onClick={() => setOpen(true)}
        className="min-h-[44px] min-w-[44px] gap-2 font-medium"
      >
        {isRevision ? (
          <RefreshCw className="size-4 shrink-0" aria-hidden="true" />
        ) : (
          <Upload className="size-4 shrink-0" aria-hidden="true" />
        )}
        <span>
          {isRevision ? translations.resubmitCta : translations.submitCta}
        </span>
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          data-testid="operator-submission-dialog"
          className="max-w-lg p-5 sm:p-6"
        >
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold tracking-tight">
              {isRevision
                ? translations.dialogTitleRevision
                : translations.dialogTitle}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {translations.dialogDescription} ({deliverableTitle})
            </DialogDescription>
          </DialogHeader>

          {/* Truthfulness & Revision notices */}
          <div className="space-y-2 py-1">
            {isRevision && (
              <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 dark:border-blue-900/60 dark:bg-blue-950/40 p-3 text-xs text-blue-800 dark:text-blue-200">
                <Info className="size-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
                <span>
                  {translations.revisionNotice(nextVersionNum.toString())}
                </span>
              </div>
            )}

            <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50 p-2.5 text-xs text-muted-foreground">
              <Info className="size-3.5 shrink-0 mt-0.5" />
              <span>{translations.truthfulnessNotice}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            {/* Server Error Alert */}
            {serverError && (
              <div
                role="alert"
                data-testid="submission-server-error"
                className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive font-medium"
              >
                <AlertCircle className="size-4 shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            {/* Google Drive URL Field */}
            <div className="space-y-1.5">
              <Label
                htmlFor={`submission-url-${deliverableId}`}
                className="text-xs font-semibold"
              >
                {translations.urlLabel}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`submission-url-${deliverableId}`}
                data-testid="submission-url-input"
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={() => setUrlTouched(true)}
                placeholder={translations.urlPlaceholder}
                aria-invalid={showUrlError}
                aria-describedby={
                  showUrlError
                    ? `url-error-${deliverableId}`
                    : `url-help-${deliverableId}`
                }
                className="text-xs min-h-[44px]"
              />
              {showUrlError ? (
                <p
                  id={`url-error-${deliverableId}`}
                  data-testid="submission-url-error"
                  role="alert"
                  className="text-xs font-medium text-destructive flex items-center gap-1 mt-1"
                >
                  <AlertCircle className="size-3.5 shrink-0" />
                  <span>{translations.urlError}</span>
                </p>
              ) : (
                <p
                  id={`url-help-${deliverableId}`}
                  className="text-[11px] text-muted-foreground"
                >
                  {translations.urlHelp}
                </p>
              )}
            </div>

            {/* Submission Note Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor={`submission-note-${deliverableId}`}
                  className="text-xs font-semibold"
                >
                  {translations.noteLabel}
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  {translations.charCount(note.length.toString())}
                </span>
              </div>
              <Textarea
                id={`submission-note-${deliverableId}`}
                data-testid="submission-note-input"
                maxLength={1000}
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={translations.notePlaceholder}
                className="text-xs resize-none"
              />
              <p className="text-[11px] text-muted-foreground">
                {translations.noteHelp}
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => handleOpenChange(false)}
                className="min-h-[44px] min-w-[44px]"
              >
                {translations.cancelAction}
              </Button>
              <Button
                type="submit"
                disabled={isPending || !url || !isUrlValid}
                data-testid="submit-version-btn"
                className="min-h-[44px] min-w-[44px] gap-2"
              >
                {isPending ? (
                  <>
                    <Loader2
                      className="size-4 animate-spin shrink-0"
                      aria-hidden="true"
                    />
                    <span>{translations.submitting}</span>
                  </>
                ) : (
                  <span>{translations.submitAction}</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
