"use client";

import { useTranslations } from "next-intl";
import { Send, AlertCircle, Ban } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

interface DeliverablesTabPlaceholderProps {
  isInternal: boolean;
  hasClientMember: boolean;
}

export function DeliverablesTabPlaceholder({
  isInternal,
  hasClientMember,
}: DeliverablesTabPlaceholderProps) {
  const t = useTranslations("projects.workspace.placeholders");

  if (isInternal) {
    return (
      <Card className="border-dashed border-border bg-card/60">
        <CardHeader className="text-center py-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-2">
            <Ban className="h-6 w-6" />
          </div>
          <CardTitle className="text-base font-semibold">{t("deliverablesTitle")}</CardTitle>
          <CardDescription className="text-xs sm:text-sm max-w-md mx-auto mt-1 text-muted-foreground">
            {t("internalDeliverablesDisabled")}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {!hasClientMember && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3.5 text-xs text-yellow-800 dark:text-yellow-200">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Revisión de cliente bloqueada</p>
            <p className="mt-0.5">{t("clientReviewBlockedNotice")}</p>
          </div>
        </div>
      )}

      <Card className="border-dashed border-border bg-card/60">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
            <Send className="h-6 w-6" />
          </div>
          <CardTitle className="text-lg font-semibold">{t("deliverablesTitle")}</CardTitle>
          <CardDescription className="text-xs sm:text-sm max-w-md mx-auto">
            {t("deliverablesDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 pb-6">
          <div className="max-w-xl mx-auto rounded-lg border border-border bg-muted/40 p-4 space-y-2 text-center opacity-70">
            <span className="text-xs font-medium text-muted-foreground">
              Flujo de versiones y revisiones inmutables (S04-06)
            </span>
            <p className="text-xs text-muted-foreground">
              Pendiente → Esperando Revisión Interna (PM) → Esperando Revisión de Cliente → Aprobado / Cambios Solicitados → Entregado
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
