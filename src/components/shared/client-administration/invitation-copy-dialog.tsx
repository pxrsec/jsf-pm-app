"use client";

import { useState } from "react";
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
import { Copy, Check, AlertCircle } from "lucide-react";

interface InvitationCopyDialogProps {
  isOpen: boolean;
  onDismiss: () => void;
  invitationUrl: string | null;
}

export function InvitationCopyDialog({
  isOpen,
  onDismiss,
  invitationUrl,
}: InvitationCopyDialogProps) {
  const t = useTranslations("clientAdministration.copyDialog");
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const handleCopy = async () => {
    if (!invitationUrl) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(invitationUrl);
        setCopied(true);
        setCopyFailed(false);
        setTimeout(() => setCopied(false), 3000);
      } else {
        // Fallback
        const textArea = document.createElement("textarea");
        textArea.value = invitationUrl;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const success = document.execCommand("copy");
        document.body.removeChild(textArea);
        if (success) {
          setCopied(true);
          setCopyFailed(false);
          setTimeout(() => setCopied(false), 3000);
        } else {
          setCopyFailed(true);
        }
      }
    } catch {
      setCopyFailed(true);
    }
  };

  const handleClose = () => {
    setCopied(false);
    setCopyFailed(false);
    onDismiss();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription className="pt-2 text-xs leading-relaxed">
            {t("description")}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-3">
          <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <p>{t("oneTimeWarning")}</p>
            </div>
          </div>

          <div className="flex justify-center pt-2">
            <Button
              type="button"
              variant={copied ? "secondary" : "default"}
              className="w-full h-10 gap-2 font-medium"
              onClick={handleCopy}
              disabled={!invitationUrl}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{t("copied")}</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>{t("copyAction")}</span>
                </>
              )}
            </Button>
          </div>

          {copyFailed && (
            <p
              role="alert"
              className="text-xs text-center text-destructive font-medium"
            >
              {t("copyFailed")}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>
            {t("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
