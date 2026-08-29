"use client";

import { useTranslations, useFormatter } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MilestoneSummaryDto } from "@/lib/calendar/types";

interface ProjectMilestoneTimelineProps {
  milestones: readonly MilestoneSummaryDto[];
  canManageMilestones: boolean;
  onOpenCalendar: () => void;
  onOpenMilestone: (milestoneId: string) => void;
}

function dateValue(targetDate: string) {
  return new Date(`${targetDate}T12:00:00`);
}

export function ProjectMilestoneTimeline({
  milestones,
  canManageMilestones,
  onOpenCalendar,
  onOpenMilestone,
}: ProjectMilestoneTimelineProps) {
  const t = useTranslations("projects.workspace.overview.timeline");
  const format = useFormatter();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const local = milestones.filter((milestone) => milestone.scope === "project");
  const company = milestones.filter(
    (milestone) => milestone.scope === "company",
  );
  const orderedLocal = [...local].sort((a, b) => {
    const aOverdue = dateValue(a.targetDate) < today;
    const bOverdue = dateValue(b.targetDate) < today;
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
    return (
      a.targetDate.localeCompare(b.targetDate) || a.title.localeCompare(b.title)
    );
  });
  const completedLocal = local.filter(
    (milestone) =>
      milestone.activeTaskCount > 0 &&
      milestone.completedTaskCount === milestone.activeTaskCount,
  ).length;
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);
  const dueThisWeek = local.filter((milestone) => {
    const date = dateValue(milestone.targetDate);
    return date >= today && date <= weekEnd;
  }).length;

  const progress = (milestone: MilestoneSummaryDto) =>
    milestone.activeTaskCount === 0
      ? t("untracked")
      : t("progress", {
          completed: milestone.completedTaskCount,
          total: milestone.activeTaskCount,
          percent: Math.round(
            (milestone.completedTaskCount / milestone.activeTaskCount) * 100,
          ),
        });

  const rows = (
    items: readonly MilestoneSummaryDto[],
    scope: "project" | "company",
  ) =>
    items.map((milestone) => (
      <Button
        key={milestone.milestoneId}
        type="button"
        variant="outline"
        className="min-h-11 h-auto w-full justify-between gap-3 whitespace-normal p-3 text-left"
        onClick={() => onOpenMilestone(milestone.milestoneId)}
      >
        <span className="min-w-0">
          <span className="block truncate font-medium">{milestone.title}</span>
          <span className="block text-xs text-muted-foreground">
            {scope === "company" ? t("companyScope") : t("projectScope")} ·{" "}
            {format.dateTime(dateValue(milestone.targetDate), {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {progress(milestone)}
        </span>
      </Button>
    ));

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{t("title")}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {t("summary", {
            count: local.length,
            completed: completedLocal,
            due: dueThisWeek,
          })}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {orderedLocal.length > 0 ? (
          rows(orderedLocal.slice(0, 5), "project")
        ) : (
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        )}
        {orderedLocal.length === 0 && canManageMilestones && (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={onOpenCalendar}
          >
            {t("create")}
          </Button>
        )}
        <Button
          type="button"
          variant="link"
          className="min-h-11 px-0"
          onClick={onOpenCalendar}
        >
          {t("viewCalendar")}
        </Button>
        {company.length > 0 && (
          <section
            className="space-y-2 border-t border-border pt-3"
            aria-labelledby="company-goals-heading"
          >
            <h3 id="company-goals-heading" className="text-sm font-semibold">
              {t("companyContributions")}
            </h3>
            {rows(company, "company")}
          </section>
        )}
      </CardContent>
    </Card>
  );
}
