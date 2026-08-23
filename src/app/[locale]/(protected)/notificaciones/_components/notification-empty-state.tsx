"use client";

import { useTranslations } from "next-intl";
import { BellOff } from "lucide-react";

export function NotificationEmptyState() {
  const t = useTranslations("notifications");

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-12 text-center text-card-foreground shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-4">
        <BellOff className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">
        {t("empty.title")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm">
        {t("empty.description")}
      </p>
    </div>
  );
}
