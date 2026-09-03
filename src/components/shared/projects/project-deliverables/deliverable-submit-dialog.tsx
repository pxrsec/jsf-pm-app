"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { HardDrive, Loader2, Info } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isValidGoogleDriveUrl } from "@/lib/deliverables/validators";
import { submitDeliverableVersionAction } from "@/lib/deliverables/actions";
import type { DeliverableListItem } from "@/lib/deliverables/queries";

interface DeliverableSubmitDialogProps {
  deliverable: DeliverableListItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function DeliverableSubmitDialog({
  deliverable,
  isOpen,
  onClose,
  onSuccess,
}: DeliverableSubmitDialogProps) {
  const t = useTranslations("projects.workspace.deliverables.submitDialog");
  const [submissionUrl, setSubmissionUrl] = useState("");
  const [submissionNote, setSubmissionNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!deliverable) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate raw submissionUrl without trimming
    if (!isValidGoogleDriveUrl(submissionUrl)) {
      setError(t("validationError"));
      return;
    }

    setIsSubmitting(true);

    const result = await submitDeliverableVersionAction({
      deliverable_id: deliverable.id,
      submission_url: submissionUrl,
      submission_note: submissionNote.trim() ? submissionNote.trim() : null,
    });

    setIsSubmitting(false);

    if (result.ok) {
      const nextVersion = result.data.version_number;
      setSubmissionUrl("");
      setSubmissionNote("");
      onClose();
      onSuccess(t("successToast", { version: String(nextVersion) }));
    } else {
      setError(
        result.error.code === "VALIDATION_FAILED"
          ? t("validationError")
          : t("errorToast"),
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <HardDrive className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                {t("title")}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {t("description")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Informational notice */}
          <div className="flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-foreground/90">
            <Info className="size-4 text-primary shrink-0 mt-0.5" />
            <p className="leading-relaxed text-muted-foreground">
              {t("driveLinkHelp")}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="submission-url" className="text-xs font-medium">
              {t("driveLinkLabel")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="submission-url"
              type="text"
              value={submissionUrl}
              onChange={(e) => setSubmissionUrl(e.target.value)}
              placeholder={t("driveLinkPlaceholder")}
              required
              className="text-xs font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="submission-note" className="text-xs font-medium">
              {t("noteLabel")}
            </Label>
            <Textarea
              id="submission-note"
              value={submissionNote}
              onChange={(e) => setSubmissionNote(e.target.value)}
              placeholder={t("notePlaceholder")}
              rows={3}
              maxLength={1000}
              className="text-xs resize-none"
            />
            <p className="text-[10px] text-muted-foreground text-right">
              {submissionNote.length} / 1000
            </p>
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-md">
              {error}
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs"
            >
              {t("cancelAction")}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!submissionUrl || isSubmitting}
              className="text-xs gap-1.5"
            >
              {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
              <span>{isSubmitting ? t("submitting") : t("submitAction")}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
