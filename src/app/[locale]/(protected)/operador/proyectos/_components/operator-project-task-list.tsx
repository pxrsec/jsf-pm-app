import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type {
  OperatorOwnWorkProjectDetail,
  OperatorAgendaItem,
} from "@/lib/operator/queries";
import { OperatorAgendaTaskCard } from "../../agenda/_components/operator-agenda-task-card";
import { ArrowLeft, FolderKanban } from "lucide-react";

const STATUS_KEYS: Record<string, string> = {
  pending: "pending",
  in_progress: "inProgress",
  in_review: "inReview",
  completed: "completed",
  blocked: "blocked",
};

interface OperatorProjectTaskListProps {
  projectDetail: OperatorOwnWorkProjectDetail;
  locale: string;
}

export async function OperatorProjectTaskList({
  projectDetail,
  locale,
}: OperatorProjectTaskListProps) {
  const tProjects = await getTranslations("projects.operatorProjects");
  const tAgenda = await getTranslations("projects.operatorAgenda");
  const tTasks = await getTranslations("projects.tasks");
  const tPriority = await getTranslations("shell.priority");

  function getCardTranslations(item: OperatorAgendaItem) {
    const statusKey = STATUS_KEYS[item.taskStatus] ?? "pending";
    const statusLabel = tTasks(`taskStatus.${statusKey}`);
    const priorityLabel = tPriority(item.taskPriority);

    const urgencyLabel = tAgenda(`urgency.${item.urgencyCategory}`);
    const urgencyAria = tAgenda(`urgency.${item.urgencyCategory}Aria`);

    const deliverablesCount = tAgenda("card.deliverablesCount", {
      count: item.deliverables.length.toString(),
    });

    const assignedAtLabel = item.assignedAt
      ? tAgenda("card.assignedAt", {
          date: new Date(item.assignedAt).toLocaleDateString(
            locale === "es" || locale === "es-MX" ? "es-MX" : "en-US",
            {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            },
          ),
        })
      : "";

    const deadlineAtLabel = item.taskDeadlineAt
      ? tAgenda("card.deadlineAt", {
          date: new Date(item.taskDeadlineAt).toLocaleDateString(
            locale === "es" || locale === "es-MX" ? "es-MX" : "en-US",
            {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            },
          ),
        })
      : "";

    const completedAtLabel = item.taskDeadlineAt
      ? tAgenda("card.completedAt", {
          date: new Date(item.taskDeadlineAt).toLocaleDateString(
            locale === "es" || locale === "es-MX" ? "es-MX" : "en-US",
            {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            },
          ),
        })
      : "";

    const viewProjectAria = tAgenda("card.viewProjectAria", {
      projectName: item.projectName,
    });

    const openTaskAria = tAgenda("card.openTaskAria", {
      taskTitle: item.taskTitle,
    });

    return {
      urgencyLabel,
      urgencyAria,
      statusLabel,
      priorityLabel,
      deliverablesCount,
      assignedAtLabel,
      deadlineAtLabel,
      completedAtLabel,
      viewProjectAria,
      openTaskAria,
    };
  }

  return (
    <div className="space-y-6" data-testid="operator-project-task-list">
      {/* Header with back link */}
      <div>
        <div className="mb-2">
          <Link
            href="/operador/proyectos"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span>{tProjects("backToProjects")}</span>
          </Link>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FolderKanban className="size-4" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {projectDetail.projectName}
            </h1>
            <p className="text-xs text-muted-foreground">
              {tProjects("projectDetail.ownTasksSummary", {
                count: projectDetail.tasks.length.toString(),
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Task cards */}
      <div className="space-y-3">
        {projectDetail.tasks.map((task) => (
          <OperatorAgendaTaskCard
            key={task.taskId}
            item={task}
            locale={locale}
            translations={getCardTranslations(task)}
          />
        ))}
      </div>
    </div>
  );
}
