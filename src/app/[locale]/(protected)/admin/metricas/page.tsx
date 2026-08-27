import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session";
import { ROLE_DEFAULT_PATHS } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";
import {
  fetchScopedMetricsProjectFilterOptions,
  fetchScopedOperationsMetrics,
  fetchScopedOperationsMetricTrend,
} from "@/lib/operations-metrics/queries";
import { fetchScopedUserOperationsMetrics } from "@/lib/user-operations-metrics/queries";
import type {
  OperationsMetricsQuery,
  OperationsMetricsSectionResult,
  OperationsMetricsSummaryDto,
  OperationsMetricTrendPointDto,
} from "@/lib/operations-metrics/types";
import type { UserOperationsMetricsSectionResult } from "@/lib/user-operations-metrics/types";
import { normalizeMetricsSearchState } from "@/lib/operations-metrics/date-utils";
import { MetricsTabNavigation } from "@/components/shared/metrics/metrics-tab-navigation";
import { MetricsFilterBar } from "@/components/shared/metrics/metrics-filter-bar";
import { MetricCardsGrid } from "@/components/shared/metrics/metric-cards-grid";
import { StatusDistributionSection } from "@/components/shared/metrics/status-distribution-section";
import { TrendChartSection } from "@/components/shared/metrics/trend-chart-section";
import { CycleDurationSummary } from "@/components/shared/metrics/cycle-duration-summary";
import { UserOperationalAuditSection } from "@/components/shared/metrics/user-operational-audit-section";
import { AlertCircle, FolderKanban, Globe } from "lucide-react";

interface AdminMetricsPageProps {
  searchParams: Promise<{
    from?: string;
    to?: string;
    projectId?: string;
    userId?: string;
    tab?: string;
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
  const activeTab = resolvedSearchParams.tab === "users" ? "users" : "projects";

  const normalized = normalizeMetricsSearchState(resolvedSearchParams);
  const t = await getTranslations("metrics");
  const supabase = createClient(cookieStore);

  const projectOptionsResult =
    await fetchScopedMetricsProjectFilterOptions(supabase);

  // If a project ID was requested but project-options validation is unavailable, fail-closed
  const projectValidationFailed =
    Boolean(normalized.projectId) &&
    projectOptionsResult.status === "unavailable";

  const projectOptions =
    projectOptionsResult.status === "available"
      ? projectOptionsResult.data
      : undefined;

  const matchedProject =
    projectOptionsResult.status === "available" && normalized.projectId
      ? projectOptionsResult.data.find((p) => p.id === normalized.projectId)
      : undefined;

  const validatedProjectId = matchedProject ? matchedProject.id : undefined;

  const metricsQuery: OperationsMetricsQuery = {
    from: normalized.from,
    to: normalized.to,
    projectId: validatedProjectId,
  };

  const unavailable = {
    status: "unavailable" as const,
    code: "UNAVAILABLE" as const,
  };

  // Branch-local active-tab data fetching
  let metricsResult: OperationsMetricsSectionResult<OperationsMetricsSummaryDto> =
    unavailable;
  let trendResult: OperationsMetricsSectionResult<
    readonly OperationsMetricTrendPointDto[]
  > = unavailable;
  let userAuditResult: UserOperationsMetricsSectionResult = unavailable;

  if (activeTab === "projects") {
    if (!projectValidationFailed) {
      const [metricsSettled, trendSettled] = await Promise.allSettled([
        fetchScopedOperationsMetrics(supabase, metricsQuery, session.role),
        fetchScopedOperationsMetricTrend(supabase, metricsQuery, session.role),
      ]);
      metricsResult =
        metricsSettled.status === "fulfilled"
          ? metricsSettled.value
          : unavailable;
      trendResult =
        trendSettled.status === "fulfilled" ? trendSettled.value : unavailable;
    }
  } else {
    if (!projectValidationFailed) {
      const [userAuditSettled] = await Promise.allSettled([
        fetchScopedUserOperationsMetrics(
          supabase,
          { ...metricsQuery, userId: undefined },
          session.role,
        ),
      ]);
      userAuditResult =
        userAuditSettled.status === "fulfilled"
          ? userAuditSettled.value
          : unavailable;
    }
  }

  const metricsAvailable =
    metricsResult.status === "available" ? metricsResult.data : null;
  const trendAvailable =
    trendResult.status === "available" ? trendResult.data : null;

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

          {/* Scope Badge (hidden on failed project validation to prevent false global scope display) */}
          {projectValidationFailed ? null : validatedProjectId &&
            matchedProject ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              <FolderKanban className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{matchedProject.name}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              <Globe className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t("globalScopeBadge")}</span>
            </div>
          )}
        </div>
      </header>

      {/* Tabs Navigation */}
      <MetricsTabNavigation activeTab={activeTab} />

      {/* Tab Panels: Only mount active heavy panel */}
      {activeTab === "projects" ? (
        <div className="space-y-6">
          <MetricsFilterBar
            currentFrom={metricsQuery.from}
            currentTo={metricsQuery.to}
            currentProjectId={metricsQuery.projectId}
            projects={projectOptions}
            showProjectSelector={true}
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
        </div>
      ) : (
        <div className="space-y-6">
          <MetricsFilterBar
            currentFrom={metricsQuery.from}
            currentTo={metricsQuery.to}
            showProjectSelector={false}
          />

          <UserOperationalAuditSection
            result={userAuditResult}
            currentProjectId={metricsQuery.projectId}
            currentUserId={resolvedSearchParams.userId}
            projects={projectOptions}
          />
        </div>
      )}
    </div>
  );
}
