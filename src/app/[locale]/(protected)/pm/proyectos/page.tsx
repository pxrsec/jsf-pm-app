import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { ROLE_DEFAULT_PATHS } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";
import { listProjectsForPm } from "@/lib/projects/queries";
import { ProjectDirectoryView } from "@/components/shared/projects/project-directory/project-directory-view";

export default async function PmProjectsPage() {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "pm") {
    redirect(ROLE_DEFAULT_PATHS[session.role] ?? "/iniciar-sesion");
  }

  const supabase = createClient(cookieStore);
  const projects = await listProjectsForPm(supabase);

  return <ProjectDirectoryView initialProjects={projects} actorRole="pm" />;
}
