"use client";

import { useState, useTransition, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  approveClientDeliverableAction,
  requestClientDeliverableChangesAction,
} from "@/lib/client/actions";
import { CLIENT_ERROR_KEY_BY_CODE } from "@/lib/client/types";
import { CheckCircle2, MessageSquarePlus, AlertCircle, X } from "lucide-react";

interface ClientReviewActionsProps {
  deliverableId: string;
}

export function ClientReviewActions({
  deliverableId,
}: ClientReviewActionsProps) {
  const t = useTranslations("projects.clientReviews.actions");
  const router = useRouter();
  const [isPending, startActionTransition] = useTransition();

  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showChangesDialog, setShowChangesDialog] = useState(false);

  const [comments, setComments] = useState("");
  const [commentTouched, setCommentTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const approveButtonRef = useRef<HTMLButtonElement>(null);
  const changesButtonRef = useRef<HTMLButtonElement>(null);

  const isCommentEmpty = comments.trim().length === 0;
  const isCommentTooLong = comments.length > 5000;
  const commentValidationError =
    commentTouched && isCommentEmpty
      ? t("commentRequired")
      : commentTouched && isCommentTooLong
        ? t("commentTooLong")
        : null;

  function handleApprove() {
    setServerError(null);

    startActionTransition(async () => {
      try {
        const result = await approveClientDeliverableAction({
          deliverable_id: deliverableId,
        });

        if (!result.ok) {
          const errorKey =
            CLIENT_ERROR_KEY_BY_CODE[
              result.error.code as keyof typeof CLIENT_ERROR_KEY_BY_CODE
            ] ?? "generic";
          setServerError(t(`errors.${errorKey}`));
          if (
            result.error.code === "CONFLICT" ||
            result.error.code === "INVALID_TRANSITION" ||
            result.error.code === "NOT_FOUND"
          ) {
            router.refresh();
          }
          return;
        }

        setShowApproveDialog(false);
        router.refresh();
      } catch {
        setServerError(t("errors.generic"));
      }
    });
  }

  function handleRequestChanges(e: React.FormEvent) {
    e.preventDefault();
    setCommentTouched(true);

    if (isCommentEmpty || isCommentTooLong) {
      return;
    }

    setServerError(null);

    startActionTransition(async () => {
      try {
        const result = await requestClientDeliverableChangesAction({
          deliverable_id: deliverableId,
          comments: comments.trim(),
        });

        if (!result.ok) {
          const errorKey =
            CLIENT_ERROR_KEY_BY_CODE[
              result.error.code as keyof typeof CLIENT_ERROR_KEY_BY_CODE
            ] ?? "generic";
          setServerError(t(`errors.${errorKey}`));
          if (
            result.error.code === "CONFLICT" ||
            result.error.code === "INVALID_TRANSITION" ||
            result.error.code === "NOT_FOUND"
          ) {
            router.refresh();
          }
          return;
        }

        setComments("");
        setCommentTouched(false);
        setShowChangesDialog(false);
        router.refresh();
      } catch {
        setServerError(t("errors.generic"));
      }
    });
  }

  return (
    <div className="space-y-4">
      {serverError && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{serverError}</span>
        </div>
      )}

      {/* Decision Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          ref={approveButtonRef}
          type="button"
          onClick={() => {
            setServerError(null);
            setShowApproveDialog(true);
          }}
          disabled={isPending}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          aria-label={t("approveAria")}
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          <span>{t("approveDeliverable")}</span>
        </Button>

        <Button
          ref={changesButtonRef}
          type="button"
          variant="outline"
          onClick={() => {
            setServerError(null);
            setShowChangesDialog(true);
          }}
          disabled={isPending}
          className="gap-2"
          aria-label={t("requestChangesAria")}
        >
          <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
          <span>{t("requestChanges")}</span>
        </Button>
      </div>

      {/* Approve Confirmation Modal */}
      {showApproveDialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="approve-dialog-title"
          aria-describedby="approve-dialog-desc"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3
                id="approve-dialog-title"
                className="text-base font-semibold text-foreground"
              >
                {t("approveDialogTitle")}
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowApproveDialog(false);
                  approveButtonRef.current?.focus();
                }}
                disabled={isPending}
                className="h-8 w-8"
                aria-label={t("cancelAction")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <p
              id="approve-dialog-desc"
              className="text-xs text-muted-foreground"
            >
              {t("approveDialogDescription")}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowApproveDialog(false);
                  approveButtonRef.current?.focus();
                }}
                disabled={isPending}
              >
                {t("cancelAction")}
              </Button>
              <Button
                type="button"
                onClick={handleApprove}
                disabled={isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isPending ? t("approving") : t("confirmApprove")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Request Changes Modal */}
      {showChangesDialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="changes-dialog-title"
          aria-describedby="changes-dialog-desc"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <form
            onSubmit={handleRequestChanges}
            className="w-full max-w-lg rounded-xl border border-border bg-background p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3
                id="changes-dialog-title"
                className="text-base font-semibold text-foreground"
              >
                {t("changesDialogTitle")}
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowChangesDialog(false);
                  changesButtonRef.current?.focus();
                }}
                disabled={isPending}
                className="h-8 w-8"
                aria-label={t("cancelAction")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <p
              id="changes-dialog-desc"
              className="text-xs text-muted-foreground"
            >
              {t("changesDialogDescription")}
            </p>

            <div className="space-y-1.5">
              <label
                htmlFor="changes-comment-input"
                className="text-xs font-medium text-foreground block"
              >
                {t("commentLabel")} <span className="text-destructive">*</span>
              </label>
              <Textarea
                id="changes-comment-input"
                value={comments}
                onChange={(e) => {
                  setComments(e.target.value);
                  if (!commentTouched) setCommentTouched(true);
                }}
                onBlur={() => setCommentTouched(true)}
                disabled={isPending}
                rows={4}
                maxLength={5000}
                placeholder={t("commentPlaceholder")}
                aria-invalid={Boolean(commentValidationError)}
                aria-describedby={
                  commentValidationError
                    ? "changes-comment-error"
                    : "changes-comment-help"
                }
                className="resize-y text-xs"
              />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span id="changes-comment-help">{t("commentHelp")}</span>
                <span>{comments.length}/5000</span>
              </div>
              {commentValidationError && (
                <p
                  id="changes-comment-error"
                  role="alert"
                  className="text-xs text-destructive mt-1"
                >
                  {commentValidationError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowChangesDialog(false);
                  changesButtonRef.current?.focus();
                }}
                disabled={isPending}
              >
                {t("cancelAction")}
              </Button>
              <Button
                type="submit"
                disabled={isPending || isCommentEmpty || isCommentTooLong}
                variant="destructive"
              >
                {isPending
                  ? t("submittingChanges")
                  : t("confirmRequestChanges")}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
