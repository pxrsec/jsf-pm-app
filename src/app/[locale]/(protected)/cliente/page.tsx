import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { ROLE_DEFAULT_PATHS } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";
import { getClientShellData } from "@/lib/shell-data/shell-queries";
import { ClientShell } from "./_components/client-shell";

export default async function ClientPage() {
  const cookieStore = await cookies();
  const headersList = await headers().catch(() => null);
  const rawPathname = headersList?.get
    ? headersList.get("x-pathname") ||
      headersList.get("x-invoke-path") ||
      headersList.get("x-url") ||
      ""
    : "";
  const isEnglish = rawPathname.startsWith("/en/") || rawPathname === "/en";
  const prefix = isEnglish ? "/en" : "";

  const session = await requireSession(cookieStore);

  if (session.role !== "client") {
    redirect(
      `${prefix}${ROLE_DEFAULT_PATHS[session.role] ?? "/iniciar-sesion"}`,
    );
  }

  const supabase = createClient(cookieStore);
  const data = await getClientShellData(supabase);

  return <ClientShell profile={session.profile} data={data} />;
}
