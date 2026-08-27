import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { Profile } from "@/lib/auth/session";
import type { OperatorShellData } from "@/lib/shell-data/shell-queries";
import {
  TASK_PRIORITY_MAP,
  TASK_STATUS_MAP,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/status-maps";
import {
  ArrowRight,
  CalendarCheck,
  CalendarDays,
  FolderKanban,
} from "lucide-react";

interface OperatorShellProps {
  profile: Profile;
  data: OperatorShellData;
}

export async function OperatorShell({ profile, data }: OperatorShellProps) {
  const t = await getTranslations("shell");
  const quickAccess = [
    {
      href: "/operador/agenda",
      icon: CalendarCheck,
      title: t("nav.links.agenda"),
      description: t("landing.operator.agendaDescription"),
    },
    {
      href: "/operador/proyectos",
      icon: FolderKanban,
      title: t("nav.links.myProjects"),
      description: t("landing.operator.projectsDescription"),
    },
    {
      href: "/calendario",
      icon: CalendarDays,
      title: t("nav.links.calendar"),
      description: t("landing.operator.calendarDescription"),
    },
  ];
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {t("landing.operator.welcome", { name: profile.full_name })}
      </h1>
      <section
        className="grid gap-4 sm:grid-cols-3"
        aria-label={t("landing.quickAccess")}
      >
        {quickAccess.map(({ href, icon: Icon, title, description }) => (
          <Link
            key={href}
            href={href}
            className="group flex min-h-[132px] flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-primary/10 p-2.5 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-semibold">{title}</h2>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </div>
            <span className="flex items-center gap-1 text-xs font-medium text-primary">
              {t("landing.open")}
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        ))}
      </section>
      <section aria-labelledby="operator-agenda-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="operator-agenda-heading" className="text-lg font-semibold">
            {t("landing.operator.myAgenda")}
          </h2>
          <Link
            href="/operador/agenda"
            className="text-sm font-medium text-primary hover:underline"
          >
            {t("landing.viewAll")}
          </Link>
        </div>
        {data.agendaItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <p className="text-muted-foreground">
              {t("landing.operator.emptyAgenda")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.agendaItems.map((item, index) => {
              const status =
                TASK_STATUS_MAP[
                  (item.task_status as TaskStatus) || "pending"
                ] ?? TASK_STATUS_MAP.pending;
              const priority =
                TASK_PRIORITY_MAP[
                  (item.task_priority as TaskPriority) || "medium"
                ] ?? TASK_PRIORITY_MAP.medium;
              const body = (
                <>
                  <div>
                    <h3 className="font-semibold">
                      {item.task_title ?? t("landing.operator.untitledTask")}
                    </h3>
                    {item.project_name && (
                      <p className="text-sm text-muted-foreground">
                        {item.project_name}
                      </p>
                    )}
                    <div className="mt-2 flex gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${status.badgeBg} ${status.badgeFg}`}
                      >
                        {t(
                          `status.${status.labelKey.replace("taskStatus.", "")}`,
                        )}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${priority.badgeBg} ${priority.badgeFg}`}
                      >
                        {t(priority.labelKey)}
                      </span>
                    </div>
                  </div>
                  {item.task_deadline_at && (
                    <p className="text-sm text-muted-foreground">
                      {t("landing.deadline", {
                        date: new Intl.DateTimeFormat("en-US", {
                          dateStyle: "medium",
                        }).format(new Date(item.task_deadline_at)),
                      })}
                    </p>
                  )}
                </>
              );
              return item.task_id ? (
                <Link
                  key={item.task_id}
                  href={`/operador/tareas/${item.task_id}`}
                  className="flex min-h-[88px] flex-col justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/50 hover:shadow-md sm:flex-row sm:items-center"
                >
                  {body}
                </Link>
              ) : (
                <div
                  key={index}
                  className="flex flex-col justify-between gap-4 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center"
                >
                  {body}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
