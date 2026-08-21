"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { setPrimaryPmLeadAction } from "@/lib/projects/actions";
import type { ProjectMemberWithProfile } from "@/lib/projects/queries";

interface SetPrimaryLeadDialogProps {
  projectId: string;
  member: ProjectMemberWithProfile | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SetPrimaryLeadDialog({
  projectId,
  member,
  isOpen,
  onClose,
}: SetPrimaryLeadDialogProps) {
  const t = useTranslations("projects.members.setPrimaryDialog");
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!member) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await setPrimaryPmLeadAction(projectId, member.id);

    if (!res.ok) {
      setErrorMessage(res.error.message);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    onClose();
    router.refresh();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("description", {
              name: member.profile?.full_name ?? "este miembro",
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {errorMessage && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive">
            {errorMessage}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting} onClick={onClose}>
            {t("cancelAction")}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Asignando..." : t("confirmAction")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
