import { getTranslations } from "next-intl/server";
import type { Profile } from "@/lib/auth/session";
import type { PmShellData } from "@/lib/shell-data/shell-queries";
import { PROJECT_STATUS_MAP, type ProjectStatus } from "@/lib/status-maps";

interface PmShellProps {
  profile: Profile;
  data: PmShellData;
}

export async function PmShell({ profile, data }: PmShellProps) {
  const t = await getTranslations("shell");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t("landing.pm.welcome", { name: profile.full_name })}
        </h1>
      </div>

      <section aria-labelledby="pm-projects-heading" className="space-y-4">
        <h2
          id="pm-projects-heading"
          className="text-lg font-semibold text-foreground"
        >
          {t("landing.pm.myProjects")}
        </h2>

        {data.projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center bg-card/50">
            <p className="text-muted-foreground">
              {t("landing.pm.emptyProjects")}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.projects.map((project) => {
              const statusConfig =
                PROJECT_STATUS_MAP[
                  (project.status as ProjectStatus) || "planning"
                ] ?? PROJECT_STATUS_MAP.planning;

              return (
                <div
                  key={project.id}
                  className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md text-card-foreground flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-foreground line-clamp-1">
                        {project.name}
                      </h3>
                      {project.is_primary && (
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                          Lead
                        </span>
                      )}
                    </div>
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
            })}
          </div>
        )}
      </section>
    </div>
  );
}
