import { cookies, headers } from "next/headers";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fetchOwnAccountSettings } from "@/lib/account-access/queries";
import { AccountView } from "@/components/shared/account-access/account-view";
import type { DateTimePresentationContext } from "@/lib/account-access/types";

export default async function CuentaPage() {
  const cookieStore = await cookies();
  const headersList = await headers().catch(() => null);
  const rawPathname = headersList?.get
    ? headersList.get("x-pathname") ||
      headersList.get("x-invoke-path") ||
      headersList.get("x-url") ||
      ""
    : "";
  const isEnglish = rawPathname.startsWith("/en/") || rawPathname === "/en";

  const session = await requireSession(cookieStore);
  const supabase = createClient(cookieStore);

  const presentation: DateTimePresentationContext = {
    locale: isEnglish ? "en-US" : "es-MX",
    timeZone: session.profile.timezone,
  };

  const initialSettings = await fetchOwnAccountSettings(supabase);

  return (
    <AccountView
      initialSettings={initialSettings}
      presentation={presentation}
    />
  );
}
