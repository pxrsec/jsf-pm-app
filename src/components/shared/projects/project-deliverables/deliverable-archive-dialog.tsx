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
import { archiveDeliverableAction } from "@/lib/deliverables/actions";

interface DeliverableArchiveDialogProps {
  deliverableId: string | null;
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function DeliverableArchiveDialog({
  deliverableId,
  projectId,
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

    const result = await archiveDeliverableAction({
      deliverableId,
      projectId,
      reason: reason.trim() || undefined,
    });

    setIsSubmitting(false);

    if (result.ok) {
      setReason("");
      onClose();
      onSuccess(t("successToast"));
    } else {
      setError(result.error.message);
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
            maxLength={500}
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
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs gap-1.5"
          >
            {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
            <span>{isSubmitting ? t("submitting") : t("confirmAction")}</span>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
