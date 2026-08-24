import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session";
import { ROLE_DEFAULT_PATHS } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";
import {
  fetchFinalizedArchivePage,
  fetchArchiveProjectFilterOptionsForAdmin,
} from "@/lib/archive/queries";
import { normalizeArchiveSearchState } from "@/lib/archive/date-utils";
import { ArchiveFilterBar } from "@/components/shared/archive/archive-filter-bar";
import { ArchiveListView } from "@/components/shared/archive/archive-list-view";

interface AdminArchivePageProps {
  searchParams: Promise<{
    from?: string;
    to?: string;
    status?: string;
    projectId?: string;
  }>;
}

export default async function AdminArchivePage({
  searchParams,
}: AdminArchivePageProps) {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "admin") {
    redirect(ROLE_DEFAULT_PATHS[session.role] ?? "/iniciar-sesion");
  }

  const resolvedSearchParams = await searchParams;
  const currentQuery = normalizeArchiveSearchState(resolvedSearchParams);

  const t = await getTranslations("archive");
  const supabase = createClient(cookieStore);

  const [initialPage, projects] = await Promise.all([
    fetchFinalizedArchivePage(supabase, currentQuery, null, "admin"),
    fetchArchiveProjectFilterOptionsForAdmin(supabase),
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

      <ArchiveFilterBar
        currentStatus={currentQuery.status}
        currentFrom={currentQuery.from}
        currentTo={currentQuery.to}
        currentProjectId={currentQuery.projectId}
        projects={projects}
      />

      <ArchiveListView
        initialPage={initialPage}
        currentQuery={currentQuery}
        isFiltered={isFiltered}
      />
    </div>
  );
}
