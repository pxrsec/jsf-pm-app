import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session";
import { ROLE_DEFAULT_PATHS } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";
import { getOperatorOwnWorkProject } from "@/lib/operator/queries";
import { OperatorProjectTaskList } from "../_components/operator-project-task-list";
import { Link } from "@/i18n/routing";
import { FolderX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OperatorProjectDetailPageProps {
  params: Promise<{ "project-id": string; locale: string }>;
}

export default async function OperatorProjectDetailPage({
  params,
}: OperatorProjectDetailPageProps) {
  const resolvedParams = await params;
  const projectId = resolvedParams["project-id"];
  const locale = resolvedParams.locale;

  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "operator") {
    redirect(ROLE_DEFAULT_PATHS[session.role] ?? "/iniciar-sesion");
  }

  const supabase = createClient(cookieStore);
  const projectDetail = await getOperatorOwnWorkProject(supabase, projectId);
  const t = await getTranslations("projects.operatorProjects");

  if (!projectDetail) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div
          data-testid="operator-project-absence"
          className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 p-8 text-center sm:p-12"
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <FolderX className="size-6" aria-hidden="true" />
          </div>

          <h2 className="mt-4 text-lg font-semibold text-foreground">
            {t("absence.title")}
          </h2>

          <p className="mt-1 max-w-md text-xs text-muted-foreground">
            {t("absence.description")}
          </p>

          <div className="mt-6">
            <Link
              href="/operador/proyectos"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "inline-flex items-center gap-2",
              )}
            >
              {t("absence.returnAction")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <OperatorProjectTaskList projectDetail={projectDetail} locale={locale} />
    </div>
  );
}
