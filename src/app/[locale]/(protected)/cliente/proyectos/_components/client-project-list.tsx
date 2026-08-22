import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { ClientProjectListItem } from "@/lib/client/types";
import { PROJECT_STATUS_MAP } from "@/lib/status-maps";
import { FolderKanban, ListTodo, ArrowRight } from "lucide-react";

interface ClientProjectListProps {
  projects: ClientProjectListItem[];
}

export async function ClientProjectList({ projects }: ClientProjectListProps) {
  const t = await getTranslations("projects.clientProjects");
  const shellT = await getTranslations("shell");

  return (
    <div className="space-y-8">
      {/* Local Quick Entry to Requests Queue */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-primary/20 bg-primary/5">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <ListTodo className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground text-sm">
              {t("requestsBanner.title")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("requestsBanner.description")}
            </p>
          </div>
        </div>
        <Link
          href="/cliente/tareas"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline shrink-0"
        >
          <span>{t("requestsBanner.cta")}</span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      {/* Projects Directory List */}
      <section aria-labelledby="client-projects-list-heading">
        <h2 id="client-projects-list-heading" className="sr-only">
          {t("listHeading")}
        </h2>

        {projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center bg-card/50">
            <FolderKanban className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <h3 className="text-base font-semibold text-foreground">
              {t("empty.title")}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
              {t("empty.description")}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => {
              const statusConfig =
                PROJECT_STATUS_MAP[project.status] ??
                PROJECT_STATUS_MAP.planning;

              return (
                <article
                  key={project.id}
                  aria-labelledby={`project-card-title-${project.id}`}
                  className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/50 hover:shadow-md text-card-foreground flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3
                        id={`project-card-title-${project.id}`}
                        className="font-semibold text-foreground text-base line-clamp-1"
                      >
                        {project.name ?? t("unnamedProject")}
                      </h3>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0 ${statusConfig.badgeBg} ${statusConfig.badgeFg}`}
                      >
                        <statusConfig.icon
                          className="h-3 w-3"
                          aria-hidden="true"
                        />
                        {shellT(
                          `status.${statusConfig.labelKey}` as
                            | "status.planning"
                            | "status.inProgress"
                            | "status.paused"
                            | "status.completed"
                            | "status.cancelled",
                        )}
                      </span>
                    </div>

                    {project.client_scope && (
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">
                        {project.client_scope}
                      </p>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
                    {project.deadline_at ? (
                      <span className="text-xs text-muted-foreground">
                        {t("deadline")}:{" "}
                        {new Date(project.deadline_at).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {t("noDeadline")}
                      </span>
                    )}

                    <Link
                      href={`/cliente/proyectos/${project.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded"
                      aria-label={t("openProjectAria", {
                        projectName: project.name ?? t("unnamedProject"),
                      })}
                    >
                      <span>{t("openProject")}</span>
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
