import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session";
import { ROLE_DEFAULT_PATHS } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";
import { fetchArchiveProjectFilterOptionsForAdmin } from "@/lib/archive/queries";
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
import { AlertCircle, Globe } from "lucide-react";

interface AdminMetricsPageProps {
  searchParams: Promise<{
    from?: string;
    to?: string;
    projectId?: string;
    userId?: string;
  }>;
}

export default async function AdminMetricsPage({
  searchParams,
}: AdminMetricsPageProps) {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "admin") {
    redirect(ROLE_DEFAULT_PATHS[session.role] ?? "/iniciar-sesion");
  }

  const resolvedSearchParams = await searchParams;
  const currentQuery = normalizeMetricsSearchState(
    resolvedSearchParams,
    "admin",
  );

  const t = await getTranslations("metrics");
  const supabase = createClient(cookieStore);

  // Fetch project options for Admin scope control
  const projectOptions =
    await fetchArchiveProjectFilterOptionsForAdmin(supabase);
  const matchedProject = projectOptions?.find(
    (p) => p.id === resolvedSearchParams.projectId,
  );
  const validatedProjectId = matchedProject ? matchedProject.id : undefined;

  const userAuditRpcQuery: UserOperationsMetricsQuery = {
    from: currentQuery.from,
    to: currentQuery.to,
    projectId: validatedProjectId,
    userId: undefined, // Always query full user dataset for dashboard
  };

  // Independent section-level failure isolation
  const [metricsSettled, trendSettled, userAuditSettled] =
    await Promise.allSettled([
      fetchScopedOperationsMetrics(supabase, currentQuery, "admin"),
      fetchScopedOperationsMetricTrend(supabase, currentQuery, "admin"),
      fetchScopedUserOperationsMetrics(supabase, userAuditRpcQuery, "admin"),
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
              {t("adminTitle")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("adminDescription")}
            </p>
          </div>

          {/* Scope Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
            <Globe className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t("globalScopeBadge")}</span>
          </div>
        </div>
      </header>

      {/* Filter Bar */}
      <MetricsFilterBar
        currentFrom={currentQuery.from}
        currentTo={currentQuery.to}
        role="admin"
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
        role="admin"
        result={userAuditResult}
        currentProjectId={validatedProjectId}
        currentUserId={resolvedSearchParams.userId}
        projects={projectOptions ?? []}
      />
    </div>
  );
}
