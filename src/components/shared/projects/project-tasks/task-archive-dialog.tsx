"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { archiveOperationalEntityAction } from "@/lib/operational-lifecycle/actions";

interface TaskArchiveDialogProps {
  taskId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function TaskArchiveDialog({
  taskId,
  isOpen,
  onClose,
  onSuccess,
}: TaskArchiveDialogProps) {
  const t = useTranslations("projects.tasks.archive");
  const [reason, setReason] = useState("");
  const [isArchiving, setIsArchiving] = useState(false);

  if (!taskId) return null;

  const handleArchive = async () => {
    setIsArchiving(true);
    try {
      const result = await archiveOperationalEntityAction({
        entityType: "task",
        entityId: taskId,
        reason: reason.trim() || null,
      });

      if (!result.ok) {
        toast.error(t("errorToast"));
      } else {
        toast.success(t("successToast"));
        setReason("");
        onClose();
        onSuccess?.();
      }
    } catch {
      toast.error(t("errorToast"));
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setReason("");
          onClose();
        }
      }}
    >
      <AlertDialogContent className="sm:max-w-[480px]">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("description")}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="archive-reason" className="text-xs">
            {t("reasonLabel")}
          </Label>
          <Textarea
            id="archive-reason"
            rows={2}
            placeholder={t("reasonPlaceholder")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={1000}
            disabled={isArchiving}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose} disabled={isArchiving}>
            {t("cancelAction")}
          </AlertDialogCancel>
          <Button
            variant="default"
            onClick={handleArchive}
            disabled={isArchiving}
          >
            {isArchiving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {t("confirmAction")}
              </>
            ) : (
              t("confirmAction")
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
