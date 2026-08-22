import { getTranslations } from "next-intl/server";
import type { OperatorAgendaItem } from "@/lib/operator/queries";
import { OperatorAgendaTaskCard } from "./operator-agenda-task-card";
import { CheckCircle2 } from "lucide-react";

const STATUS_KEYS: Record<string, string> = {
  pending: "pending",
  in_progress: "inProgress",
  in_review: "inReview",
  completed: "completed",
  blocked: "blocked",
};

interface OperatorAgendaListProps {
  items: OperatorAgendaItem[];
  locale: string;
}

export async function OperatorAgendaList({
  items,
  locale,
}: OperatorAgendaListProps) {
  const tAgenda = await getTranslations("projects.operatorAgenda");
  const tTasks = await getTranslations("projects.tasks");
  const tPriority = await getTranslations("shell.priority");

  const activeItems = items.filter(
    (item) => item.urgencyCategory !== "completed",
  );
  const completedItems = items.filter(
    (item) => item.urgencyCategory === "completed",
  );

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
    <div className="space-y-6" data-testid="operator-agenda-list">
      {/* Active items */}
      {activeItems.length > 0 && (
        <div className="space-y-3">
          {activeItems.map((item) => (
            <OperatorAgendaTaskCard
              key={item.taskId}
              item={item}
              locale={locale}
              translations={getCardTranslations(item)}
            />
          ))}
        </div>
      )}

      {/* Completed-today items */}
      {completedItems.length > 0 && (
        <section
          data-testid="completed-today-section"
          className="mt-8 space-y-3 pt-6 border-t border-border/80"
          aria-labelledby="completed-today-heading"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2
              className="size-4 text-green-600 dark:text-green-400"
              aria-hidden="true"
            />
            <div>
              <h3
                id="completed-today-heading"
                className="text-sm font-semibold text-foreground tracking-tight"
              >
                {tAgenda("completedSection.title")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {tAgenda("completedSection.description")}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {completedItems.map((item) => (
              <OperatorAgendaTaskCard
                key={item.taskId}
                item={item}
                locale={locale}
                translations={getCardTranslations(item)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
