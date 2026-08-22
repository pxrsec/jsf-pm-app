import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { ClientRequestDetail as ClientRequestDetailType } from "@/lib/client/types";
import { TASK_PRIORITY_MAP, TASK_STATUS_MAP } from "@/lib/status-maps";
import {
  ArrowLeft,
  Calendar,
  Clock,
  FolderKanban,
  Paperclip,
  CheckCircle2,
} from "lucide-react";
import { ClientSubmissionCard } from "../../proyectos/_components/client-submission-card";
import { ClientRequestActions } from "./client-request-actions";

interface ClientRequestDetailViewProps {
  request: ClientRequestDetailType;
}

export async function ClientRequestDetailView({
  request,
}: ClientRequestDetailViewProps) {
  const t = await getTranslations("projects.clientRequests.detail");
  const reqT = await getTranslations("projects.clientRequests");
  const subT = await getTranslations("projects.clientSubmissions");

  const statusConfig =
    TASK_STATUS_MAP[request.status] ?? TASK_STATUS_MAP.pending;
  const priorityConfig =
    TASK_PRIORITY_MAP[request.priority] ?? TASK_PRIORITY_MAP.medium;

  const submissionTranslations = {
    statusSubmitted: subT("status.submitted"),
    statusPending: subT("status.pending"),
    versionLabel: subT("versionLabel"),
    deadline: subT("deadline"),
    noDeadline: subT("noDeadline"),
    readOnlyNotice: subT("readOnlyNotice"),
  };

  return (
    <div className="space-y-8">
      {/* Return Navigation */}
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/cliente/tareas"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>{t("backToQueue")}</span>
        </Link>
        {request.project_id && (
          <Link
            href={`/cliente/proyectos/${request.project_id}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <FolderKanban className="h-4 w-4" aria-hidden="true" />
            <span>
              {t("backToProject", {
                projectName: request.project_name ?? "Proyecto",
              })}
            </span>
          </Link>
        )}
      </div>

      {/* Main Request Context Card */}
      <article
        aria-labelledby="request-title-heading"
        className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <FolderKanban className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{request.project_name ?? "Proyecto"}</span>
            </div>
            <h1
              id="request-title-heading"
              className="text-xl sm:text-2xl font-bold tracking-tight text-foreground"
            >
              {request.title}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${priorityConfig.badgeBg} ${priorityConfig.badgeFg}`}
            >
              {reqT(`priority.${priorityConfig.labelKey}` as const)}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${statusConfig.badgeBg} ${statusConfig.badgeFg}`}
            >
              <statusConfig.icon className="h-3.5 w-3.5" aria-hidden="true" />
              {reqT(`status.${statusConfig.labelKey}` as const)}
            </span>
          </div>
        </div>

        {/* Plain-text Description */}
        {request.description && (
          <div className="pt-4 border-t border-border/60">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t("descriptionTitle")}
            </h2>
            <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">
              {request.description}
            </p>
          </div>
        )}

        {/* Timeline Dates */}
        <div className="pt-4 border-t border-border/60 flex flex-wrap gap-6 text-xs text-muted-foreground">
          {request.deadline_at && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {t("deadline")}:{" "}
                {new Date(request.deadline_at).toLocaleDateString()}
              </span>
            </div>
          )}
          {request.started_at && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {t("startedAt")}:{" "}
                {new Date(request.started_at).toLocaleDateString()}
              </span>
            </div>
          )}
          {request.completed_at && (
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {t("completedAt")}:{" "}
                {new Date(request.completed_at).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {/* Approved Resources (Display-Only Metadata) */}
        {request.resources.length > 0 && (
          <div className="pt-4 border-t border-border/60">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t("resourcesTitle")}</span>
            </h2>
            <ul className="divide-y divide-border/60 rounded-lg border border-border/60 bg-muted/20">
              {request.resources.map((res, index) => (
                <li
                  key={`${res.name}-${index}`}
                  className="px-3 py-2 text-xs flex items-center justify-between text-muted-foreground"
                >
                  <span className="font-medium text-foreground">
                    {res.name}
                  </span>
                  {res.type && <span>{res.type}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Controls */}
        <div className="pt-4 border-t border-border/60">
          <ClientRequestActions
            taskId={request.id}
            currentStatus={request.status}
            readinessSummary={request.readinessSummary}
          />
        </div>
      </article>

      {/* Child Submissions Requirements */}
      <section
        aria-labelledby="child-submissions-requirements-heading"
        className="space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2
            id="child-submissions-requirements-heading"
            className="text-lg font-semibold text-foreground"
          >
            {subT("requirementsTitle")}
          </h2>
          <span className="text-xs text-muted-foreground">
            {subT("requirementsCount", {
              count: request.childSubmissions.length,
            })}
          </span>
        </div>

        {request.childSubmissions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center bg-card/50">
            <p className="text-sm text-muted-foreground">
              {subT("noRequirements")}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {request.childSubmissions.map((sub) => (
              <ClientSubmissionCard
                key={sub.id}
                submission={sub}
                translations={submissionTranslations}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
