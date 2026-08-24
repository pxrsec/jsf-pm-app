"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
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
import { softDeleteCalendarMilestoneAction } from "@/lib/calendar/actions";

interface DeleteMilestoneDialogProps {
  isOpen: boolean;
  eventId?: string;
  eventTitle?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeleteMilestoneDialog({
  isOpen,
  eventId,
  eventTitle,
  onClose,
  onSuccess,
}: DeleteMilestoneDialogProps) {
  const t = useTranslations("calendar");
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!eventId) return;

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const result = await softDeleteCalendarMilestoneAction({ eventId });
      if (!result.ok) {
        setErrorMessage(result.error.message);
        return;
      }

      toast.success(t("states.successDelete"));
      onSuccess();
      onClose();
    } catch {
      setErrorMessage(t("states.error"));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("actions.confirmDelete")}</AlertDialogTitle>
          <AlertDialogDescription>
            {eventTitle ? `"${eventTitle}". ` : ""}
            {t("actions.confirmDeleteDesc")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {errorMessage && (
          <div
            role="alert"
            className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive"
          >
            {errorMessage}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting} onClick={onClose}>
            {t("actions.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void handleDelete();
            }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("actions.deleting")}
              </>
            ) : (
              t("actions.deleteMilestone")
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
