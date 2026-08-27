"use client";

import { useTranslations } from "next-intl";
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

interface TaskTypeChangeAlertProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function TaskTypeChangeAlert({
  open,
  onCancel,
  onConfirm,
}: TaskTypeChangeAlertProps) {
  const t = useTranslations("projects.tasks.create");

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("typeChangeWarningTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("typeChangeWarningDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            {t("typeChangeCancelAction")}
          </AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {t("typeChangeConfirmAction")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
