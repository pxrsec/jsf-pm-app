import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session";
import { ROLE_DEFAULT_PATHS } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";
import { fetchScopedOperationsMetrics } from "@/lib/operations-metrics/queries";
import {
  fetchAdminAuditPage,
  fetchAdminUserInvitationStatePage,
} from "@/lib/admin-operations/queries";
import { getAdminCapabilityDiagnostics } from "@/lib/admin-operations/diagnostics";
import {
  getDefaultMetricsRange,
  isValidMetricsRange,
} from "@/lib/operations-metrics/date-utils";
import type { AdminAuditQuery } from "@/lib/admin-operations/types";
import { OperationalAttentionSection } from "./_components/operational-attention-section";
import { DiagnosticsCard } from "./_components/diagnostics-card";
import { AuditHistorySection } from "./_components/audit-history-section";
import { UserInvitationStateSection } from "./_components/user-invitation-state-section";
import { AlertCircle, ShieldCheck } from "lucide-react";

interface AdminOperationsPageProps {
  searchParams: Promise<{
    auditFrom?: string;
    auditTo?: string;
  }>;
}

export default async function AdminOperationsPage({
  searchParams,
}: AdminOperationsPageProps) {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "admin") {
    redirect(ROLE_DEFAULT_PATHS[session.role] ?? "/iniciar-sesion");
  }

  const t = await getTranslations("adminOperations");
  const supabase = createClient(cookieStore);

  // Normalize audit range
  const resolvedSearchParams = await searchParams;
  const defaultRange = getDefaultMetricsRange();
  let auditFrom = defaultRange.from;
  let auditTo = defaultRange.to;

  if (
    resolvedSearchParams.auditFrom &&
    resolvedSearchParams.auditTo &&
    isValidMetricsRange(
      resolvedSearchParams.auditFrom,
      resolvedSearchParams.auditTo,
    )
  ) {
    auditFrom = resolvedSearchParams.auditFrom;
    auditTo = resolvedSearchParams.auditTo;
  }

  const auditQuery: AdminAuditQuery = { from: auditFrom, to: auditTo };
  const attentionQuery = { from: defaultRange.from, to: defaultRange.to };

  // Diagnostics is purely server-derived
  const diagnostics = getAdminCapabilityDiagnostics();

  // Fetch sections with independent failure isolation
  const [metricsSettled, auditSettled, userStateSettled] =
    await Promise.allSettled([
      fetchScopedOperationsMetrics(supabase, attentionQuery, "admin"),
      fetchAdminAuditPage(supabase, auditQuery),
      fetchAdminUserInvitationStatePage(supabase),
    ]);

  const metricsAvailable =
    metricsSettled.status === "fulfilled" &&
    metricsSettled.value.status === "available"
      ? metricsSettled.value.data
      : null;

  const auditAvailable =
    auditSettled.status === "fulfilled" &&
    auditSettled.value.status === "available"
      ? auditSettled.value.data
      : null;

  const userStateAvailable =
    userStateSettled.status === "fulfilled" &&
    userStateSettled.value.status === "available"
      ? userStateSettled.value.data
      : null;

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <header className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {t("title")}
            </h1>
            <p className="text-sm text-muted-foreground">{t("description")}</p>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t("readOnlyConsoleBadge")}</span>
          </div>
        </div>
      </header>

      {/* 1. Operational Attention & Destinations */}
      {metricsAvailable ? (
        <OperationalAttentionSection summary={metricsAvailable} />
      ) : (
        <div
          role="alert"
          className="rounded-xl border border-destructive/20 bg-destructive/10 p-5 flex items-center gap-3 text-sm text-destructive"
        >
          <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
          <p>{t("errors.attentionUnavailable")}</p>
        </div>
      )}

      {/* 2. Development Capability Posture (Diagnostics) */}
      <DiagnosticsCard diagnostics={diagnostics} />

      {/* 3. Recent Audit History */}
      {auditAvailable ? (
        <AuditHistorySection
          initialPage={auditAvailable}
          currentQuery={auditQuery}
        />
      ) : (
        <div
          role="alert"
          className="rounded-xl border border-destructive/20 bg-destructive/10 p-5 flex items-center gap-3 text-sm text-destructive"
        >
          <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
          <p>{t("errors.auditUnavailable")}</p>
        </div>
      )}

      {/* 4. User and Invitation Operational State */}
      {userStateAvailable ? (
        <UserInvitationStateSection initialPage={userStateAvailable} />
      ) : (
        <div
          role="alert"
          className="rounded-xl border border-destructive/20 bg-destructive/10 p-5 flex items-center gap-3 text-sm text-destructive"
        >
          <AlertCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
          <p>{t("errors.userStateUnavailable")}</p>
        </div>
      )}
    </div>
  );
}
