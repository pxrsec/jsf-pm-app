"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { archiveOperationalEntityAction } from "@/lib/operational-lifecycle/actions";

interface DeliverableArchiveDialogProps {
  deliverableId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function DeliverableArchiveDialog({
  deliverableId,
  isOpen,
  onClose,
  onSuccess,
}: DeliverableArchiveDialogProps) {
  const t = useTranslations("projects.workspace.deliverables.archiveDialog");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!deliverableId) return null;

  const handleArchive = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await archiveOperationalEntityAction({
        entityType: "deliverable",
        entityId: deliverableId,
        reason: reason.trim() || null,
      });

      setIsSubmitting(false);

      if (result.ok) {
        setReason("");
        onClose();
        onSuccess(t("successToast"));
      } else {
        setError(t("errorToast"));
      }
    } catch {
      setIsSubmitting(false);
      setError(t("errorToast"));
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base font-semibold">
            {t("title")}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
            {t("description")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="archive-reason" className="text-xs font-medium">
            {t("reasonLabel")}
          </Label>
          <Textarea
            id="archive-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("reasonPlaceholder")}
            rows={2}
            maxLength={1000}
            className="text-xs resize-none"
          />
        </div>

        {error && (
          <p className="text-xs text-destructive bg-destructive/10 p-2 rounded-md">
            {error}
          </p>
        )}

        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel
            disabled={isSubmitting}
            onClick={onClose}
            className="text-xs"
          >
            {t("cancelAction")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleArchive();
            }}
            disabled={isSubmitting}
            className="text-xs gap-1.5"
          >
            {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
            <span>{isSubmitting ? t("submitting") : t("confirmAction")}</span>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
