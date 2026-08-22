import { getTranslations } from "next-intl/server";
import type { Profile } from "@/lib/auth/session";
import type { OperatorShellData } from "@/lib/shell-data/shell-queries";
import {
  TASK_STATUS_MAP,
  TASK_PRIORITY_MAP,
  type TaskStatus,
  type TaskPriority,
} from "@/lib/status-maps";

interface OperatorShellProps {
  profile: Profile;
  data: OperatorShellData;
}

export async function OperatorShell({ profile, data }: OperatorShellProps) {
  const t = await getTranslations("shell");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {t("landing.operator.welcome", { name: profile.full_name })}
        </h1>
      </div>

      <section aria-labelledby="operator-agenda-heading" className="space-y-4">
        <h2
          id="operator-agenda-heading"
          className="text-lg font-semibold text-foreground"
        >
          {t("landing.operator.myAgenda")}
        </h2>

        {data.agendaItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center bg-card/50">
            <p className="text-muted-foreground">
              {t("landing.operator.emptyAgenda")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.agendaItems.map((item, idx) => {
              const statusConfig =
                TASK_STATUS_MAP[
                  (item.task_status as TaskStatus) || "pending"
                ] ?? TASK_STATUS_MAP.pending;
              const priorityConfig =
                TASK_PRIORITY_MAP[
                  (item.task_priority as TaskPriority) || "medium"
                ] ?? TASK_PRIORITY_MAP.medium;

              return (
                <div
                  key={item.task_id ?? idx}
                  className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md text-card-foreground flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground">
                        {item.task_title ?? t("landing.operator.untitledTask")}
                      </h3>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig.badgeBg} ${statusConfig.badgeFg}`}
                      >
                        <statusConfig.icon
                          className="h-3 w-3"
                          aria-hidden="true"
                        />
                        {t(
                          `status.${statusConfig.labelKey.replace("taskStatus.", "")}` as
                            | "status.planning"
                            | "status.inProgress"
                            | "status.paused"
                            | "status.completed"
                            | "status.cancelled",
                        )}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${priorityConfig.badgeBg} ${priorityConfig.badgeFg}`}
                      >
                        <priorityConfig.icon
                          className="h-3 w-3"
                          aria-hidden="true"
                        />
                        {t(
                          priorityConfig.labelKey as
                            | "priority.low"
                            | "priority.medium"
                            | "priority.high"
                            | "priority.blocking",
                        )}
                      </span>
                    </div>
                    {item.project_name && (
                      <p className="text-sm text-muted-foreground">
                        {item.project_name}
                      </p>
                    )}
                  </div>

                  {item.task_deadline_at && (
                    <div className="text-sm text-muted-foreground shrink-0">
                      {new Date(item.task_deadline_at).toLocaleDateString()}
                    </div>
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
