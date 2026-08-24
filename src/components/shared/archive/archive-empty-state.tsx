"use client";

import { useTranslations } from "next-intl";
import { Archive } from "lucide-react";

interface ArchiveEmptyStateProps {
  isFiltered?: boolean;
}

export function ArchiveEmptyState({
  isFiltered = false,
}: ArchiveEmptyStateProps) {
  const t = useTranslations("archive.empty");

  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-border p-8 text-center animate-in fade-in-50">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60 text-muted-foreground mb-4">
        <Archive className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-foreground">
        {isFiltered ? t("filteredTitle") : t("title")}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm">
        {isFiltered ? t("filteredDescription") : t("description")}
      </p>
    </div>
  );
}
