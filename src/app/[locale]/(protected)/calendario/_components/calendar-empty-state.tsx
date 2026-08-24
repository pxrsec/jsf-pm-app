"use client";

import { useTranslations } from "next-intl";
import { CalendarX2 } from "lucide-react";

interface CalendarEmptyStateProps {
  hasFilter?: boolean;
}

export function CalendarEmptyState({ hasFilter }: CalendarEmptyStateProps) {
  const t = useTranslations("calendar.states");

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card p-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <CalendarX2 className="h-6 w-6" aria-hidden="true" />
      </div>
      <p className="mt-4 text-base font-medium text-foreground">
        {hasFilter ? t("emptyFiltered") : t("empty")}
      </p>
    </div>
  );
}
