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
} from "@/lib/projects/queries";
import { listActiveClients } from "@/lib/clients/queries";
import { ProjectWorkspaceShell } from "@/components/shared/projects/project-workspace/project-workspace-shell";

interface AdminProjectDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function AdminProjectDetailPage({
  params,
  searchParams,
}: AdminProjectDetailPageProps) {
  const { id } = await params;
  const { tab } = await searchParams;

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

  const [clients, cycles, eligiblePms, eligibleOperators, eligibleClients] =
    await Promise.all([
      listActiveClients(supabase),
      getCompletionCycles(supabase, id),
      listEligiblePmUsers(supabase),
      listEligibleOperators(supabase),
      listEligibleClientMembers(supabase, project.client_id),
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
      initialTab={tab}
    />
  );
}
