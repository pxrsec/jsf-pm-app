"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface InvitationConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  type: "rotate" | "revoke";
  isSubmitting: boolean;
}

export function InvitationConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  type,
  isSubmitting,
}: InvitationConfirmDialogProps) {
  const t = useTranslations("clientAdministration.confirmDialog");

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => !open && !isSubmitting && onClose()}
    >
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>
            {type === "rotate" ? t("rotateTitle") : t("revokeTitle")}
          </DialogTitle>
          <DialogDescription className="pt-1.5">
            {type === "rotate"
              ? t("rotateDescription")
              : t("revokeDescription")}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            variant={type === "revoke" ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {type === "rotate" ? t("rotateConfirm") : t("revokeConfirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
