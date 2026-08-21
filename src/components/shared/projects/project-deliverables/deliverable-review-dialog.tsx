"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ShieldCheck,
  RotateCcw,
  AlertTriangle,
  FileCheck2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DeliverableStatusBadge } from "./deliverable-status-badge";
import { reviewDeliverableAction } from "@/lib/deliverables/review-actions";
import type {
  DeliverableDetailView,
  DeliverableListItem,
} from "@/lib/deliverables/queries";

interface DeliverableReviewDialogProps {
  deliverable: DeliverableDetailView | DeliverableListItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg?: string) => void;
  onError?: (code: string) => void;
}

export function DeliverableReviewDialog({
  deliverable,
  isOpen,
  onClose,
  onSuccess,
  onError,
}: DeliverableReviewDialogProps) {
  const t = useTranslations("projects.workspace.deliverables");

  const [decision, setDecision] = useState<"approved" | "changes_requested">(
    "approved",
  );
  const [comments, setComments] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    setDecision("approved");
    setComments("");
    setValidationError(null);
    setIsSubmitting(false);
    onClose();
  };

  if (!deliverable) return null;

  const currentVersion = deliverable.current_version_number || 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedComments = comments.trim();

    if (decision === "changes_requested" && !trimmedComments) {
      setValidationError(t("reviewDialog.commentsRequiredError"));
      return;
    }

    if (trimmedComments.length > 5000) {
      setValidationError("Comments cannot exceed 5000 characters");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await reviewDeliverableAction({
        deliverable_id: deliverable.id,
        decision,
        comments: trimmedComments || null,
      });

      if (result.ok) {
        handleClose();
        onSuccess(
          decision === "approved"
            ? t("reviewDialog.approvedToast")
            : t("reviewDialog.changesRequestedToast"),
        );
      } else {
        const errCode = result.error.code;
        if (errCode === "VALIDATION_FAILED") {
          setValidationError(
            result.error.message || t("reviewDialog.commentsRequiredError"),
          );
        } else if (errCode === "UNAUTHORIZED") {
          toast.error(t("errors.unauthorized"));
          handleClose();
          onError?.(errCode);
        } else if (errCode === "NOT_FOUND") {
          toast.error(t("errors.notFound"));
          handleClose();
          onError?.(errCode);
        } else if (errCode === "INVALID_TRANSITION" || errCode === "CONFLICT") {
          toast.error(t("reviewDialog.staleErrorToast"));
          handleClose();
          onError?.(errCode);
        } else {
          toast.error(t("errors.generic"));
        }
      }
    } catch {
      toast.error(t("errors.generic"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader className="space-y-2 text-left">
            <div className="flex items-center gap-2">
              <FileCheck2 className="size-5 text-primary" />
              <DialogTitle className="text-base font-bold">
                {t("reviewDialog.title")}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              {t("reviewDialog.description", {
                version: String(currentVersion),
              })}
            </DialogDescription>
          </DialogHeader>

          {/* Read-Only Context */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-foreground truncate">
                {deliverable.title}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <DeliverableStatusBadge status={deliverable.status} />
                <Badge variant="secondary" className="font-mono text-xs">
                  v{currentVersion}
                </Badge>
              </div>
            </div>
          </div>

          {/* Immutable Decision Notice */}
          <div className="flex items-start gap-2 p-2.5 rounded-md border border-amber-500/20 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs">
            <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <p className="leading-relaxed">
              {t("reviewDialog.immutableWarning")}
            </p>
          </div>

          {/* Decision Selection */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground">
              {t("reviewDialog.decisionLabel")}
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setDecision("approved");
                  setValidationError(null);
                }}
                className={`flex flex-col items-start p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  decision === "approved"
                    ? "border-green-500 bg-green-500/10 ring-1 ring-green-500"
                    : "border-border hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
                  <ShieldCheck className="size-4 text-green-600 dark:text-green-400" />
                  <span>{t("reviewDialog.approveOption")}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  {t("reviewDialog.approveHelp")}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setDecision("changes_requested")}
                className={`flex flex-col items-start p-3 rounded-lg border text-left transition-all cursor-pointer ${
                  decision === "changes_requested"
                    ? "border-orange-500 bg-orange-500/10 ring-1 ring-orange-500"
                    : "border-border hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
                  <RotateCcw className="size-4 text-orange-600 dark:text-orange-400" />
                  <span>{t("reviewDialog.requestChangesOption")}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  {t("reviewDialog.requestChangesHelp")}
                </p>
              </button>
            </div>
          </div>

          {/* Comments Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="review-comments"
                className="text-xs font-semibold text-foreground"
              >
                {t("reviewDialog.commentsLabel")}
                {decision === "changes_requested" && (
                  <span className="text-destructive ml-0.5">*</span>
                )}
              </Label>
              <span className="text-[10px] text-muted-foreground">
                {comments.length}/5000
              </span>
            </div>
            <Textarea
              id="review-comments"
              value={comments}
              onChange={(e) => {
                setComments(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder={
                decision === "changes_requested"
                  ? t("reviewDialog.commentsRequiredPlaceholder")
                  : t("reviewDialog.commentsOptionalPlaceholder")
              }
              rows={3}
              maxLength={5000}
              className="text-xs resize-none"
              aria-describedby={
                validationError ? "review-comments-error" : undefined
              }
            />
            {validationError && (
              <p
                id="review-comments-error"
                className="text-[11px] text-destructive font-medium"
              >
                {validationError}
              </p>
            )}
          </div>

          <DialogFooter className="flex flex-row justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={isSubmitting}
              className="text-xs"
            >
              {t("reviewDialog.cancelAction")}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="text-xs"
            >
              {isSubmitting
                ? t("reviewDialog.submitting")
                : t("reviewDialog.submitAction")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
