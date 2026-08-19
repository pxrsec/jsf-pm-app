import { getTranslations } from "next-intl/server";
import type { Profile } from "@/lib/auth/session";
import type { OperatorShellData } from "@/lib/shell-data/shell-queries";

interface OperatorShellProps {
  profile: Profile;
  data: OperatorShellData;
}

function getStatusKey(status: string | null | undefined) {
  switch (status) {
    case "pending":
      return "status.planning";
    case "in_progress":
    case "in_review":
      return "status.inProgress";
    case "completed":
      return "status.completed";
    case "blocked":
      return "status.paused";
    default:
      return "status.inProgress";
  }
}

function getPriorityKey(priority: string | null | undefined) {
  switch (priority) {
    case "low":
      return "priority.low";
    case "medium":
      return "priority.medium";
    case "high":
      return "priority.high";
    case "blocking":
      return "priority.blocking";
    default:
      return "priority.medium";
  }
}

export async function OperatorShell({ profile, data }: OperatorShellProps) {
  const t = await getTranslations("shell");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-3xl">
          {t("landing.operator.welcome", { name: profile.full_name })}
        </h1>
      </div>

      <section aria-labelledby="operator-agenda-heading" className="space-y-4">
        <h2
          id="operator-agenda-heading"
          className="text-lg font-semibold text-neutral-800 dark:text-neutral-200"
        >
          {t("landing.operator.myAgenda")}
        </h2>

        {data.agendaItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 p-8 text-center bg-white/50 dark:bg-neutral-900/50">
            <p className="text-neutral-500 dark:text-neutral-400">
              {t("landing.operator.emptyAgenda")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.agendaItems.map((item, idx) => (
              <div
                key={item.task_id ?? idx}
                className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {item.task_title ?? "Sin título"}
                    </h3>
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      {t(
                        getStatusKey(item.task_status) as
                          | "status.planning"
                          | "status.inProgress"
                          | "status.paused"
                          | "status.completed"
                          | "status.cancelled",
                      )}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                      {t(
                        getPriorityKey(item.task_priority) as
                          | "priority.low"
                          | "priority.medium"
                          | "priority.high"
                          | "priority.blocking",
                      )}
                    </span>
                  </div>
                  {item.project_name && (
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      {item.project_name}
                    </p>
                  )}
                </div>

                {item.task_deadline_at && (
                  <div className="text-sm text-neutral-500 dark:text-neutral-400 shrink-0">
                    {new Date(item.task_deadline_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
