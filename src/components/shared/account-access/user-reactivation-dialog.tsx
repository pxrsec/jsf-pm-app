"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { toast } from "sonner";
import { UserCheck } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { setUserAccessStateAction } from "@/lib/account-access/actions";

export interface UserReactivationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUser: {
    userId: string;
    fullName: string;
  } | null;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
}

export function UserReactivationDialog({
  open,
  onOpenChange,
  targetUser,
  triggerRef,
}: UserReactivationDialogProps) {
  const t = useTranslations("accountAccess");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!targetUser) return null;

  const handleClose = () => {
    if (isPending) return;
    setErrorMessage(null);
    onOpenChange(false);
    triggerRef?.current?.focus();
  };

  const handleConfirm = () => {
    if (isPending) return;
    setErrorMessage(null);

    startTransition(async () => {
      const result = await setUserAccessStateAction({
        targetUserId: targetUser.userId,
        isActive: true,
      });

      if (result.ok) {
        toast.success(t("reactivationDialog.successToast"));
        onOpenChange(false);
        triggerRef?.current?.focus();
        router.refresh();
      } else {
        setErrorMessage(t("reactivationDialog.errors.unavailable"));
      }
    });
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!isPending) {
          if (!next) handleClose();
          else onOpenChange(true);
        }
      }}
    >
      <AlertDialogContent
        className="max-w-md space-y-4"
        data-testid="user-reactivation-dialog"
      >
        <AlertDialogHeader className="text-left space-y-2">
          <AlertDialogTitle className="text-lg font-semibold flex items-center gap-2">
            <UserCheck className="size-5 text-primary shrink-0" />
            <span>{t("reactivationDialog.title")}</span>
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground">
            {t("reactivationDialog.description", { name: targetUser.fullName })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Notice that invitations are NOT restored */}
        <div
          role="note"
          className="rounded-md border border-muted-foreground/20 bg-muted/40 p-3 text-xs text-muted-foreground space-y-1"
        >
          <p>{t("reactivationDialog.warningNoInvitesRestored")}</p>
        </div>

        {/* Server Error Alert */}
        {errorMessage && (
          <div
            role="alert"
            className="rounded-md bg-destructive/15 p-3 text-sm text-destructive"
          >
            {errorMessage}
          </div>
        )}

        <AlertDialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isPending}
            className="min-h-[44px]"
          >
            {t("reactivationDialog.cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="min-h-[44px]"
          >
            {isPending
              ? t("reactivationDialog.reactivating")
              : t("reactivationDialog.confirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
