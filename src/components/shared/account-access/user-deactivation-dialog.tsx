"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setUserAccessStateAction } from "@/lib/account-access/actions";

export interface UserDeactivationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUser: {
    userId: string;
    fullName: string;
  } | null;
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
}

export function UserDeactivationDialog({
  open,
  onOpenChange,
  targetUser,
  triggerRef,
}: UserDeactivationDialogProps) {
  const t = useTranslations("accountAccess");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [confirmationName, setConfirmationName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!targetUser) return null;

  const isMatched =
    confirmationName.trim() === targetUser.fullName.trim() &&
    targetUser.fullName.trim().length > 0;

  const handleClose = () => {
    if (isPending) return;
    setConfirmationName("");
    setErrorMessage(null);
    onOpenChange(false);
    triggerRef?.current?.focus();
  };

  const handleConfirm = () => {
    if (!isMatched || isPending) return;
    setErrorMessage(null);

    startTransition(async () => {
      const result = await setUserAccessStateAction({
        targetUserId: targetUser.userId,
        isActive: false,
        confirmationFullName: confirmationName.trim(),
      });

      if (result.ok) {
        toast.success(t("deactivationDialog.successToast"));
        onOpenChange(false);
        triggerRef?.current?.focus();
        router.refresh();
      } else {
        const code = result.error.code;
        if (code === "self_lockout_forbidden") {
          setErrorMessage(t("deactivationDialog.errors.selfLockout"));
        } else if (code === "last_management_account_forbidden") {
          setErrorMessage(t("deactivationDialog.errors.lastManagementAccount"));
        } else if (code === "not_found") {
          setErrorMessage(t("deactivationDialog.errors.notFound"));
          router.refresh();
        } else {
          setErrorMessage(t("deactivationDialog.errors.unavailable"));
        }
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
        data-testid="user-deactivation-dialog"
      >
        <AlertDialogHeader className="text-left space-y-2">
          <AlertDialogTitle className="text-lg font-semibold text-destructive flex items-center gap-2">
            <AlertTriangle className="size-5 shrink-0" />
            <span>{t("deactivationDialog.title")}</span>
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground">
            {t("deactivationDialog.description", { name: targetUser.fullName })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Warning Banner */}
        <div
          role="note"
          className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive space-y-1"
        >
          <p className="font-semibold">
            {t("deactivationDialog.warningBanner")}
          </p>
        </div>

        {/* Confirmation Input */}
        <div className="space-y-2">
          <Label htmlFor="deactivation-confirm-name" className="text-xs">
            {t("deactivationDialog.nameConfirmationPrompt", {
              name: targetUser.fullName,
            })}
          </Label>
          <Input
            id="deactivation-confirm-name"
            type="text"
            value={confirmationName}
            onChange={(e) => setConfirmationName(e.target.value)}
            placeholder={t("deactivationDialog.nameConfirmationPlaceholder")}
            disabled={isPending}
            autoComplete="off"
          />
          {!isMatched && confirmationName.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {t("deactivationDialog.nameMismatchError")}
            </p>
          )}
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
            {t("deactivationDialog.cancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isMatched || isPending}
            className="min-h-[44px]"
          >
            {isPending
              ? t("deactivationDialog.deactivating")
              : t("deactivationDialog.confirm")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
