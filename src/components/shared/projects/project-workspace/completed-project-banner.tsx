"use client";

import { useTranslations, useFormatter } from "next-intl";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CompletedProjectBannerProps {
  completedAt: string | null;
  effectiveCapacity: "admin" | "pm_lead" | "pm_watcher";
  onReopenClick: () => void;
}

export function CompletedProjectBanner({
  completedAt,
  effectiveCapacity,
  onReopenClick,
}: CompletedProjectBannerProps) {
  const t = useTranslations("projects.workspace");
  const format = useFormatter();

  const isWatcher = effectiveCapacity === "pm_watcher";

  const formattedDate = completedAt
    ? format.dateTime(new Date(completedAt), {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  return (
    <div
      role="status"
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-4 text-green-900 dark:text-green-100"
    >
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold">
            {t("completedBanner.title")}
          </h3>
          <p className="text-xs text-green-800/90 dark:text-green-200/90 mt-0.5">
            {t("completedBanner.completedOn", { date: formattedDate })}
          </p>
        </div>
      </div>

      {!isWatcher && (
        <Button
          variant="outline"
          size="sm"
          onClick={onReopenClick}
          className="border-green-600/40 text-green-900 dark:text-green-100 hover:bg-green-500/20 shrink-0 self-start sm:self-auto h-8 text-xs font-medium gap-1.5"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>{t("completedBanner.reopenAction")}</span>
        </Button>
      )}
    </div>
  );
}
