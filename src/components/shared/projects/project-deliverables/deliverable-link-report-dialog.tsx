"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Flag, Loader2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { reportDeliverableLinkAction } from "@/lib/deliverables/actions";
import type { DeliverableVersionView } from "@/lib/deliverables/queries";

interface DeliverableLinkReportDialogProps {
  version: DeliverableVersionView | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function DeliverableLinkReportDialog({
  version,
  isOpen,
  onClose,
  onSuccess,
}: DeliverableLinkReportDialogProps) {
  const t = useTranslations("projects.workspace.deliverables.linkReportDialog");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!version) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    const result = await reportDeliverableLinkAction({
      deliverable_id: version.deliverable_id,
      version_id: version.id,
      reason: reason.trim(),
    });

    setIsSubmitting(false);

    if (result.ok) {
      setReason("");
      onClose();
      onSuccess(t("successToast"));
    } else {
      setError(result.error.message);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
              <Flag className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                {t("title")}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {t("description", { version: String(version.version_number) })}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Truthfulness Notice */}
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Este reporte registra una alerta interna para el equipo. El sistema
              no valida ni descarga el enlace de forma remota y el estado del
              entregable no se modificará.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="report-reason" className="text-xs font-medium">
              {t("reasonLabel")} <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="report-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("reasonPlaceholder")}
              rows={3}
              maxLength={1000}
              required
              className="text-xs resize-none"
            />
            <p className="text-[10px] text-muted-foreground text-right">
              {reason.length} / 1000
            </p>
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 p-2 rounded-md">
              {error}
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs"
            >
              {t("cancelAction")}
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={!reason.trim() || isSubmitting}
              className="text-xs gap-1.5"
            >
              {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
              <span>{isSubmitting ? t("submitting") : t("submitAction")}</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
