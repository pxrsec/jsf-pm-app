import { getTranslations } from "next-intl/server";
import type { Profile } from "@/lib/auth/session";
import type { PmShellData } from "@/lib/shell-data/shell-queries";

interface PmShellProps {
  profile: Profile;
  data: PmShellData;
}

function getStatusKey(status: string | null | undefined) {
  switch (status) {
    case "planning":
      return "status.planning";
    case "in_progress":
      return "status.inProgress";
    case "paused":
      return "status.paused";
    case "completed":
      return "status.completed";
    case "cancelled":
      return "status.cancelled";
    default:
      return "status.inProgress";
  }
}

export async function PmShell({ profile, data }: PmShellProps) {
  const t = await getTranslations("shell");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-3xl">
          {t("landing.pm.welcome", { name: profile.full_name })}
        </h1>
      </div>

      <section aria-labelledby="pm-projects-heading" className="space-y-4">
        <h2
          id="pm-projects-heading"
          className="text-lg font-semibold text-neutral-800 dark:text-neutral-200"
        >
          {t("landing.pm.myProjects")}
        </h2>

        {data.projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 p-8 text-center bg-white/50 dark:bg-neutral-900/50">
            <p className="text-neutral-500 dark:text-neutral-400">
              {t("landing.pm.emptyProjects")}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.projects.map((project) => (
              <div
                key={project.id}
                className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 line-clamp-1">
                      {project.name}
                    </h3>
                    {project.is_primary && (
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                        Lead
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      {t(
                        getStatusKey(project.status) as
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
                  <p className="mt-4 text-xs text-neutral-500 dark:text-neutral-400">
                    {new Date(project.deadline_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
