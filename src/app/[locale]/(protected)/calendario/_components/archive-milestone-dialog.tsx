"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { archiveOperationalEntityAction } from "@/lib/operational-lifecycle/actions";
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

export function ArchiveMilestoneDialog({
  isOpen,
  milestoneId,
  milestoneTitle,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  milestoneId: string;
  milestoneTitle: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const t = useTranslations("calendar");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  const archive = async () => {
    setSaving(true);
    setError(false);
    const result = await archiveOperationalEntityAction({
      entityType: "milestone",
      entityId: milestoneId,
      reason: null,
    });
    setSaving(false);
    if (!result.ok) {
      setError(true);
      return;
    }
    toast.success(t("states.successDelete"));
    onSuccess();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("actions.confirmDelete")}</AlertDialogTitle>
          <AlertDialogDescription>
            {milestoneTitle}. {t("actions.confirmDeleteDesc")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {t("states.error")}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>
            {t("actions.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={saving}
            onClick={(event) => {
              event.preventDefault();
              void archive();
            }}
          >
            {saving ? (
              <Loader2 className="animate-spin" />
            ) : (
              t("actions.deleteMilestone")
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Retain alias export for backwards compatibility
export const DeleteMilestoneDialog = ArchiveMilestoneDialog;
