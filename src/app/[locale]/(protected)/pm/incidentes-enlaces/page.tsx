import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session";
import { ROLE_DEFAULT_PATHS } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";
import {
  fetchLinkIncidentsPage,
  fetchArchiveProjectFilterOptionsForPm,
} from "@/lib/archive/queries";
import { normalizeIncidentSearchState } from "@/lib/archive/date-utils";
import { IncidentFilterBar } from "@/components/shared/incidents/incident-filter-bar";
import { IncidentListView } from "@/components/shared/incidents/incident-list-view";

interface PmIncidentsPageProps {
  searchParams: Promise<{
    from?: string;
    to?: string;
    status?: string;
    projectId?: string;
  }>;
}

export default async function PmIncidentsPage({
  searchParams,
}: PmIncidentsPageProps) {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "pm") {
    redirect(ROLE_DEFAULT_PATHS[session.role] ?? "/iniciar-sesion");
  }

  const resolvedSearchParams = await searchParams;
  const currentQuery = normalizeIncidentSearchState(resolvedSearchParams);

  const t = await getTranslations("linkIncidents");
  const supabase = createClient(cookieStore);

  const [initialPage, projects] = await Promise.all([
    fetchLinkIncidentsPage(supabase, currentQuery, null, "pm"),
    fetchArchiveProjectFilterOptionsForPm(supabase, session.user.id),
  ]);

  const isFiltered = Boolean(
    currentQuery.status ||
    currentQuery.projectId ||
    resolvedSearchParams.from ||
    resolvedSearchParams.to,
  );

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </header>

      <IncidentFilterBar
        currentStatus={currentQuery.status}
        currentFrom={currentQuery.from}
        currentTo={currentQuery.to}
        currentProjectId={currentQuery.projectId}
        projects={projects}
      />

      <IncidentListView
        initialPage={initialPage}
        currentQuery={currentQuery}
        isFiltered={isFiltered}
      />
    </div>
  );
}
