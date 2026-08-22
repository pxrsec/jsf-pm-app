import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session";
import { ROLE_DEFAULT_PATHS } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";
import { getClientRequestQueue } from "@/lib/client/queries";
import { ClientRequestList } from "./_components/client-request-list";

interface ClientRequestsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function ClientRequestsPage({
  params,
}: ClientRequestsPageProps) {
  const { locale } = await params;
  const prefix = locale === "en" ? "/en" : "";
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "client") {
    redirect(
      `${prefix}${ROLE_DEFAULT_PATHS[session.role] ?? "/iniciar-sesion"}`,
    );
  }

  const supabase = createClient(cookieStore);
  const requests = await getClientRequestQueue(supabase);
  const t = await getTranslations("projects.clientRequests");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <ClientRequestList requests={requests} />
    </div>
  );
}
