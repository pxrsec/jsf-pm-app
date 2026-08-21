import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session";
import { ROLE_DEFAULT_PATHS } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";
import { getOperatorAgenda } from "@/lib/operator/queries";
import { OperatorAgendaList } from "./_components/operator-agenda-list";
import { OperatorAgendaEmptyState } from "./_components/operator-agenda-empty-state";
import { Link } from "@/i18n/routing";
import { FolderKanban } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OperatorAgendaPageProps {
  params: Promise<{ locale: string }>;
}

export default async function OperatorAgendaPage({
  params,
}: OperatorAgendaPageProps) {
  const { locale } = await params;
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "operator") {
    redirect(ROLE_DEFAULT_PATHS[session.role] ?? "/iniciar-sesion");
  }

  const supabase = createClient(cookieStore);
  const items = await getOperatorAgenda(supabase);
  const t = await getTranslations("projects.operatorAgenda");

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>

        <Link
          href="/operador/proyectos"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "inline-flex items-center gap-2 shrink-0",
          )}
        >
          <FolderKanban className="size-4" aria-hidden="true" />
          <span>{t("browseProjectsLink")}</span>
        </Link>
      </div>

      {/* Main Content: Agenda List or Empty State */}
      {items.length === 0 ? (
        <OperatorAgendaEmptyState
          translations={{
            title: t("empty.title"),
            description: t("empty.description"),
            browseProjectsAction: t("empty.browseProjectsAction"),
          }}
        />
      ) : (
        <OperatorAgendaList items={items} locale={locale} />
      )}
    </div>
  );
}
