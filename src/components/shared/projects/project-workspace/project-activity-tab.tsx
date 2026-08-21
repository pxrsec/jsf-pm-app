"use client";

import { useTranslations, useFormatter } from "next-intl";
import { Activity, Clock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ProjectCompletionCyclesView } from "@/lib/projects/queries";

interface ProjectActivityTabProps {
  cycles: ProjectCompletionCyclesView[];
}

export function ProjectActivityTab({ cycles }: ProjectActivityTabProps) {
  const t = useTranslations("projects.workspace.activity");
  const format = useFormatter();

  const cycleList = cycles || [];

  if (cycleList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-border/80 bg-muted/10 space-y-3">
        <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
          <Activity className="size-6" />
        </div>
        <div className="space-y-1 max-w-sm">
          <h3 className="text-base font-semibold text-foreground">
            {t("emptyTitle")}
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("emptyDescription")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-border bg-card">
        <CardHeader className="pb-3 border-b border-border/60">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="size-4 text-primary" />
            <span>{t("tabTitle")}</span>
          </CardTitle>
          <p className="text-xs text-muted-foreground">{t("description")}</p>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {cycleList.map((cycle) => {
            const completedDate = cycle.completed_at
              ? format.dateTime(new Date(cycle.completed_at), {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : null;

            const reopenedDate = cycle.reopened_at
              ? format.dateTime(new Date(cycle.reopened_at), {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : null;

            return (
              <div
                key={cycle.cycle_number}
                className="rounded-xl border border-border bg-muted/20 p-4 space-y-3 shadow-2xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">
                      {t("cycleTitle", { number: String(cycle.cycle_number) })}
                    </span>
                    {cycle.cycle_duration_days !== null &&
                      cycle.cycle_duration_days !== undefined && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="size-3" />
                          <span>
                            {t("duration", {
                              days: cycle.cycle_duration_days,
                            })}
                          </span>
                        </span>
                      )}
                  </div>

                  {reopenedDate ? (
                    <Badge variant="outline" className="text-xs font-normal">
                      {t("reopenedOn", { date: reopenedDate })}
                    </Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="text-xs bg-green-500/10 text-green-700 dark:text-green-300 font-medium"
                    >
                      {t("activeCycleBadge")}
                    </Badge>
                  )}
                </div>

                <div className="space-y-1 text-xs text-muted-foreground">
                  {completedDate && (
                    <p>{t("completedOn", { date: completedDate })}</p>
                  )}
                  {(cycle.override_confirmed ||
                    (cycle.unfinished_task_count !== null &&
                      cycle.unfinished_task_count > 0)) && (
                    <div className="pt-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                        {t("unfinishedOverride")}
                      </span>
                    </div>
                  )}
                </div>

                {cycle.reopen_reason && (
                  <p className="text-xs text-foreground/90 bg-muted/50 p-2.5 rounded-lg border border-border/50">
                    {t("reopenReason", { reason: cycle.reopen_reason })}
                  </p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
