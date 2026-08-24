import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import {
  AlertTriangle,
  Archive,
  BarChart3,
  Bell,
  Calendar,
  FileCheck2,
  Link2Off,
  Radio,
  ShieldAlert,
} from "lucide-react";
import type { OperationsMetricsSummaryDto } from "@/lib/operations-metrics/types";

interface OperationalAttentionSectionProps {
  summary: OperationsMetricsSummaryDto;
}

export async function OperationalAttentionSection({
  summary,
}: OperationalAttentionSectionProps) {
  const t = await getTranslations("adminOperations.attention");
  const destT = await getTranslations("adminOperations.destinations");

  return (
    <div className="space-y-6">
      {/* 1. Operational Attention Cards */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            {t("title")}
          </h2>
          <p className="text-xs text-muted-foreground">{t("description")}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Overdue */}
          <div className="rounded-lg border border-border/70 bg-destructive/5 p-3.5 space-y-1">
            <div className="flex items-center justify-between text-xs text-destructive font-medium">
              <span>{t("overdueTasks")}</span>
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="text-xl font-bold text-destructive font-mono">
              {summary.overdueTaskCount}
            </div>
          </div>

          {/* Deadlines in Range */}
          <div className="rounded-lg border border-border/70 bg-card p-3.5 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
              <span>{t("deadlinesInRange")}</span>
              <Calendar
                className="h-4 w-4 text-amber-600 dark:text-amber-400"
                aria-hidden="true"
              />
            </div>
            <div className="text-xl font-bold text-foreground font-mono">
              {summary.deadlineAttentionCount}
            </div>
          </div>

          {/* Unresolved Links */}
          <div className="rounded-lg border border-border/70 bg-card p-3.5 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
              <span>{t("unresolvedLinkIncidents")}</span>
              <Link2Off
                className="h-4 w-4 text-orange-600 dark:text-orange-400"
                aria-hidden="true"
              />
            </div>
            <div className="text-xl font-bold text-foreground font-mono">
              {summary.unresolvedLinkReportCount}
            </div>
          </div>

          {/* Finalized in Range */}
          <div className="rounded-lg border border-border/70 bg-card p-3.5 space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
              <span>{t("finalizedDeliverables")}</span>
              <FileCheck2
                className="h-4 w-4 text-emerald-600 dark:text-emerald-400"
                aria-hidden="true"
              />
            </div>
            <div className="text-xl font-bold text-foreground font-mono">
              {summary.finalizedDeliverableCount}
            </div>
          </div>
        </div>

        {summary.suppressedExternalQueueCount !== null && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-start gap-3 text-xs">
            <ShieldAlert
              className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="space-y-0.5">
              <p className="font-semibold text-foreground">
                {t("suppressionNoticeTitle", {
                  count: summary.suppressedExternalQueueCount,
                })}
              </p>
              <p className="text-muted-foreground">
                {t("suppressionNoticeBody")}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* 2. Operational Destinations Grid */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            {destT("title")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {destT("description")}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Metrics */}
          <Link
            href="/admin/metricas"
            className="group rounded-lg border border-border p-4 hover:border-primary hover:bg-muted/40 transition-all flex flex-col justify-between min-h-[44px]"
          >
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-sm text-foreground group-hover:text-primary">
                <BarChart3
                  className="h-4 w-4 text-primary"
                  aria-hidden="true"
                />
                <span>{destT("metrics.title")}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {destT("metrics.description")}
              </p>
            </div>
            <span className="text-[11px] font-medium text-primary mt-3 inline-flex items-center gap-1">
              {destT("viewDestination")} &rarr;
            </span>
          </Link>

          {/* Archive */}
          <Link
            href="/admin/archivo"
            className="group rounded-lg border border-border p-4 hover:border-primary hover:bg-muted/40 transition-all flex flex-col justify-between min-h-[44px]"
          >
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-sm text-foreground group-hover:text-primary">
                <Archive className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>{destT("archive.title")}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {destT("archive.description")}
              </p>
            </div>
            <span className="text-[11px] font-medium text-primary mt-3 inline-flex items-center gap-1">
              {destT("viewDestination")} &rarr;
            </span>
          </Link>

          {/* Link Incidents */}
          <Link
            href="/admin/incidentes-enlaces"
            className="group rounded-lg border border-border p-4 hover:border-primary hover:bg-muted/40 transition-all flex flex-col justify-between min-h-[44px]"
          >
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-sm text-foreground group-hover:text-primary">
                <Radio className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>{destT("linkIncidents.title")}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {destT("linkIncidents.description")}
              </p>
            </div>
            <span className="text-[11px] font-medium text-primary mt-3 inline-flex items-center gap-1">
              {destT("viewDestination")} &rarr;
            </span>
          </Link>

          {/* Notification Operations */}
          <Link
            href="/admin/notificaciones"
            className="group rounded-lg border border-border p-4 hover:border-primary hover:bg-muted/40 transition-all flex flex-col justify-between min-h-[44px]"
          >
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-sm text-foreground group-hover:text-primary">
                <Bell className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>{destT("notifications.title")}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {destT("notifications.description")}
              </p>
            </div>
            <span className="text-[11px] font-medium text-primary mt-3 inline-flex items-center gap-1">
              {destT("viewDestination")} &rarr;
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
