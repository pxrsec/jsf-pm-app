import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session";
import { ROLE_DEFAULT_PATHS } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";
import { getOperatorOwnWorkProjects } from "@/lib/operator/queries";
import { OperatorProjectList } from "./_components/operator-project-list";
import { Link } from "@/i18n/routing";
import { ArrowLeft, FolderKanban } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OperatorProjectsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function OperatorProjectsPage({
  params,
}: OperatorProjectsPageProps) {
  const { locale } = await params;
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "operator") {
    redirect(ROLE_DEFAULT_PATHS[session.role] ?? "/iniciar-sesion");
  }

  const supabase = createClient(cookieStore);
  const projects = await getOperatorOwnWorkProjects(supabase);
  const t = await getTranslations("projects.operatorProjects");

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Back button and page Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2">
            <Link
              href="/operador/agenda"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              <span>{t("backToAgenda")}</span>
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {t("title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      {/* Main Content: Projects List or Empty State */}
      {projects.length === 0 ? (
        <div
          data-testid="operator-projects-empty"
          className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 p-8 text-center sm:p-12"
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FolderKanban className="size-6" aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">
            {t("empty.title")}
          </h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            {t("empty.description")}
          </p>
          <div className="mt-6">
            <Link
              href="/operador/agenda"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "inline-flex items-center gap-2",
              )}
            >
              {t("empty.returnToAgenda")}
            </Link>
          </div>
        </div>
      ) : (
        <OperatorProjectList projects={projects} locale={locale} />
      )}
    </div>
  );
}
