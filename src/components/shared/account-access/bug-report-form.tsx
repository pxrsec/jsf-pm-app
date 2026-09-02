"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ShieldAlert, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { submitBugReportAction } from "@/lib/account-access/actions";

export function BugReportForm() {
  const t = useTranslations("accountAccess");
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submittedReport, setSubmittedReport] = useState<{
    reportId: string;
    status: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isTitleValid = title.trim().length >= 1 && title.length <= 160;
  const isDescValid =
    description.trim().length >= 1 && description.length <= 5000;
  const isFormValid = isTitleValid && isDescValid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isPending) return;

    setErrorMessage(null);

    startTransition(async () => {
      const result = await submitBugReportAction({
        title: title.trim(),
        description: description.trim(),
      });

      if (result.ok) {
        setSubmittedReport(result.data);
        setTitle("");
        setDescription("");
        toast.success(t("bugReportForm.successTitle"));
      } else {
        let errText = t("bugReportForm.errorToast");
        if (result.error.code === "VALIDATION_FAILED") {
          errText = t("bugReportForm.validationError");
        } else if (result.error.code === "UNAUTHORIZED") {
          errText = t("commonErrors.unauthorized");
        }
        setErrorMessage(errText);
        toast.error(errText);
      }
    });
  };

  const handleReset = () => {
    setSubmittedReport(null);
    setErrorMessage(null);
    setTitle("");
    setDescription("");
  };

  if (submittedReport) {
    return (
      <div
        className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm max-w-xl space-y-4"
        data-testid="bug-report-success-panel"
      >
        <div className="flex items-center gap-2 text-primary font-medium">
          <CheckCircle2 className="size-5" />
          <span>{t("bugReportForm.successTitle")}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("bugReportForm.successBody")}
        </p>
        <div className="flex items-center gap-3 pt-2">
          <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
            ID: {submittedReport.reportId}
          </span>
          <Badge variant="secondary" className="text-xs">
            {t(`bugStatuses.${submittedReport.status}`)}
          </Badge>
        </div>
        <div className="pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            className="min-h-[44px]"
          >
            {t("bugReportForm.submitAnotherButton")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 max-w-xl"
      noValidate
      data-testid="bug-report-form"
    >
      {/* Sensitive Data Banner */}
      <div
        role="note"
        className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200"
      >
        <ShieldAlert className="size-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
        <div className="space-y-1 text-sm">
          <p className="font-semibold">{t("bugReportForm.warningTitle")}</p>
          <p className="text-xs opacity-90">{t("bugReportForm.warningBody")}</p>
        </div>
      </div>

      {/* Title */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label htmlFor="bug-title">{t("bugReportForm.titleLabel")}</Label>
          <span className="text-xs text-muted-foreground">
            {title.length} / 160
          </span>
        </div>
        <Input
          id="bug-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={160}
          aria-invalid={!isTitleValid && title.length > 0}
          aria-describedby="bug-title-help"
          placeholder={t("bugReportForm.titlePlaceholder")}
          required
          disabled={isPending}
        />
        {!isTitleValid && title.length > 0 && (
          <p id="bug-title-help" className="text-xs text-destructive">
            {t("bugReportForm.validationError")}
          </p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label htmlFor="bug-description">
            {t("bugReportForm.descLabel")}
          </Label>
          <span className="text-xs text-muted-foreground">
            {description.length} / 5000
          </span>
        </div>
        <Textarea
          id="bug-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={5000}
          rows={5}
          aria-invalid={!isDescValid && description.length > 0}
          aria-describedby="bug-desc-help"
          placeholder={t("bugReportForm.descPlaceholder")}
          required
          disabled={isPending}
        />
        {!isDescValid && description.length > 0 && (
          <p id="bug-desc-help" className="text-xs text-destructive">
            {t("bugReportForm.validationError")}
          </p>
        )}
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div
          role="alert"
          className="rounded-md bg-destructive/15 p-3 text-sm text-destructive"
        >
          {errorMessage}
        </div>
      )}

      {/* Submit Button */}
      <div>
        <Button
          type="submit"
          disabled={!isFormValid || isPending}
          className="min-h-[44px] w-full sm:w-auto"
        >
          {isPending
            ? t("bugReportForm.submittingButton")
            : t("bugReportForm.submitButton")}
        </Button>
      </div>
    </form>
  );
}
