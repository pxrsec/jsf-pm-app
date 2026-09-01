import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { ROLE_DEFAULT_PATHS } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";
import {
  listClientContactsForAdministration,
  listClientOrganizationsForAdministration,
} from "@/lib/clients/queries";
import { listClientManagementProjects } from "@/lib/projects/queries";
import { fetchOrdinaryInvitationPage } from "@/lib/invitations/queries";
import { PmClientesPageContent } from "./_components/pm-clientes-page-content";

export const metadata = {
  title: "Administración de Clientes | JSF PM",
};

export default async function PmClientesPage() {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "pm") {
    redirect(ROLE_DEFAULT_PATHS[session.role]);
  }

  const supabase = createClient(cookieStore);

  const [
    contactsResult,
    organizationsResult,
    projectsResult,
    invitationsResult,
  ] = await Promise.all([
    listClientContactsForAdministration(supabase),
    listClientOrganizationsForAdministration(supabase),
    listClientManagementProjects(supabase),
    fetchOrdinaryInvitationPage(supabase, null, 20),
  ]);

  return (
    <PmClientesPageContent
      contactsResult={contactsResult}
      organizationsResult={organizationsResult}
      projectsResult={projectsResult}
      invitationsResult={invitationsResult}
    />
  );
}
