import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { Profile } from "@/lib/auth/session";
import type { ClientShellData } from "@/lib/shell-data/shell-queries";
import { PROJECT_STATUS_MAP, type ProjectStatus } from "@/lib/status-maps";
import { FolderKanban, ListTodo, FileCheck2, ArrowRight } from "lucide-react";

interface ClientShellProps {
  profile: Profile;
  data: ClientShellData;
}

export async function ClientShell({ profile, data }: ClientShellProps) {
  const t = await getTranslations("shell");
  const portalT = await getTranslations("projects.clientPortal");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Welcome Banner */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t("landing.client.welcome", { name: profile.full_name })}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {portalT("welcomeSubtitle")}
        </p>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/cliente/proyectos"
          className="group flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/50 hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              <FolderKanban className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                {portalT("quickLinks.projectsTitle")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {portalT("quickLinks.projectsSubtitle")}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1 text-xs font-medium text-primary">
            <span>{portalT("quickLinks.viewAll")}</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
        </Link>

        <Link
          href="/cliente/tareas"
          className="group flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/50 hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              <ListTodo className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                {portalT("quickLinks.requestsTitle")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {portalT("quickLinks.requestsSubtitle")}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1 text-xs font-medium text-primary">
            <span>{portalT("quickLinks.viewAll")}</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
        </Link>

        <Link
          href="/cliente/entregables"
          className="group flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/50 hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              <FileCheck2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                {portalT("quickLinks.reviewsTitle")}
              </h2>
              <p className="text-xs text-muted-foreground">
                {portalT("quickLinks.reviewsSubtitle")}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1 text-xs font-medium text-primary">
            <span>{portalT("quickLinks.viewAll")}</span>
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
        </Link>
      </div>

      {/* Projects Section */}
      <section aria-labelledby="client-projects-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2
            id="client-projects-heading"
            className="text-lg font-semibold text-foreground"
          >
            {t("landing.client.myProjects")}
          </h2>
          {data.projects.length > 0 && (
            <Link
              href="/cliente/proyectos"
              className="text-xs font-medium text-primary hover:underline"
            >
              {portalT("viewAllProjects")}
            </Link>
          )}
        </div>

        {data.projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center bg-card/50">
            <p className="text-muted-foreground">
              {t("landing.client.emptyProjects")}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.projects.map((project) => {
              const statusConfig =
                PROJECT_STATUS_MAP[
                  (project.status as ProjectStatus) || "planning"
                ] ?? PROJECT_STATUS_MAP.planning;

              const cardContent = (
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md text-card-foreground flex flex-col justify-between h-full">
                  <div>
                    <h3 className="font-semibold text-foreground line-clamp-1">
                      {project.name ?? "Sin nombre"}
                    </h3>
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusConfig.badgeBg} ${statusConfig.badgeFg}`}
                      >
                        <statusConfig.icon
                          className="h-3 w-3"
                          aria-hidden="true"
                        />
                        {t(
                          `status.${statusConfig.labelKey}` as
                            | "status.planning"
                            | "status.inProgress"
                            | "status.paused"
                            | "status.completed"
                            | "status.cancelled",
                        )}
                      </span>
                    </div>
                  </div>
                  {project.deadline_at && (
                    <p className="mt-4 text-xs text-muted-foreground">
                      {new Date(project.deadline_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              );

              return project.id ? (
                <Link
                  key={project.id}
                  href={`/cliente/proyectos/${project.id}`}
                  className="block transition-transform hover:-translate-y-0.5"
                >
                  {cardContent}
                </Link>
              ) : (
                <div key={project.name}>{cardContent}</div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
