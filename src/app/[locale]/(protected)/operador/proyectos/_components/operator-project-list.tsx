import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import type {
  OperatorOwnWorkProject,
  OperatorUrgencyCategory,
} from "@/lib/operator/queries";
import {
  FolderKanban,
  ArrowRight,
  Clock,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  CheckCircle,
  CircleDot,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface OperatorProjectListProps {
  projects: OperatorOwnWorkProject[];
  locale: string;
}

const CATEGORY_ICON_MAP: Record<OperatorUrgencyCategory, LucideIcon> = {
  new: Sparkles,
  normal: CircleDot,
  upcoming: Clock,
  urgent: AlertCircle,
  overdue: AlertTriangle,
  completed: CheckCircle,
};

const CATEGORY_COLOR_MAP: Record<OperatorUrgencyCategory, string> = {
  new: "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60",
  normal:
    "text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900/60",
  upcoming: "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/60",
  urgent:
    "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60",
  overdue: "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/60",
  completed:
    "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-950/60",
};

export async function OperatorProjectList({
  projects,
  locale,
}: OperatorProjectListProps) {
  const tProjects = await getTranslations("projects.operatorProjects");
  const tAgenda = await getTranslations("projects.operatorAgenda");

  return (
    <div
      className="grid gap-4 sm:grid-cols-2"
      data-testid="operator-project-list"
    >
      {projects.map((proj) => {
        const formattedDeadline = proj.nearestDeadline
          ? new Date(proj.nearestDeadline).toLocaleDateString(
              locale === "es" || locale === "es-MX" ? "es-MX" : "en-US",
              { month: "short", day: "numeric" },
            )
          : null;

        return (
          <article
            key={proj.projectId}
            data-testid="operator-project-card"
            data-project-id={proj.projectId}
            className="group flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:border-primary/50 hover:shadow-md"
          >
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FolderKanban className="size-5" aria-hidden="true" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground tracking-tight group-hover:text-primary transition-colors">
                    {proj.projectName}
                  </h3>
                </div>
              </div>

              {/* Own tasks count */}
              <div className="mt-3">
                <p className="text-sm font-medium text-foreground">
                  {tProjects("card.ownTaskCount", {
                    count: proj.ownTaskCount.toString(),
                  })}
                </p>
              </div>

              {/* Urgency indicators in this project */}
              {proj.urgencyCategories.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {proj.urgencyCategories.map((cat) => {
                    const Icon = CATEGORY_ICON_MAP[cat];
                    const colorClass = CATEGORY_COLOR_MAP[cat];
                    const label = tAgenda(`urgency.${cat}`);
                    return (
                      <span
                        key={cat}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}
                      >
                        <Icon className="size-3 shrink-0" aria-hidden="true" />
                        <span>{label}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
              {formattedDeadline ? (
                <span>
                  {tProjects("card.nearestDeadline", {
                    date: formattedDeadline,
                  })}
                </span>
              ) : (
                <span />
              )}

              <Link
                href={`/operador/proyectos/${proj.projectId}`}
                aria-label={tProjects("card.openProjectAria", {
                  projectName: proj.projectName,
                })}
                className="inline-flex min-h-[44px] min-w-[44px] items-center gap-1 font-medium text-primary hover:underline"
              >
                <span>
                  {tProjects("card.openProjectAria", {
                    projectName: proj.projectName,
                  })}
                </span>
                <ArrowRight
                  className="size-3.5 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
