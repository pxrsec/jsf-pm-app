import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { ROLE_DEFAULT_PATHS } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";
import { listProjectsForAdmin } from "@/lib/projects/queries";
import { ProjectDirectoryView } from "@/components/shared/projects/project-directory/project-directory-view";

export default async function AdminProjectsPage() {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "admin") {
    redirect(ROLE_DEFAULT_PATHS[session.role] ?? "/iniciar-sesion");
  }

  const supabase = createClient(cookieStore);
  const projects = await listProjectsForAdmin(supabase);

  return <ProjectDirectoryView initialProjects={projects} actorRole="admin" />;
}
