import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { ROLE_DEFAULT_PATHS } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";
import {
  fetchUserAccessDirectory,
  fetchStaleAccessReminderCandidates,
  fetchBugReports,
} from "@/lib/account-access/queries";
import { ManagerAccessConsole } from "@/components/shared/account-access/manager-access-console";
import type { DateTimePresentationContext } from "@/lib/account-access/types";

export default async function PmAccesoPage() {
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

  if (session.role !== "pm") {
    redirect(
      `${prefix}${ROLE_DEFAULT_PATHS[session.role] ?? "/iniciar-sesion"}`,
    );
  }

  const supabase = createClient(cookieStore);

  const presentation: DateTimePresentationContext = {
    locale: isEnglish ? "en-US" : "es-MX",
    timeZone: session.profile.timezone,
  };

  const [directoryResult, staleResult, bugReportsResult] = await Promise.all([
    fetchUserAccessDirectory(supabase),
    fetchStaleAccessReminderCandidates(supabase),
    fetchBugReports(supabase),
  ]);

  return (
    <ManagerAccessConsole
      initialDirectory={directoryResult}
      initialStale={staleResult}
      initialBugReports={bugReportsResult}
      presentation={presentation}
    />
  );
}
