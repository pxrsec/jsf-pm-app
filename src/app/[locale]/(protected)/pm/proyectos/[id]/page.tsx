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
import { listActiveClients } from "@/lib/clients/queries";
import { ProjectWorkspaceShell } from "@/components/shared/projects/project-workspace/project-workspace-shell";

interface PmProjectDetailPageProps {
  params: Promise<{ id: string; locale: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function PmProjectDetailPage({
  params,
  searchParams,
}: PmProjectDetailPageProps) {
  const { id, locale } = await params;
  const { tab } = await searchParams;

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

  // Determine current PM's capacity in this project
  const userMembership = project.members.find(
    (m) => m.user_id === session.user.id,
  );

  if (!userMembership) {
    notFound();
  }

  const effectiveCapacity =
    userMembership.member_type === "pm_watcher" ? "pm_watcher" : "pm_lead";

  const [
    clients,
    cycles,
    eligiblePms,
    eligibleOperators,
    eligibleClients,
    initialTasks,
  ] = await Promise.all([
    listActiveClients(supabase),
    getCompletionCycles(supabase, id),
    listEligiblePmUsers(supabase),
    listEligibleOperators(supabase),
    listEligibleClientMembers(supabase, project.client_id),
    listProjectTasks(supabase, id),
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
      initialTasks={initialTasks}
      locale={locale}
      initialTab={tab}
    />
  );
}
