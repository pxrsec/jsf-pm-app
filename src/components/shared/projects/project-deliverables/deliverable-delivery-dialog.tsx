"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Truck, Info } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeliverableStatusBadge } from "./deliverable-status-badge";
import { markDeliverableDeliveredAction } from "@/lib/deliverables/review-actions";
import type {
  DeliverableDetailView,
  DeliverableListItem,
} from "@/lib/deliverables/queries";

interface DeliverableDeliveryDialogProps {
  deliverable: DeliverableDetailView | DeliverableListItem | null;
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg?: string) => void;
  onError?: (code: string) => void;
}

export function DeliverableDeliveryDialog({
  deliverable,
  projectId,
  isOpen,
  onClose,
  onSuccess,
  onError,
}: DeliverableDeliveryDialogProps) {
  const t = useTranslations("projects.workspace.deliverables");
  const [isDelivering, setIsDelivering] = useState(false);

  if (!deliverable) return null;

  const handleConfirm = async () => {
    setIsDelivering(true);
    try {
      const result = await markDeliverableDeliveredAction({
        deliverable_id: deliverable.id,
        project_id: projectId,
      });

      if (result.ok) {
        onClose();
        onSuccess(t("deliveryDialog.successToast"));
      } else {
        const errCode = result.error.code;
        if (errCode === "UNAUTHORIZED") {
          toast.error(t("errors.unauthorized"));
        } else if (errCode === "NOT_FOUND") {
          toast.error(t("errors.notFound"));
        } else if (errCode === "INVALID_TRANSITION") {
          toast.error(t("errors.staleDelivery"));
        } else {
          toast.error(t("deliveryDialog.errorToast"));
        }
        onClose();
        onError?.(errCode);
      }
    } catch {
      toast.error(t("deliveryDialog.errorToast"));
      onClose();
    } finally {
      setIsDelivering(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader className="space-y-2 text-left">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
              <Truck className="size-4" />
            </div>
            <AlertDialogTitle className="text-base font-bold">
              {t("deliveryDialog.title")}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
            {t("deliveryDialog.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Read-Only Context */}
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-foreground truncate">
              {deliverable.title}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <DeliverableStatusBadge status={deliverable.status} />
              <Badge variant="secondary" className="font-mono text-xs">
                v{deliverable.current_version_number || 1}
              </Badge>
            </div>
          </div>
        </div>

        {/* Truthfulness Notice */}
        <div className="flex items-start gap-2.5 p-3 rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-900 dark:text-blue-200 text-xs">
          <Info className="size-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
          <p className="leading-relaxed">
            {t("deliveryDialog.truthfulnessNotice")}
          </p>
        </div>

        <AlertDialogFooter className="flex flex-row justify-end gap-2 pt-2 border-t border-border">
          <AlertDialogCancel
            size="sm"
            onClick={onClose}
            disabled={isDelivering}
            className="text-xs"
          >
            {t("deliveryDialog.cancelAction")}
          </AlertDialogCancel>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={isDelivering}
            className="text-xs gap-1.5 bg-teal-600 hover:bg-teal-700 text-white"
          >
            <Truck className="size-3.5" />
            <span>
              {isDelivering
                ? t("deliveryDialog.delivering")
                : t("deliveryDialog.confirmAction")}
            </span>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
