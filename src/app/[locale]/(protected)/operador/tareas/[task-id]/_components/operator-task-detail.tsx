import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import {
  type OperatorTaskDetail,
  OPERATOR_DELIVERABLE_STATUS_KEYS,
  OPERATOR_TASK_STATUS_KEYS,
} from "@/lib/operator/types";
import { OperatorTaskResources } from "./operator-task-resources";
import { OperatorDeliverableCard } from "./operator-deliverable-card";
import { TASK_STATUS_MAP, TASK_PRIORITY_MAP } from "@/lib/status-maps";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Folder,
  Calendar,
  Clock,
  Sparkles,
  CircleDot,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  FileText,
  Package,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface OperatorTaskDetailViewProps {
  task: OperatorTaskDetail;
  locale: string;
}

const URGENCY_CONFIG: Record<
  string,
  {
    badgeBg: string;
    badgeFg: string;
    icon: LucideIcon;
  }
> = {
  new: {
    badgeBg: "bg-emerald-100 dark:bg-emerald-950/60",
    badgeFg: "text-emerald-800 dark:text-emerald-200",
    icon: Sparkles,
  },
  normal: {
    badgeBg: "bg-slate-100 dark:bg-slate-900/60",
    badgeFg: "text-slate-800 dark:text-slate-200",
    icon: CircleDot,
  },
  upcoming: {
    badgeBg: "bg-blue-100 dark:bg-blue-950/60",
    badgeFg: "text-blue-800 dark:text-blue-200",
    icon: Clock,
  },
  urgent: {
    badgeBg: "bg-amber-100 dark:bg-amber-950/60",
    badgeFg: "text-amber-800 dark:text-amber-200",
    icon: AlertCircle,
  },
  overdue: {
    badgeBg: "bg-red-100 dark:bg-red-950/60",
    badgeFg: "text-red-800 dark:text-red-200",
    icon: AlertTriangle,
  },
  completed: {
    badgeBg: "bg-green-100 dark:bg-green-950/60",
    badgeFg: "text-green-800 dark:text-green-200",
    icon: CheckCircle,
  },
};

function formatDisplayDate(dateStr: string | null, locale: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(
      locale === "es" || locale === "es-MX" ? "es-MX" : "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      },
    );
  } catch {
    return dateStr;
  }
}

export async function OperatorTaskDetailView({
  task,
  locale,
}: OperatorTaskDetailViewProps) {
  const tTask = await getTranslations("projects.operatorTask");
  const tSubmission = await getTranslations("projects.operatorSubmission");
  const tAgenda = await getTranslations("projects.operatorAgenda");
  const tTasks = await getTranslations("projects.tasks");
  const tPriority = await getTranslations("shell.priority");

  const urgencyConfig =
    URGENCY_CONFIG[task.urgencyCategory] ?? URGENCY_CONFIG.normal;
  const UrgencyIcon = urgencyConfig.icon;

  const statusConfig = TASK_STATUS_MAP[task.taskStatus];
  const StatusIcon = statusConfig?.icon ?? CircleDot;
  const taskStatusKey = OPERATOR_TASK_STATUS_KEYS[task.taskStatus] ?? "pending";
  const taskStatusLabel = tTasks(`taskStatus.${taskStatusKey}`);

  const priorityConfig = TASK_PRIORITY_MAP[task.taskPriority];
  const priorityLabel = tPriority(task.taskPriority);

  const urgencyLabel = tAgenda(`urgency.${task.urgencyCategory}`);
  const urgencyAria = tAgenda(`urgency.${task.urgencyCategory}Aria`);

  const formattedAssigned = task.assignedAt
    ? formatDisplayDate(task.assignedAt, locale)
    : null;
  const formattedDeadline = task.taskDeadlineAt
    ? formatDisplayDate(task.taskDeadlineAt, locale)
    : null;
  const formattedStarted = task.taskStartedAt
    ? formatDisplayDate(task.taskStartedAt, locale)
    : null;

  return (
    <div className="space-y-6" data-testid="operator-task-detail-view">
      {/* Top back navigation */}
      <div>
        <Link
          href={`/operador/proyectos/${task.projectId}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          <span>{tTask("backToProject")}</span>
        </Link>
      </div>

      {/* Task Header & Badges */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Urgency Badge */}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0",
              urgencyConfig.badgeBg,
              urgencyConfig.badgeFg,
            )}
            role="status"
            aria-label={urgencyAria}
          >
            <UrgencyIcon className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{urgencyLabel}</span>
          </span>

          {/* Task Status Badge */}
          {statusConfig && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0",
                statusConfig.badgeBg,
                statusConfig.badgeFg,
              )}
              role="status"
            >
              <StatusIcon className="size-3.5 shrink-0" aria-hidden="true" />
              <span>{taskStatusLabel}</span>
            </span>
          )}

          {/* Priority Badge */}
          {priorityConfig && (
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0",
                priorityConfig.badgeBg,
                priorityConfig.badgeFg,
              )}
            >
              <span>{priorityLabel}</span>
            </span>
          )}
        </div>

        {/* Title and Project Name */}
        <div>
          <h1
            data-testid="operator-task-title"
            className="text-xl sm:text-2xl font-bold tracking-tight text-foreground"
          >
            {task.taskTitle}
          </h1>

          <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Folder className="size-3.5 shrink-0" aria-hidden="true" />
            <Link
              href={`/operador/proyectos/${task.projectId}`}
              aria-label={tTask("viewProjectAria", {
                projectName: task.projectName,
              })}
              className="font-medium text-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
            >
              {task.projectName}
            </Link>
          </div>
        </div>
      </div>

      {/* Timeline & Deadlines */}
      {(formattedAssigned || formattedDeadline || formattedStarted) && (
        <section
          aria-labelledby="task-timeline-heading"
          className="rounded-lg border border-border bg-card p-4 sm:p-5 shadow-sm"
        >
          <h2
            id="task-timeline-heading"
            className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5"
          >
            {tTask("timeContext")}
          </h2>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-foreground">
            {formattedAssigned && (
              <div className="flex items-center gap-1.5">
                <Clock
                  className="size-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
                <span>{tTask("assignedAt", { date: formattedAssigned })}</span>
              </div>
            )}
            {formattedDeadline && (
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <Calendar
                  className="size-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
                <span>{tTask("deadlineAt", { date: formattedDeadline })}</span>
              </div>
            )}
            {formattedStarted && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="size-3.5" aria-hidden="true" />
                <span>{tTask("startedAt", { date: formattedStarted })}</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Description */}
      <section
        aria-labelledby="task-description-heading"
        className="rounded-lg border border-border bg-card p-4 sm:p-5 shadow-sm space-y-2"
      >
        <div className="flex items-center gap-2">
          <FileText
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <h2
            id="task-description-heading"
            className="text-sm font-semibold text-foreground tracking-tight"
          >
            {tTask("descriptionTitle")}
          </h2>
        </div>
        <p className="text-xs text-foreground/90 whitespace-pre-line leading-relaxed pl-6">
          {task.taskDescription || (
            <span className="italic text-muted-foreground">
              {tTask("noDescription")}
            </span>
          )}
        </p>
      </section>

      {/* Task Resources */}
      <OperatorTaskResources
        resources={task.resources}
        translations={{
          resourcesTitle: tTask("resourcesTitle"),
          noResources: tTask("noResources"),
          externalResourceAria: tTask("externalResourceAria", {
            name: "{name}",
          }),
        }}
      />

      {/* Assigned Deliverables */}
      <section
        data-testid="operator-deliverables-section"
        aria-labelledby="task-deliverables-heading"
        className="space-y-3"
      >
        <div className="flex items-center gap-2">
          <Package
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <h2
            id="task-deliverables-heading"
            className="text-sm font-semibold text-foreground tracking-tight"
          >
            {tTask("deliverablesTitle")}
          </h2>
          <span className="text-xs text-muted-foreground">
            ({task.deliverables.length})
          </span>
        </div>

        {task.deliverables.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-4 text-xs text-muted-foreground italic">
            {tTask("noDeliverables")}
          </div>
        ) : (
          <div className="space-y-3">
            {task.deliverables.map((deliverable) => {
              const deliverableStatusKey =
                OPERATOR_DELIVERABLE_STATUS_KEYS[
                  deliverable.deliverableStatus ?? ""
                ] ?? "pending";
              const deliverableStatusLabel = tTask(
                `deliverableStatus.${deliverableStatusKey}`,
              );

              return (
                <OperatorDeliverableCard
                  key={deliverable.deliverableId}
                  deliverable={deliverable}
                  locale={locale}
                  translations={{
                    statusLabel: deliverableStatusLabel,
                    specificationsTitle: tTask("specificationsTitle"),
                    noSpecifications: tTask("noSpecifications"),
                    submissionDeadline: tTask("submissionDeadline", {
                      date: "{date}",
                    }),
                    internalReviewDeadline: tTask("internalReviewDeadline", {
                      date: "{date}",
                    }),
                    clientDeliveryDeadline: tTask("clientDeliveryDeadline", {
                      date: "{date}",
                    }),
                    awaitingInternalReviewNotice: tTask(
                      "awaitingInternalReviewNotice",
                    ),
                    awaitingClientReviewNotice: tTask(
                      "awaitingClientReviewNotice",
                    ),
                    approvedNotice: tTask("approvedNotice"),
                    deliveredNotice: tTask("deliveredNotice"),
                    changesRequestedNotice: tTask("changesRequestedNotice"),
                    submission: {
                      dialogTitle: tSubmission("dialogTitle"),
                      dialogTitleRevision: tSubmission("dialogTitleRevision"),
                      dialogDescription: tSubmission("dialogDescription"),
                      truthfulnessNotice: tSubmission("truthfulnessNotice"),
                      revisionNotice: tSubmission("revisionNotice", {
                        nextVersion: "{nextVersion}",
                      }),
                      urlLabel: tSubmission("urlLabel"),
                      urlPlaceholder: tSubmission("urlPlaceholder"),
                      urlHelp: tSubmission("urlHelp"),
                      urlError: tSubmission("urlError"),
                      noteLabel: tSubmission("noteLabel"),
                      notePlaceholder: tSubmission("notePlaceholder"),
                      noteHelp: tSubmission("noteHelp"),
                      charCount: tSubmission("charCount", {
                        count: "{count}",
                      }),
                      cancelAction: tSubmission("cancelAction"),
                      submitAction: tSubmission("submitAction"),
                      submitting: tSubmission("submitting"),
                      successToast: tSubmission("successToast", {
                        version: "{version}",
                      }),
                      submitCta: tTask("submitCta"),
                      resubmitCta: tTask("resubmitCta"),
                      errors: {
                        validationFailed: tSubmission(
                          "errors.validationFailed",
                        ),
                        unauthorized: tSubmission("errors.unauthorized"),
                        notFound: tSubmission("errors.notFound"),
                        invalidTransition: tSubmission(
                          "errors.invalidTransition",
                        ),
                        conflict: tSubmission("errors.conflict"),
                        invariantViolation: tSubmission(
                          "errors.invariantViolation",
                        ),
                        generic: tSubmission("errors.generic"),
                      },
                    },
                  }}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
