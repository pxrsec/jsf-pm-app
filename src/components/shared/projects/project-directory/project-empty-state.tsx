"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { FolderPlus, FilterX } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

interface ProjectEmptyStateProps {
  isFiltered: boolean;
  onClearFilters: () => void;
  newProjectHref: string;
}

export function ProjectEmptyState({
  isFiltered,
  onClearFilters,
  newProjectHref,
}: ProjectEmptyStateProps) {
  const t = useTranslations("projects.directory.emptyState");

  if (isFiltered) {
    return (
      <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-lg border border-dashed border-border bg-card">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-4">
          <FilterX className="h-6 w-6" />
        </div>
        <h3 className="text-base font-semibold text-foreground">
          {t("noFilterResults")}
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-sm">
          {t("description")}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClearFilters}
          className="mt-4"
        >
          {t("clearFilters")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-lg border border-dashed border-border bg-card">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
        <FolderPlus className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{t("title")}</h3>
      <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-sm">
        {t("description")}
      </p>
      <Link
        href={newProjectHref}
        className={buttonVariants({ size: "sm", className: "mt-4" })}
      >
        {t("createCta")}
      </Link>
    </div>
  );
}
