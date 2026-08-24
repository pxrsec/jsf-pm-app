import { getTranslations } from "next-intl/server";
import type {
  DeliverableStatus,
  OperationsMetricsSummaryDto,
  ProjectStatus,
} from "@/lib/operations-metrics/types";
import { StatusDistributionChart } from "./status-distribution-chart";

interface StatusDistributionSectionProps {
  summary: OperationsMetricsSummaryDto;
}

const PROJECT_STATUS_COLORS: Record<ProjectStatus, string> = {
  planning: "#0284c7", // Sky 600
  in_progress: "#d97706", // Amber 600
  paused: "#64748b", // Slate 500
  completed: "#16a34a", // Green 600
  cancelled: "#e11d48", // Rose 600
};

const DELIVERABLE_STATUS_COLORS: Record<DeliverableStatus, string> = {
  pending: "#3b82f6", // Blue 500
  awaiting_internal_review: "#6366f1", // Indigo 500
  awaiting_client_review: "#8b5cf6", // Purple 500
  approved: "#10b981", // Emerald 500
  changes_requested: "#f97316", // Orange 500
  delivered: "#14b8a6", // Teal 500
  submitted: "#06b6d4", // Cyan 500
};

const PROJECT_STATUS_ORDER: readonly ProjectStatus[] = [
  "planning",
  "in_progress",
  "paused",
  "completed",
  "cancelled",
];

const DELIVERABLE_STATUS_ORDER: readonly DeliverableStatus[] = [
  "pending",
  "awaiting_internal_review",
  "awaiting_client_review",
  "approved",
  "changes_requested",
  "delivered",
  "submitted",
];

export async function StatusDistributionSection({
  summary,
}: StatusDistributionSectionProps) {
  const t = await getTranslations("metrics.distributions");
  const pStatusT = await getTranslations("metrics.projectStatus");
  const dStatusT = await getTranslations("metrics.deliverableStatus");

  // Project Distribution calculations
  const projectTotal = Object.values(summary.projectCountsByStatus).reduce(
    (acc, val) => acc + val,
    0,
  );
  const projectDataPoints = PROJECT_STATUS_ORDER.map((status) => {
    const count = summary.projectCountsByStatus[status] ?? 0;
    const pct = projectTotal > 0 ? (count / projectTotal) * 100 : null;
    return {
      statusKey: status,
      label: pStatusT(status),
      count,
      pct,
      color: PROJECT_STATUS_COLORS[status],
    };
  });

  // Deliverable Distribution calculations
  const deliverableTotal = Object.values(
    summary.productionDeliverableCountsByStatus,
  ).reduce((acc, val) => acc + val, 0);
  const deliverableDataPoints = DELIVERABLE_STATUS_ORDER.map((status) => {
    const count = summary.productionDeliverableCountsByStatus[status] ?? 0;
    const pct = deliverableTotal > 0 ? (count / deliverableTotal) * 100 : null;
    return {
      statusKey: status,
      label: dStatusT(status),
      count,
      pct,
      color: DELIVERABLE_STATUS_COLORS[status],
    };
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. Project Status Distribution */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {t("projects.title")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("projects.description", { total: projectTotal })}
            </p>
          </div>
        </div>

        {/* Recharts Bar Chart */}
        <StatusDistributionChart
          data={projectDataPoints}
          yAxisLabel={t("table.count")}
        />

        {/* Semantic Accessible Table */}
        <div className="overflow-x-auto pt-2">
          <table className="w-full text-left text-xs border-collapse">
            <caption className="sr-only">{t("projects.tableCaption")}</caption>
            <thead>
              <tr className="border-b border-border/80 text-muted-foreground font-medium">
                <th scope="col" className="pb-2 pl-1">
                  {t("table.status")}
                </th>
                <th scope="col" className="pb-2 text-right">
                  {t("table.count")}
                </th>
                <th scope="col" className="pb-2 pr-1 text-right">
                  {t("table.percentage")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {projectDataPoints.map((dp) => (
                <tr
                  key={dp.statusKey}
                  className="hover:bg-muted/40 transition-colors"
                >
                  <td className="py-2 pl-1 font-medium text-foreground flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: dp.color }}
                      aria-hidden="true"
                    />
                    {dp.label}
                  </td>
                  <td className="py-2 text-right text-foreground font-mono">
                    {dp.count}
                  </td>
                  <td className="py-2 pr-1 text-right text-muted-foreground font-mono">
                    {dp.pct !== null ? `${dp.pct.toFixed(1)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {projectTotal === 0 && (
            <p className="text-center text-xs text-muted-foreground py-2 italic">
              {t("noRecords")}
            </p>
          )}
        </div>
      </section>

      {/* 2. Deliverable Status Distribution */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {t("deliverables.title")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("deliverables.description", { total: deliverableTotal })}
            </p>
          </div>
        </div>

        {/* Recharts Bar Chart */}
        <StatusDistributionChart
          data={deliverableDataPoints}
          yAxisLabel={t("table.count")}
        />

        {/* Semantic Accessible Table */}
        <div className="overflow-x-auto pt-2">
          <table className="w-full text-left text-xs border-collapse">
            <caption className="sr-only">
              {t("deliverables.tableCaption")}
            </caption>
            <thead>
              <tr className="border-b border-border/80 text-muted-foreground font-medium">
                <th scope="col" className="pb-2 pl-1">
                  {t("table.status")}
                </th>
                <th scope="col" className="pb-2 text-right">
                  {t("table.count")}
                </th>
                <th scope="col" className="pb-2 pr-1 text-right">
                  {t("table.percentage")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {deliverableDataPoints.map((dp) => (
                <tr
                  key={dp.statusKey}
                  className="hover:bg-muted/40 transition-colors"
                >
                  <td className="py-2 pl-1 font-medium text-foreground flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: dp.color }}
                      aria-hidden="true"
                    />
                    {dp.label}
                  </td>
                  <td className="py-2 text-right text-foreground font-mono">
                    {dp.count}
                  </td>
                  <td className="py-2 pr-1 text-right text-muted-foreground font-mono">
                    {dp.pct !== null ? `${dp.pct.toFixed(1)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {deliverableTotal === 0 && (
            <p className="text-center text-xs text-muted-foreground py-2 italic">
              {t("noRecords")}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
