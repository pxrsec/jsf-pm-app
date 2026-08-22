import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { requireSession } from "@/lib/auth/session";
import { ROLE_DEFAULT_PATHS } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";
import { getClientRequestDetail } from "@/lib/client/queries";
import { ClientRequestDetailView } from "../_components/client-request-detail";
import { AlertCircle, ArrowLeft } from "lucide-react";

interface ClientRequestDetailPageProps {
  params: Promise<{ locale: string; "task-id": string }>;
}

export default async function ClientRequestDetailPage({
  params,
}: ClientRequestDetailPageProps) {
  const { locale, "task-id": taskId } = await params;
  const prefix = locale === "en" ? "/en" : "";
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "client") {
    redirect(
      `${prefix}${ROLE_DEFAULT_PATHS[session.role] ?? "/iniciar-sesion"}`,
    );
  }

  const supabase = createClient(cookieStore);
  const request = await getClientRequestDetail(supabase, taskId);
  const t = await getTranslations("projects.clientRequests.absence");

  if (!request) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="rounded-xl border border-dashed border-border p-12 text-center bg-card/50 max-w-lg mx-auto">
          <AlertCircle className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
          <h1 className="text-lg font-semibold text-foreground">
            {t("title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("description")}
          </p>
          <div className="mt-6">
            <Link
              href="/cliente/tareas"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>{t("returnAction")}</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <ClientRequestDetailView request={request} />
    </div>
  );
}
