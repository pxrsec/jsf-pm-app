import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSession } from "@/lib/auth/session";
import { ROLE_DEFAULT_PATHS } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";
import { getOperatorTaskDetail } from "@/lib/operator/queries";
import { OperatorTaskDetailView } from "./_components/operator-task-detail";
import { Link } from "@/i18n/routing";
import { FileQuestion } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface OperatorTaskDetailPageProps {
  params: Promise<{ "task-id": string; locale: string }>;
}

export default async function OperatorTaskDetailPage({
  params,
}: OperatorTaskDetailPageProps) {
  const resolvedParams = await params;
  const taskId = resolvedParams["task-id"];
  const locale = resolvedParams.locale;

  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "operator") {
    redirect(ROLE_DEFAULT_PATHS[session.role] ?? "/iniciar-sesion");
  }

  const supabase = createClient(cookieStore);
  const task = await getOperatorTaskDetail(supabase, taskId);
  const t = await getTranslations("projects.operatorTask");

  if (!task) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div
          data-testid="operator-task-absence"
          className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 p-8 text-center sm:p-12"
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <FileQuestion className="size-6" aria-hidden="true" />
          </div>

          <h2 className="mt-4 text-lg font-semibold text-foreground">
            {t("absence.title")}
          </h2>

          <p className="mt-1 max-w-md text-xs text-muted-foreground">
            {t("absence.description")}
          </p>

          <div className="mt-6">
            <Link
              href="/operador/agenda"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "inline-flex items-center gap-2 min-h-[44px] min-w-[44px]",
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
      <OperatorTaskDetailView task={task} locale={locale} />
    </div>
  );
}
