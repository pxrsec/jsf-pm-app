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
  listEligibleClientMembers,
  listProjectTasks,
} from "@/lib/projects/queries";
import { listProjectDeliverables } from "@/lib/deliverables/queries";
import { listActiveClients } from "@/lib/clients/queries";
import {
  fetchCalendarFeed,
  fetchCalendarMilestoneTargets,
} from "@/lib/calendar/queries";
import { normalizeCalendarRange } from "@/lib/calendar/date-utils";
import type {
  CalendarEventDto,
  CalendarMilestoneTargetDto,
  CalendarRangeState,
} from "@/lib/calendar/types";
import { ProjectWorkspaceShell } from "@/components/shared/projects/project-workspace/project-workspace-shell";

interface AdminProjectDetailPageProps {
  params: Promise<{ id: string; locale: string }>;
  searchParams: Promise<{
    tab?: string;
    calendarView?: string;
    calendarFrom?: string;
    calendarTo?: string;
  }>;
}

export default async function AdminProjectDetailPage({
  params,
  searchParams,
}: AdminProjectDetailPageProps) {
  const { id, locale } = await params;
  const resolvedSearchParams = await searchParams;
  const { tab } = resolvedSearchParams;

  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "admin") {
    redirect(ROLE_DEFAULT_PATHS[session.role] ?? "/iniciar-sesion");
  }

  const supabase = createClient(cookieStore);
  const project = await getProjectDetail(supabase, id);

  if (!project) {
    notFound();
  }

  const isCalendarTab = tab === "calendar";
  const calendarRange: CalendarRangeState | undefined = isCalendarTab
    ? normalizeCalendarRange(resolvedSearchParams, undefined, {
        keyPrefix: "calendar",
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
  ] = await Promise.all([
    listActiveClients(supabase),
    getCompletionCycles(supabase, id),
    listEligiblePmUsers(supabase),
    listEligibleOperators(supabase),
    listEligibleClientMembers(supabase, project.client_id),
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
      ? fetchCalendarMilestoneTargets(supabase)
      : Promise.resolve<CalendarMilestoneTargetDto[] | undefined>(undefined),
  ]);

  return (
    <ProjectWorkspaceShell
      project={project}
      clients={clients}
      cycles={cycles}
      eligiblePms={eligiblePms}
      eligibleOperators={eligibleOperators}
      eligibleClients={eligibleClients}
      effectiveCapacity="admin"
      actorRole="admin"
      currentUserId={session.user.id}
      initialTasks={initialTasks}
      initialDeliverables={initialDeliverables}
      initialCalendarEvents={initialCalendarEvents}
      milestoneTargets={milestoneTargets}
      calendarRange={calendarRange}
      locale={locale}
      initialTab={tab}
    />
  );
}
