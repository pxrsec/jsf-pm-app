import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { ClientRequestQueueItem } from "@/lib/client/types";
import { TASK_PRIORITY_MAP, TASK_STATUS_MAP } from "@/lib/status-maps";
import { ListTodo, ArrowRight, FolderKanban } from "lucide-react";

interface ClientRequestListProps {
  requests: ClientRequestQueueItem[];
}

export async function ClientRequestList({ requests }: ClientRequestListProps) {
  const t = await getTranslations("projects.clientRequests");

  return (
    <div className="space-y-6">
      {requests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center bg-card/50">
          <ListTodo className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <h2 className="text-base font-semibold text-foreground">
            {t("empty.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
            {t("empty.description")}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {requests.map((req) => {
            const statusConfig =
              TASK_STATUS_MAP[req.status] ?? TASK_STATUS_MAP.pending;
            const priorityConfig =
              TASK_PRIORITY_MAP[req.priority] ?? TASK_PRIORITY_MAP.medium;

            return (
              <article
                key={req.id}
                aria-labelledby={`req-card-title-${req.id}`}
                className="rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/50 hover:shadow-md text-card-foreground flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FolderKanban className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="line-clamp-1">
                      {req.project_name ?? t("unnamedProject")}
                    </span>
                  </div>

                  <div className="flex items-start justify-between gap-2">
                    <h3
                      id={`req-card-title-${req.id}`}
                      className="font-semibold text-foreground text-base line-clamp-1"
                    >
                      {req.title ?? t("untitledRequest")}
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${priorityConfig.badgeBg} ${priorityConfig.badgeFg}`}
                    >
                      {t(`priority.${priorityConfig.labelKey}` as const)}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig.badgeBg} ${statusConfig.badgeFg}`}
                    >
                      <statusConfig.icon
                        className="h-3 w-3"
                        aria-hidden="true"
                      />
                      {t(`status.${statusConfig.labelKey}` as const)}
                    </span>
                  </div>

                  {req.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {req.description}
                    </p>
                  )}

                  {req.child_submission_count > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {t("childCount", { count: req.child_submission_count })}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  {req.deadline_at ? (
                    <span className="text-xs text-muted-foreground">
                      {t("deadline")}:{" "}
                      {new Date(req.deadline_at).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {t("noDeadline")}
                    </span>
                  )}

                  <Link
                    href={`/cliente/tareas/${req.id}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded"
                    aria-label={t("openRequestAria", {
                      title: req.title ?? t("untitledRequest"),
                    })}
                  >
                    <span>{t("openRequest")}</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
