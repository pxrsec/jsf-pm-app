import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { requireSession } from "@/lib/auth/session";
import { ROLE_DEFAULT_PATHS } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";
import { fetchArchiveProjectFilterOptionsForPm } from "@/lib/archive/queries";
import {
  fetchScopedOperationsMetrics,
  fetchScopedOperationsMetricTrend,
} from "@/lib/operations-metrics/queries";
import { fetchScopedUserOperationsMetrics } from "@/lib/user-operations-metrics/queries";
import type { UserOperationsMetricsQuery } from "@/lib/user-operations-metrics/types";
import { normalizeMetricsSearchState } from "@/lib/operations-metrics/date-utils";
import { MetricsFilterBar } from "@/components/shared/metrics/metrics-filter-bar";
import { MetricCardsGrid } from "@/components/shared/metrics/metric-cards-grid";
import { StatusDistributionSection } from "@/components/shared/metrics/status-distribution-section";
import { TrendChartSection } from "@/components/shared/metrics/trend-chart-section";
import { CycleDurationSummary } from "@/components/shared/metrics/cycle-duration-summary";
import { UserOperationalAuditSection } from "@/components/shared/metrics/user-operational-audit-section";
import { AlertCircle, Archive, FolderKanban, Radio } from "lucide-react";

interface PmMetricsPageProps {
  searchParams: Promise<{
    from?: string;
    to?: string;
    projectId?: string;
    userId?: string;
  }>;
}

export default async function PmMetricsPage({
  searchParams,
}: PmMetricsPageProps) {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "pm") {
    redirect(ROLE_DEFAULT_PATHS[session.role] ?? "/iniciar-sesion");
  }

  const t = await getTranslations("metrics");
  const supabase = createClient(cookieStore);

  // 1. Fetch authorized PM project options
  const projectOptions = await fetchArchiveProjectFilterOptionsForPm(
    supabase,
    session.user.id,
  );

  // 2. If no authorized projects exist, render localized empty state without calling M3/M5/UserAudit
  if (!projectOptions || projectOptions.length === 0) {
    return (
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t("pmTitle")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("pmDescription")}</p>
        </header>

        <div className="rounded-xl border border-border bg-card p-8 text-center space-y-3">
          <FolderKanban
            className="h-10 w-10 text-muted-foreground/50 mx-auto"
            aria-hidden="true"
          />
          <h2 className="text-base font-semibold text-foreground">
            {t("noAuthorizedProjectsTitle")}
          </h2>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {t("noAuthorizedProjectsDescription")}
          </p>
        </div>
      </div>
    );
  }

  // 3. Fallback: If raw projectId is missing, invalid, or not in options, select the first option in deterministic name order
  const resolvedSearchParams = await searchParams;
  const rawProjectId = resolvedSearchParams.projectId;
  const matchedProject = projectOptions.find((p) => p.id === rawProjectId);
  const selectedProject = matchedProject ?? projectOptions[0]!;
  const selectedProjectId = selectedProject.id;

  const currentQuery = normalizeMetricsSearchState(resolvedSearchParams, "pm", {
    fixedProjectId: selectedProjectId,
  });

  const userAuditRpcQuery: UserOperationsMetricsQuery = {
    from: currentQuery.from,
    to: currentQuery.to,
    projectId: selectedProjectId,
    userId: undefined, // Always query full user dataset for dashboard
  };

  // 4. Fetch metrics, trend, and user audit with independent section-level failure isolation
  const [metricsSettled, trendSettled, userAuditSettled] =
    await Promise.allSettled([
      fetchScopedOperationsMetrics(supabase, currentQuery, "pm"),
      fetchScopedOperationsMetricTrend(supabase, currentQuery, "pm"),
      fetchScopedUserOperationsMetrics(supabase, userAuditRpcQuery, "pm"),
    ]);

  const metricsAvailable =
    metricsSettled.status === "fulfilled" &&
    metricsSettled.value.status === "available"
      ? metricsSettled.value.data
      : null;

  const trendAvailable =
    trendSettled.status === "fulfilled" &&
    trendSettled.value.status === "available"
      ? trendSettled.value.data
      : null;

  const userAuditResult =
    userAuditSettled.status === "fulfilled"
      ? userAuditSettled.value
      : { status: "unavailable" as const, code: "UNAVAILABLE" as const };

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page Header */}
      <header className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {t("pmTitle")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("pmDescription")}
            </p>
          </div>

          {/* Selected Project Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
            <FolderKanban className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{selectedProject.name}</span>
          </div>
        </div>
      </header>

      {/* Filter Bar */}
      <MetricsFilterBar
        currentFrom={currentQuery.from}
        currentTo={currentQuery.to}
        currentProjectId={selectedProjectId}
        projects={projectOptions}
        role="pm"
      />

      {/* 1. Summary Cards, Distributions & Cycle Durations */}
      {metricsAvailable ? (
        <div className="space-y-6">
          <MetricCardsGrid summary={metricsAvailable} />
          <StatusDistributionSection summary={metricsAvailable} />
          <CycleDurationSummary summary={metricsAvailable} />
        </div>
      ) : (
        <div
          role="alert"
          className="rounded-xl border border-destructive/20 bg-destructive/10 p-5 flex items-center gap-3 text-sm text-destructive"
        >
          <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
          <p>{t("errors.summaryUnavailable")}</p>
        </div>
      )}

      {/* 2. Operational Trend Section */}
      {trendAvailable ? (
        <TrendChartSection trendPoints={trendAvailable} />
      ) : (
        <div
          role="alert"
          className="rounded-xl border border-destructive/20 bg-destructive/10 p-5 flex items-center gap-3 text-sm text-destructive"
        >
          <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
          <p>{t("errors.trendUnavailable")}</p>
        </div>
      )}

      {/* 3. User Operational Audit Section */}
      <UserOperationalAuditSection
        role="pm"
        result={userAuditResult}
        currentProjectId={selectedProjectId}
        currentUserId={resolvedSearchParams.userId}
        projectName={selectedProject.name}
      />

      {/* Generic PM Navigation Links */}
      <div className="pt-2 flex flex-wrap items-center gap-4 text-xs">
        <Link
          href="/pm/archivo"
          className="inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
        >
          <Archive className="h-4 w-4" aria-hidden="true" />
          <span>{t("viewPmArchive")} &rarr;</span>
        </Link>
        <Link
          href="/pm/incidentes-enlaces"
          className="inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
        >
          <Radio className="h-4 w-4" aria-hidden="true" />
          <span>{t("viewPmLinkIncidents")} &rarr;</span>
        </Link>
      </div>
    </div>
  );
}
