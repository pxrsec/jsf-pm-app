"use client";

import { useTranslations } from "next-intl";
import { BellOff } from "lucide-react";
import type { NotificationReadFilter } from "@/lib/notifications/inbox-contracts";

interface NotificationEmptyStateProps {
  readFilter?: NotificationReadFilter;
  isCustomDateRange?: boolean;
}

export function NotificationEmptyState({
  readFilter = "all",
  isCustomDateRange = false,
}: NotificationEmptyStateProps) {
  const t = useTranslations("notifications");

  let titleKey = "empty.title";
  let descKey = "empty.description";

  if (isCustomDateRange) {
    titleKey = "empty.customRangeTitle";
    descKey = "empty.customRangeDescription";
  } else if (readFilter === "unread") {
    titleKey = "empty.unreadTitle";
    descKey = "empty.unreadDescription";
  } else if (readFilter === "read") {
    titleKey = "empty.readTitle";
    descKey = "empty.readDescription";
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-12 text-center text-card-foreground shadow-xs animate-in fade-in-50">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-4">
        <BellOff className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">{t(titleKey)}</h2>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm">
        {t(descKey)}
      </p>
    </div>
  );
}
