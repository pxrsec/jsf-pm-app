import { getTranslations } from "next-intl/server";
import { TZDate } from "@date-fns/tz";
import { CALENDAR_TIME_ZONE } from "@/lib/operations-metrics/date-utils";
import type { OperationsMetricTrendPointDto } from "@/lib/operations-metrics/types";
import { TrendChart } from "./trend-chart";

interface TrendChartSectionProps {
  trendPoints: readonly OperationsMetricTrendPointDto[];
}

function formatBucketLabel(startIso: string, endIso: string): string {
  try {
    const startTz = new TZDate(startIso, CALENDAR_TIME_ZONE);
    const endTz = new TZDate(endIso, CALENDAR_TIME_ZONE);

    const sM = startTz.getMonth() + 1;
    const sD = startTz.getDate();
    const eM = endTz.getMonth() + 1;
    const eD = endTz.getDate();

    return `${sD}/${sM} - ${eD}/${eM}`;
  } catch {
    return `${startIso} - ${endIso}`;
  }
}

export async function TrendChartSection({
  trendPoints,
}: TrendChartSectionProps) {
  const t = await getTranslations("metrics.trend");

  const chartData = trendPoints.map((point) => ({
    label: formatBucketLabel(point.periodStart, point.periodEnd),
    finalized: point.finalizedDeliverableCount,
    reviewCycles: point.clientReviewCycleCount,
    completionCycles: point.completionCycleCount,
    reopenedCycles: point.reopeningCycleCount,
  }));

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          {t("title")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("description")}</p>
      </div>

      {/* Visual Recharts BarChart */}
      <TrendChart
        data={chartData}
        finalizedLabel={t("series.finalized")}
        reviewCyclesLabel={t("series.reviewCycles")}
        completionCyclesLabel={t("series.completionCycles")}
        reopenedCyclesLabel={t("series.reopenedCycles")}
      />

      {/* Semantic Accessible Table */}
      <div className="overflow-x-auto pt-2">
        <table className="w-full text-left text-xs border-collapse">
          <caption className="text-left text-[11px] text-muted-foreground pb-2 italic">
            {t("tableCaption")}
          </caption>
          <thead>
            <tr className="border-b border-border/80 text-muted-foreground font-medium">
              <th scope="col" className="pb-2 pl-1">
                {t("columns.period")}
              </th>
              <th scope="col" className="pb-2 text-right">
                {t("columns.finalized")}
              </th>
              <th scope="col" className="pb-2 text-right">
                {t("columns.reviewCycles")}
              </th>
              <th scope="col" className="pb-2 text-right">
                {t("columns.completionCycles")}
              </th>
              <th scope="col" className="pb-2 pr-1 text-right">
                {t("columns.reopenedCycles")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {trendPoints.map((p, idx) => (
              <tr
                key={`bucket-${idx}`}
                className="hover:bg-muted/40 transition-colors"
              >
                <td className="py-2 pl-1 font-mono font-medium text-foreground">
                  {formatBucketLabel(p.periodStart, p.periodEnd)}
                </td>
                <td className="py-2 text-right text-foreground font-mono">
                  {p.finalizedDeliverableCount}
                </td>
                <td className="py-2 text-right text-foreground font-mono">
                  {p.clientReviewCycleCount}
                </td>
                <td className="py-2 text-right text-foreground font-mono">
                  {p.completionCycleCount}
                </td>
                <td className="py-2 pr-1 text-right text-foreground font-mono">
                  {p.reopeningCycleCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {trendPoints.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-2 italic">
            {t("noActivity")}
          </p>
        )}
      </div>
    </section>
  );
}
