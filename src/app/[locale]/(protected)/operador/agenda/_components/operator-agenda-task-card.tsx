import type {
  OperatorAgendaItem,
  OperatorUrgencyCategory,
} from "@/lib/operator/queries";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { TASK_STATUS_MAP, TASK_PRIORITY_MAP } from "@/lib/status-maps";
import {
  Sparkles,
  CircleDot,
  Clock,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Folder,
  Package,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface OperatorAgendaTaskCardProps {
  item: OperatorAgendaItem;
  locale: string;
  translations: {
    urgencyLabel: string;
    urgencyAria: string;
    statusLabel: string;
    priorityLabel: string;
    deliverablesCount: string;
    assignedAtLabel: string;
    deadlineAtLabel: string;
    completedAtLabel: string;
    viewProjectAria: string;
    openTaskAria?: string;
  };
}

const URGENCY_CONFIG: Record<
  OperatorUrgencyCategory,
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
        hour: "2-digit",
        minute: "2-digit",
      },
    );
  } catch {
    return dateStr;
  }
}

export function OperatorAgendaTaskCard({
  item,
  locale,
  translations,
}: OperatorAgendaTaskCardProps) {
  const urgencyConfig = URGENCY_CONFIG[item.urgencyCategory];
  const UrgencyIcon = urgencyConfig.icon;

  const statusConfig = TASK_STATUS_MAP[item.taskStatus];
  const StatusIcon = statusConfig?.icon ?? CircleDot;

  const priorityConfig = TASK_PRIORITY_MAP[item.taskPriority];

  const formattedDeadline = item.taskDeadlineAt
    ? formatDisplayDate(item.taskDeadlineAt, locale)
    : null;
  const formattedAssigned = item.assignedAt
    ? formatDisplayDate(item.assignedAt, locale)
    : null;

  return (
    <article
      data-testid="operator-task-card"
      data-task-id={item.taskId}
      data-urgency={item.urgencyCategory}
      className={cn(
        "rounded-lg border bg-card p-4 shadow-sm transition-all duration-200",
        item.urgencyCategory === "completed"
          ? "border-border/60 bg-muted/30 opacity-80"
          : "border-border hover:border-border/80 hover:shadow",
      )}
    >
      <div className="flex flex-col gap-3">
        {/* Top badges: Urgency, Status, Priority */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Urgency Badge */}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0",
              urgencyConfig.badgeBg,
              urgencyConfig.badgeFg,
            )}
            role="status"
            aria-label={translations.urgencyAria}
          >
            <UrgencyIcon className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{translations.urgencyLabel}</span>
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
              <span>{translations.statusLabel}</span>
            </span>
          )}

          {/* Priority (if high or blocking) */}
          {priorityConfig &&
            (item.taskPriority === "high" ||
              item.taskPriority === "blocking") && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0",
                  priorityConfig.badgeBg,
                  priorityConfig.badgeFg,
                )}
              >
                <span>{translations.priorityLabel}</span>
              </span>
            )}
        </div>

        {/* Task Title & Project */}
        <div>
          <h3 className="text-base font-semibold text-foreground tracking-tight">
            <Link
              href={`/operador/tareas/${item.taskId}`}
              aria-label={translations.openTaskAria ?? item.taskTitle}
              className="hover:text-primary transition-colors underline-offset-4 hover:underline"
            >
              {item.taskTitle}
            </Link>
          </h3>

          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Folder className="size-3.5 shrink-0" aria-hidden="true" />
            <Link
              href={`/operador/proyectos/${item.projectId}`}
              aria-label={translations.viewProjectAria}
              className="font-medium text-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
            >
              {item.projectName}
            </Link>
          </div>
        </div>

        {/* Description (compact & conditional) */}
        {item.taskDescription && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {item.taskDescription}
          </p>
        )}

        {/* Footer info: deliverables & deadlines */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60 text-xs text-muted-foreground">
          {item.deliverables.length > 0 ? (
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <Package
                className="size-3.5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              {translations.deliverablesCount}
            </span>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-3">
            {item.urgencyCategory === "new" && formattedAssigned && (
              <span>{translations.assignedAtLabel}</span>
            )}
            {item.urgencyCategory !== "completed" && formattedDeadline && (
              <span className="font-medium text-foreground">
                {translations.deadlineAtLabel}
              </span>
            )}
            {item.urgencyCategory === "completed" && formattedDeadline && (
              <span>{translations.completedAtLabel}</span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
