import { getTranslations } from "next-intl/server";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  FileCheck2,
  Link2Off,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import type { OperationsMetricsSummaryDto } from "@/lib/operations-metrics/types";

interface MetricCardsGridProps {
  summary: OperationsMetricsSummaryDto;
}

export async function MetricCardsGrid({ summary }: MetricCardsGridProps) {
  const t = await getTranslations("metrics.cards");

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Active Tasks */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            {t("activeTasks.title")}
          </span>
          <Clock
            className="h-4 w-4 text-blue-600 dark:text-blue-400"
            aria-hidden="true"
          />
        </div>
        <div className="text-2xl font-bold tracking-tight text-foreground">
          {summary.activeTaskCount}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("activeTasks.description")}
        </p>
      </div>

      {/* 2. Overdue Tasks */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            {t("overdueTasks.title")}
          </span>
          <AlertTriangle
            className="h-4 w-4 text-destructive"
            aria-hidden="true"
          />
        </div>
        <div className="text-2xl font-bold tracking-tight text-destructive">
          {summary.overdueTaskCount}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("overdueTasks.description")}
        </p>
      </div>

      {/* 3. Deadlines in Range */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            {t("deadlinesInRange.title")}
          </span>
          <Calendar
            className="h-4 w-4 text-amber-600 dark:text-amber-400"
            aria-hidden="true"
          />
        </div>
        <div className="text-2xl font-bold tracking-tight text-foreground">
          {summary.deadlineAttentionCount}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("deadlinesInRange.description")}
        </p>
      </div>

      {/* 4. Finalized Production Deliverables */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            {t("finalizedDeliverables.title")}
          </span>
          <FileCheck2
            className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
            aria-hidden="true"
          />
        </div>
        <div className="text-2xl font-bold tracking-tight text-foreground">
          {summary.finalizedDeliverableCount}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("finalizedDeliverables.description")}
        </p>
      </div>

      {/* 5. Unresolved Link Incidents */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            {t("unresolvedLinkIncidents.title")}
          </span>
          <Link2Off
            className="h-4 w-4 text-orange-600 dark:text-orange-400"
            aria-hidden="true"
          />
        </div>
        <div className="text-2xl font-bold tracking-tight text-foreground">
          {summary.unresolvedLinkReportCount}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("unresolvedLinkIncidents.description")}
        </p>
      </div>

      {/* 6. Completed Project Cycles */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            {t("completedCycles.title")}
          </span>
          <CheckCircle2
            className="h-4 w-4 text-green-600 dark:text-green-400"
            aria-hidden="true"
          />
        </div>
        <div className="text-2xl font-bold tracking-tight text-foreground">
          {summary.completionCycleCount}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("completedCycles.description")}
        </p>
      </div>

      {/* 7. Reopened Completed Cycles */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            {t("reopenedCycles.title")}
          </span>
          <RotateCcw
            className="h-4 w-4 text-purple-600 dark:text-purple-400"
            aria-hidden="true"
          />
        </div>
        <div className="text-2xl font-bold tracking-tight text-foreground">
          {summary.reopeningCycleCount}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("reopenedCycles.description")}
        </p>
      </div>

      {/* 8. Suppressed External Queue Count (or Authority-Limited State) */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            {t("suppressedExternal.title")}
          </span>
          <ShieldAlert
            className="h-4 w-4 text-amber-600 dark:text-amber-400"
            aria-hidden="true"
          />
        </div>
        {summary.suppressedExternalQueueCount !== null ? (
          <>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {summary.suppressedExternalQueueCount}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("suppressedExternal.description")}
            </p>
          </>
        ) : (
          <div className="py-2">
            <span className="text-xs font-medium text-muted-foreground italic">
              {t("authorityLimited")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
