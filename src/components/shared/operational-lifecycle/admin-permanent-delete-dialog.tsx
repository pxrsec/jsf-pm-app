"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
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
import {
  getOperationalDeletionPreviewAction,
  permanentlyDeleteOperationalEntityAction,
} from "@/lib/operational-lifecycle/actions";
import { getOperationalLifecycleErrorKey } from "@/lib/operational-lifecycle/errors";
import type {
  OperationalDeletionPreviewDto,
  OperationalRecycleBinItem,
} from "@/lib/operational-lifecycle/types";

interface AdminPermanentDeleteDialogProps {
  target: OperationalRecycleBinItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AdminPermanentDeleteDialog({
  target,
  isOpen,
  onClose,
  onSuccess,
}: AdminPermanentDeleteDialogProps) {
  const t = useTranslations("operationalLifecycle.permanentDeleteDialog");
  const tEntities = useTranslations(
    "operationalLifecycle.recycleBin.entityTypes",
  );
  const tErrors = useTranslations("operationalLifecycle.errors");
  const router = useRouter();

  const [preview, setPreview] = useState<OperationalDeletionPreviewDto | null>(
    null,
  );
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !target) return;

    let active = true;
    const fetchTarget = target;

    getOperationalDeletionPreviewAction({
      entityType: fetchTarget.entityType,
      entityId: fetchTarget.entityId,
    })
      .then((res) => {
        if (!active) return;
        setLoadingPreview(false);
        if (res.ok) {
          setPreview(res.data);
        } else {
          setErrorNotice(t("previewUnavailable"));
        }
      })
      .catch(() => {
        if (!active) return;
        setLoadingPreview(false);
        setErrorNotice(t("previewUnavailable"));
      });

    return () => {
      active = false;
    };
  }, [isOpen, target, t]);

  const handleClose = () => {
    setPreview(null);
    setLoadingPreview(false);
    setIsDeleting(false);
    setErrorNotice(null);
    onClose();
  };

  if (!target) return null;

  const getBlockerMessage = (code: string | null) => {
    switch (code) {
      case "dependencies_present":
        return t("blockerDependenciesPresent");
      case "archive_required":
        return t("blockerArchiveRequired");
      case "not_found_or_archive_required":
        return t("blockerNotFoundOrArchiveRequired");
      case "not_found":
        return t("blockerNotFound");
      case "not_found_or_parent_archived":
        return t("blockerParentArchived");
      default:
        return t("previewUnavailable");
    }
  };

  const handlePermanentDelete = async () => {
    if (!preview || !preview.canDelete || isDeleting) return;

    setIsDeleting(true);
    setErrorNotice(null);

    try {
      const res = await permanentlyDeleteOperationalEntityAction({
        entityType: target.entityType,
        entityId: target.entityId,
      });

      if (!res.ok) {
        setIsDeleting(false);
        const codeKey = getOperationalLifecycleErrorKey(res.error.code);
        setErrorNotice(tErrors(codeKey as never) || t("errorToast"));
      } else {
        setIsDeleting(false);
        toast.success(t("successToast"));
        onClose();
        onSuccess?.();
        router.refresh();
      }
    } catch {
      setIsDeleting(false);
      setErrorNotice(t("errorToast"));
    }
  };

  const isConfirmDisabled =
    loadingPreview || !preview || !preview.canDelete || isDeleting;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5 shrink-0" />
            <AlertDialogTitle className="text-base font-bold">
              {t("title")}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
            {t("warning")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-3 space-y-3">
          {loadingPreview ? (
            <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
              <Loader2 className="size-4 animate-spin text-primary" />
              <span>{t("previewLoading")}</span>
            </div>
          ) : preview ? (
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
              <div className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
                {tEntities(preview.entityType)}
              </div>
              <div className="text-sm font-semibold text-foreground">
                {preview.title}
              </div>
              {!preview.canDelete && (
                <div
                  role="alert"
                  className="mt-2 text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-md border border-amber-200 dark:border-amber-900"
                >
                  {getBlockerMessage(preview.blockerCode)}
                </div>
              )}
            </div>
          ) : null}

          {errorNotice && (
            <div
              role="alert"
              className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-md border border-destructive/20 font-medium"
            >
              {errorNotice}
            </div>
          )}
        </div>

        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel onClick={handleClose} disabled={isDeleting}>
            {t("cancelAction")}
          </AlertDialogCancel>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isDeleting}
            className="text-xs"
          >
            {t("archiveInsteadAction")}
          </Button>
          <Button
            variant="destructive"
            onClick={handlePermanentDelete}
            disabled={isConfirmDisabled}
            className="text-xs gap-1.5"
            tabIndex={0}
          >
            {isDeleting && <Loader2 className="size-3.5 animate-spin" />}
            <span>{isDeleting ? t("deleting") : t("confirmAction")}</span>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
