import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { ROLE_DEFAULT_PATHS } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";
import {
  getProjectDetail,
  getCompletionCycles,
  listEligiblePmUsers,
  listEligibleOperators,
  listEligibleClientMembersForProject,
  listProjectTasks,
} from "@/lib/projects/queries";
import { listProjectDeliverables } from "@/lib/deliverables/queries";
import {
  listActiveClients,
  listDirectContactsForWorkspace,
  listClientOrganizationsForWorkspace,
  listProjectDirectContactAssociations,
} from "@/lib/clients/queries";
import type {
  AvailableResult,
  DirectContactWorkspaceDto,
  ClientOrganizationWorkspaceDto,
} from "@/lib/clients/types";
import {
  fetchCalendarFeed,
  fetchMilestoneManagementTargets,
  fetchProjectMilestoneSummaries,
  fetchTaskMilestoneOptions,
} from "@/lib/calendar/queries";
import { normalizeCalendarRange } from "@/lib/calendar/date-utils";
import type {
  CalendarEventDto,
  MilestoneManagementTargetDto,
  CalendarRangeState,
} from "@/lib/calendar/types";
import { fetchFinalizedArchivePage } from "@/lib/archive/queries";
import { normalizeArchiveSearchState } from "@/lib/archive/date-utils";
import type {
  FinalizedArchivePage,
  FinalizedArchiveQuery,
} from "@/lib/archive/types";
import { ProjectWorkspaceShell } from "@/components/shared/projects/project-workspace/project-workspace-shell";

interface PmProjectDetailPageProps {
  params: Promise<{ id: string; locale: string }>;
  searchParams: Promise<{
    tab?: string;
    calendarView?: string;
    calendarFrom?: string;
    calendarTo?: string;
    archiveFrom?: string;
    archiveTo?: string;
    archiveStatus?: string;
  }>;
}

export default async function PmProjectDetailPage({
  params,
  searchParams,
}: PmProjectDetailPageProps) {
  const { id, locale } = await params;
  const resolvedSearchParams = await searchParams;
  const { tab } = resolvedSearchParams;

  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "pm") {
    redirect(ROLE_DEFAULT_PATHS[session.role] ?? "/iniciar-sesion");
  }

  const supabase = createClient(cookieStore);
  const project = await getProjectDetail(supabase, id);

  if (!project) {
    notFound();
  }

  // Active PM application roles may open every workspace; membership is metadata.
  const userMembership = project.members.find(
    (m) => m.user_id === session.user.id,
  );

  const effectiveCapacity =
    userMembership?.member_type === "pm_watcher" ? "pm_watcher" : "pm_lead";

  const canManageClientIdentity =
    project.project_type === "client" &&
    project.deleted_at === null &&
    project.archived_at === null &&
    project.status !== "completed" &&
    project.status !== "cancelled";

  const isCalendarTab = tab === "calendar";
  const calendarRange: CalendarRangeState | undefined = isCalendarTab
    ? normalizeCalendarRange(resolvedSearchParams, undefined, {
        keyPrefix: "calendar",
      })
    : undefined;

  const isArchiveTab = tab === "archive";
  const archiveQuery: FinalizedArchiveQuery | undefined = isArchiveTab
    ? normalizeArchiveSearchState(resolvedSearchParams, {
        keyPrefix: "archive",
        fixedProjectId: id,
      })
    : undefined;

  const [
    clients,
    cycles,
    eligiblePms,
    eligibleOperators,
    eligibleClients,
    initialTasks,
    initialDeliverables,
    initialCalendarEvents,
    milestoneTargets,
    milestoneSummaries,
    milestoneOptions,
    initialArchivePage,
    directContacts,
    organizations,
    associatedContactIds,
  ] = await Promise.all([
    listActiveClients(supabase),
    getCompletionCycles(supabase, id),
    listEligiblePmUsers(supabase),
    listEligibleOperators(supabase),
    listEligibleClientMembersForProject(supabase, {
      id: project.id,
      client_id: project.client_id,
    }),
    listProjectTasks(supabase, id),
    listProjectDeliverables(supabase, id),
    isCalendarTab && calendarRange
      ? fetchCalendarFeed(supabase, {
          from: calendarRange.from,
          to: calendarRange.to,
          projectId: id,
        })
      : Promise.resolve<CalendarEventDto[] | undefined>(undefined),
    isCalendarTab
      ? fetchMilestoneManagementTargets(supabase)
      : Promise.resolve<MilestoneManagementTargetDto[] | undefined>(undefined),
    fetchProjectMilestoneSummaries(supabase, id),
    fetchTaskMilestoneOptions(supabase, id),
    isArchiveTab && archiveQuery
      ? fetchFinalizedArchivePage(supabase, archiveQuery, null, "pm")
      : Promise.resolve<FinalizedArchivePage | undefined>(undefined),
    canManageClientIdentity
      ? listDirectContactsForWorkspace(supabase)
      : Promise.resolve<
          AvailableResult<DirectContactWorkspaceDto[]> | undefined
        >(undefined),
    canManageClientIdentity
      ? listClientOrganizationsForWorkspace(supabase)
      : Promise.resolve<
          AvailableResult<ClientOrganizationWorkspaceDto[]> | undefined
        >(undefined),
    canManageClientIdentity
      ? listProjectDirectContactAssociations(supabase, id)
      : Promise.resolve<AvailableResult<string[]> | undefined>(undefined),
  ]);

  return (
    <ProjectWorkspaceShell
      project={project}
      clients={clients}
      cycles={cycles}
      eligiblePms={eligiblePms}
      eligibleOperators={eligibleOperators}
      eligibleClients={eligibleClients}
      effectiveCapacity={effectiveCapacity}
      actorRole="pm"
      directContacts={directContacts}
      organizations={organizations}
      associatedContactIds={associatedContactIds}
      currentUserId={session.user.id}
      initialTasks={initialTasks}
      initialDeliverables={initialDeliverables}
      initialCalendarEvents={initialCalendarEvents}
      milestoneTargets={milestoneTargets}
      calendarRange={calendarRange}
      initialArchivePage={initialArchivePage}
      milestoneSummaries={milestoneSummaries}
      milestoneOptions={milestoneOptions}
      archiveQuery={archiveQuery}
      locale={locale}
      initialTab={tab}
    />
  );
}
