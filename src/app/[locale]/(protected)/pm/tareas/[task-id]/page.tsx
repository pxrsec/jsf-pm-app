import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { FileQuestion } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireSession } from "@/lib/auth/session";
import { ROLE_DEFAULT_PATHS } from "@/lib/auth/routes";
import { createClient } from "@/lib/supabase/server";
import {
  getManagerTaskDetail,
  getProjectMembershipCapacity,
} from "@/lib/projects/manager-task-queries";
import { ManagerTaskDetailView } from "@/components/shared/projects/manager-task-detail/manager-task-detail-view";

interface PmTaskDetailPageProps {
  params: Promise<{
    locale: string;
    "task-id": string;
  }>;
}

export default async function PmTaskDetailPage({
  params,
}: PmTaskDetailPageProps) {
  const { "task-id": taskId } = await params;
  const cookieStore = await cookies();
  const session = await requireSession(cookieStore);

  if (session.role !== "pm") {
    redirect(ROLE_DEFAULT_PATHS[session.role] ?? "/iniciar-sesion");
  }

  const supabase = createClient(cookieStore);
  const task = await getManagerTaskDetail(supabase, taskId);
  const t = await getTranslations("projects.managerTask");

  if (!task) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <div
          data-testid="manager-task-absence"
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
              href="/pm/proyectos"
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

  // PM capacity resolution: membership determines mutation UI (pm_lead vs pm_watcher),
  // falling back to pm_watcher (least privilege) on absence or error.
  const effectiveCapacity = await getProjectMembershipCapacity(
    supabase,
    task.projectId,
    session.user.id,
  );

  const safeReturnHref = `/pm/proyectos/${task.projectId}?tab=tasks`;

  return (
    <ManagerTaskDetailView
      task={task}
      role="pm"
      effectiveCapacity={effectiveCapacity}
      currentUserId={session.user.id}
      safeReturnHref={safeReturnHref}
    />
  );
}
