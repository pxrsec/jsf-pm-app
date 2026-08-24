import { getTranslations } from "next-intl/server";
import { CheckCircle2, Clock, RotateCcw } from "lucide-react";
import type { OperationsMetricsSummaryDto } from "@/lib/operations-metrics/types";

interface CycleDurationSummaryProps {
  summary: OperationsMetricsSummaryDto;
}

export async function CycleDurationSummary({
  summary,
}: CycleDurationSummaryProps) {
  const t = await getTranslations("metrics.cycles");

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          {t("title")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("description")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
        {/* Client Review Cycle Box */}
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Clock
              className="h-4 w-4 text-purple-600 dark:text-purple-400"
              aria-hidden="true"
            />
            <span>{t("clientReview.heading")}</span>
          </div>

          <dl className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="text-muted-foreground">
                {t("clientReview.count")}:
              </dt>
              <dd className="font-semibold text-foreground text-sm font-mono mt-0.5">
                {summary.clientReviewCycleCount}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {t("clientReview.average")}:
              </dt>
              <dd className="font-semibold text-foreground text-sm font-mono mt-0.5">
                {summary.averageClientReviewHours !== null
                  ? `${summary.averageClientReviewHours.toFixed(1)} ${t("hoursUnit")}`
                  : t("noData")}
              </dd>
            </div>
          </dl>
          <p className="text-[11px] text-muted-foreground italic">
            {t("clientReview.note")}
          </p>
        </div>

        {/* Project Completion Cycle Box */}
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <CheckCircle2
              className="h-4 w-4 text-green-600 dark:text-green-400"
              aria-hidden="true"
            />
            <span>{t("projectCompletion.heading")}</span>
          </div>

          <dl className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <dt className="text-muted-foreground">
                {t("projectCompletion.count")}:
              </dt>
              <dd className="font-semibold text-foreground text-sm font-mono mt-0.5">
                {summary.completionCycleCount}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {t("projectCompletion.average")}:
              </dt>
              <dd className="font-semibold text-foreground text-sm font-mono mt-0.5">
                {summary.averageCompletionCycleDurationDays !== null
                  ? `${summary.averageCompletionCycleDurationDays.toFixed(1)} ${t("daysUnit")}`
                  : t("noData")}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">
                {t("projectCompletion.reopened")}:
              </dt>
              <dd className="font-semibold text-foreground text-sm font-mono mt-0.5 flex items-center gap-1">
                <RotateCcw
                  className="h-3 w-3 text-purple-600 dark:text-purple-400 inline"
                  aria-hidden="true"
                />
                {summary.reopeningCycleCount}
              </dd>
            </div>
          </dl>
          <p className="text-[11px] text-muted-foreground italic">
            {t("projectCompletion.note")}
          </p>
        </div>
      </div>
    </section>
  );
}
