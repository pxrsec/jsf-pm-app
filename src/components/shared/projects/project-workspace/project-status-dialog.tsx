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
import {
  transitionProjectStatusAction,
  archiveProjectAction,
  restoreProjectAction,
} from "@/lib/projects/actions";

export type ProjectStatusActionType =
  | "pause"
  | "resume"
  | "cancel"
  | "archive"
  | "restore";

interface ProjectStatusDialogProps {
  projectId: string;
  actionType: ProjectStatusActionType | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ProjectStatusDialog({
  projectId,
  actionType,
  isOpen,
  onClose,
  onSuccess,
}: ProjectStatusDialogProps) {
  const t = useTranslations("projects.workspace.statusDialog");
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!actionType) return null;

  const getDialogDetails = () => {
    switch (actionType) {
      case "pause":
        return {
          title: t("pauseTitle"),
          description: t("pauseDescription"),
          isDestructive: false,
        };
      case "resume":
        return {
          title: t("resumeTitle"),
          description: t("resumeDescription"),
          isDestructive: false,
        };
      case "cancel":
        return {
          title: t("cancelTitle"),
          description: t("cancelDescription"),
          isDestructive: true,
        };
      case "archive":
        return {
          title: t("archiveTitle"),
          description: t("archiveDescription"),
          isDestructive: true,
        };
      case "restore":
        return {
          title: t("restoreTitle"),
          description: t("restoreDescription"),
          isDestructive: false,
        };
    }
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (actionType === "pause") {
        const res = await transitionProjectStatusAction({
          project_id: projectId,
          next_status: "paused",
          confirm_unfinished: false,
        });
        if (!res.ok) {
          setErrorMessage(res.error.message);
          setIsSubmitting(false);
          return;
        }
      } else if (actionType === "resume") {
        const res = await transitionProjectStatusAction({
          project_id: projectId,
          next_status: "in_progress",
          confirm_unfinished: false,
        });
        if (!res.ok) {
          setErrorMessage(res.error.message);
          setIsSubmitting(false);
          return;
        }
      } else if (actionType === "cancel") {
        const res = await transitionProjectStatusAction({
          project_id: projectId,
          next_status: "cancelled",
          confirm_unfinished: false,
        });
        if (!res.ok) {
          setErrorMessage(res.error.message);
          setIsSubmitting(false);
          return;
        }
      } else if (actionType === "archive") {
        const res = await archiveProjectAction(projectId);
        if (!res.ok) {
          setErrorMessage(res.error.message);
          setIsSubmitting(false);
          return;
        }
      } else if (actionType === "restore") {
        const res = await restoreProjectAction(projectId);
        if (!res.ok) {
          setErrorMessage(res.error.message);
          setIsSubmitting(false);
          return;
        }
      }

      onClose();
      onSuccess?.();
      router.refresh();
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Error executing action",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const details = getDialogDetails();

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{details.title}</AlertDialogTitle>
          <AlertDialogDescription>{details.description}</AlertDialogDescription>
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
            className={
              details.isDestructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : ""
            }
          >
            {isSubmitting ? "Procesando..." : t("confirmAction")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
