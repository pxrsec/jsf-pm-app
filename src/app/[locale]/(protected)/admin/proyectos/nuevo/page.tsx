import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { ROLE_DEFAULT_PATHS } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";
import { listActiveClients } from "@/lib/clients/queries";
import { listEligiblePmUsers } from "@/lib/projects/queries";
import { AdminCreateForm } from "./_components/admin-create-form";

export default async function AdminNewProjectPage() {
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "admin") {
    redirect(ROLE_DEFAULT_PATHS[session.role] ?? "/iniciar-sesion");
  }

  const supabase = createClient(cookieStore);
  const [clients, eligiblePms] = await Promise.all([
    listActiveClients(supabase),
    listEligiblePmUsers(supabase),
  ]);

  return <AdminCreateForm clients={clients} eligiblePms={eligiblePms} />;
}
