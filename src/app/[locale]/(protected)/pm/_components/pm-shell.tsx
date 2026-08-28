import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { Profile } from "@/lib/auth/session";
import type { PmShellData } from "@/lib/shell-data/shell-queries";
import { PROJECT_STATUS_MAP, type ProjectStatus } from "@/lib/status-maps";
import {
  ArrowRight,
  CalendarDays,
  ChartNoAxesCombined,
  FolderKanban,
} from "lucide-react";

interface PmShellProps {
  profile: Profile;
  data: PmShellData;
}

export async function PmShell({ profile, data }: PmShellProps) {
  const t = await getTranslations("shell");
  const tCapacities = await getTranslations("projects.roster.capacities");
  const projects = [...data.projects].sort((a, b) => {
    if (!a.deadline_at) return 1;
    if (!b.deadline_at) return -1;
    return (
      new Date(a.deadline_at).getTime() - new Date(b.deadline_at).getTime()
    );
  });
  const quickAccess = [
    {
      href: "/pm/proyectos",
      icon: FolderKanban,
      title: t("nav.links.projects"),
      description: t("landing.pm.myProjects"),
    },
    {
      href: "/calendario",
      icon: CalendarDays,
      title: t("nav.links.calendar"),
      description: t("landing.pm.calendarDescription"),
    },
    {
      href: "/pm/metricas",
      icon: ChartNoAxesCombined,
      title: t("nav.links.metrics"),
      description: t("landing.pm.metricsDescription"),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {t("landing.pm.welcome", { name: profile.full_name })}
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
      <section aria-labelledby="pm-projects-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="pm-projects-heading" className="text-lg font-semibold">
            {t("landing.pm.myProjects")}
          </h2>
          <Link
            href="/pm/proyectos"
            className="text-sm font-medium text-primary hover:underline"
          >
            {t("landing.viewAll")}
          </Link>
        </div>
        {projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <p className="text-muted-foreground">
              {t("landing.pm.emptyProjects")}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => {
              const status =
                PROJECT_STATUS_MAP[
                  (project.status as ProjectStatus) || "planning"
                ] ?? PROJECT_STATUS_MAP.planning;
              return (
                <Link
                  key={project.id}
                  href={`/pm/proyectos/${project.id}`}
                  className="group rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <h3 className="font-semibold group-hover:text-primary">
                    {project.name}
                  </h3>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {project.member_type === "pm_lead" && project.is_primary
                      ? tCapacities("pmLeadPrimary")
                      : tCapacities(
                          project.member_type === "pm_lead"
                            ? "pmLead"
                            : "pmWatcher",
                        )}
                  </p>
                  <span
                    className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${status.badgeBg} ${status.badgeFg}`}
                  >
                    {t(`status.${status.labelKey}`)}
                  </span>
                  {project.deadline_at && (
                    <p className="mt-4 text-xs text-muted-foreground">
                      {t("landing.deadline", {
                        date: new Intl.DateTimeFormat("en-US", {
                          dateStyle: "medium",
                        }).format(new Date(project.deadline_at)),
                      })}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
