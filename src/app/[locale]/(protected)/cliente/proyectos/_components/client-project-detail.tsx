import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type { ClientProjectDetail as ClientProjectDetailType } from "@/lib/client/types";
import {
  PROJECT_STATUS_MAP,
  TASK_PRIORITY_MAP,
  TASK_STATUS_MAP,
} from "@/lib/status-maps";
import {
  ArrowLeft,
  Calendar,
  Clock,
  FileCheck2,
  FolderKanban,
  ListTodo,
  ArrowRight,
} from "lucide-react";
import { ClientSubmissionCard } from "./client-submission-card";
import { ClientReviewSummaryCard } from "./client-review-summary-card";

interface ClientProjectDetailProps {
  detail: ClientProjectDetailType;
}

export async function ClientProjectDetailView({
  detail,
}: ClientProjectDetailProps) {
  const t = await getTranslations("projects.clientProjects.detail");
  const projT = await getTranslations("projects.clientProjects");
  const reqT = await getTranslations("projects.clientRequests");
  const subT = await getTranslations("projects.clientSubmissions");
  const revT = await getTranslations("projects.clientReviews");
  const shellT = await getTranslations("shell");
  const {
    project,
    directRequests,
    directSubmissions,
    releasedProductionReviews,
  } = detail;

  const statusConfig =
    PROJECT_STATUS_MAP[project.status] ?? PROJECT_STATUS_MAP.planning;

  const submissionTranslations = {
    statusSubmitted: subT("status.submitted"),
    statusPending: subT("status.pending"),
    versionLabel: subT("versionLabel"),
    deadline: subT("deadline"),
    noDeadline: subT("noDeadline"),
    readOnlyNotice: subT("readOnlyNotice"),
    untitledDeliverable: reqT("untitledRequest"),
  };

  const reviewTranslations = {
    versionLabel: revT("versionLabel"),
    deadline: revT("deadline"),
    noDeadline: revT("noDeadline"),
    openReview: revT("openReview"),
    untitledDeliverable: revT("untitledDeliverable"),
  };

  return (
    <div className="space-y-8">
      {/* Return Navigation */}
      <div>
        <Link
          href="/cliente/proyectos"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>{t("backToProjects")}</span>
        </Link>
      </div>

      {/* 1. Project Context Section */}
      <section
        aria-labelledby="project-context-heading"
        className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
              <FolderKanban className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h1
                id="project-context-heading"
                className="text-xl sm:text-2xl font-bold tracking-tight text-foreground"
              >
                {project.name ?? projT("unnamedProject")}
              </h1>
              <p className="text-xs text-muted-foreground">
                {t("sectionContext")}
              </p>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1 self-start sm:self-auto rounded-full px-3 py-1 text-xs font-medium ${statusConfig.badgeBg} ${statusConfig.badgeFg}`}
          >
            <statusConfig.icon className="h-3.5 w-3.5" aria-hidden="true" />
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
          <div className="pt-2 border-t border-border/60">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t("scopeLabel")}
            </h2>
            <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">
              {project.client_scope}
            </p>
          </div>
        )}

        <div className="pt-2 border-t border-border/60 flex flex-wrap gap-6 text-xs text-muted-foreground">
          {project.deadline_at && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {t("deadline")}:{" "}
                {new Date(project.deadline_at).toLocaleDateString()}
              </span>
            </div>
          )}
          {project.last_deliverable_activity_at && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {t("lastActivity")}:{" "}
                {new Date(
                  project.last_deliverable_activity_at,
                ).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* 2. Your Requests Section */}
      <section aria-labelledby="direct-requests-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListTodo className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2
              id="direct-requests-heading"
              className="text-lg font-semibold text-foreground"
            >
              {t("requestsSection.title")}
            </h2>
          </div>
          <Link
            href="/cliente/tareas"
            className="text-xs font-medium text-primary hover:underline"
          >
            {t("requestsSection.viewAllQueue")}
          </Link>
        </div>

        {directRequests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center bg-card/50">
            <p className="text-sm text-muted-foreground">
              {t("requestsSection.empty")}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {directRequests.map((req) => {
              const statusCfg =
                TASK_STATUS_MAP[req.status] ?? TASK_STATUS_MAP.pending;
              const priorityCfg =
                TASK_PRIORITY_MAP[req.priority] ?? TASK_PRIORITY_MAP.medium;

              const priorityKey = priorityCfg.labelKey.replace("priority.", "");
              const statusKey = statusCfg.labelKey.replace("taskStatus.", "");

              return (
                <article
                  key={req.id}
                  aria-labelledby={`req-title-${req.id}`}
                  className="rounded-xl border border-border bg-card p-5 shadow-sm text-card-foreground flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3
                        id={`req-title-${req.id}`}
                        className="font-semibold text-foreground text-sm line-clamp-1"
                      >
                        {req.title ?? reqT("untitledRequest")}
                      </h3>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${priorityCfg.badgeBg} ${priorityCfg.badgeFg}`}
                        >
                          {reqT(
                            `priority.${priorityKey}` as
                              | "priority.low"
                              | "priority.medium"
                              | "priority.high"
                              | "priority.blocking",
                          )}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusCfg.badgeBg} ${statusCfg.badgeFg}`}
                        >
                          <statusCfg.icon
                            className="h-3 w-3"
                            aria-hidden="true"
                          />
                          {reqT(
                            `status.${statusKey}` as
                              | "status.pending"
                              | "status.inProgress"
                              | "status.inReview"
                              | "status.completed"
                              | "status.blocked",
                          )}
                        </span>
                      </div>
                    </div>

                    {req.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {req.description}
                      </p>
                    )}

                    {req.child_submission_count > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {t("requestsSection.childCount", {
                          count: req.child_submission_count,
                        })}
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
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      aria-label={t("requestsSection.openRequestAria", {
                        title: req.title ?? reqT("untitledRequest"),
                      })}
                    >
                      <span>{t("requestsSection.openRequest")}</span>
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. Your Requested Submissions Section */}
      <section
        aria-labelledby="direct-submissions-heading"
        className="space-y-4"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2
            id="direct-submissions-heading"
            className="text-lg font-semibold text-foreground"
          >
            {t("submissionsSection.title")}
          </h2>
        </div>

        {directSubmissions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center bg-card/50">
            <p className="text-sm text-muted-foreground">
              {t("submissionsSection.empty")}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {directSubmissions.map((sub) => (
              <ClientSubmissionCard
                key={sub.id}
                submission={sub}
                translations={submissionTranslations}
              />
            ))}
          </div>
        )}
      </section>

      {/* 4. Released Production Reviews Section */}
      <section aria-labelledby="released-reviews-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck2 className="h-5 w-5 text-primary" aria-hidden="true" />
            <h2
              id="released-reviews-heading"
              className="text-lg font-semibold text-foreground"
            >
              {t("reviewsSection.title")}
            </h2>
          </div>
          <Link
            href="/cliente/entregables"
            className="text-xs font-medium text-primary hover:underline"
          >
            {t("reviewsSection.viewAllReviews")}
          </Link>
        </div>

        {releasedProductionReviews.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center bg-card/50">
            <p className="text-sm text-muted-foreground">
              {t("reviewsSection.empty")}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {releasedProductionReviews.map((rev) => (
              <ClientReviewSummaryCard
                key={rev.id}
                review={rev}
                translations={reviewTranslations}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
