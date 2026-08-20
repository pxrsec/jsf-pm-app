"use client";

import { useTranslations, useFormatter } from "next-intl";
import { History } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ProjectCompletionCyclesView } from "@/lib/projects/queries";

interface CompletionCyclesCardProps {
  cycles: ProjectCompletionCyclesView[];
}

export function CompletionCyclesCard({ cycles }: CompletionCyclesCardProps) {
  const tOverview = useTranslations("projects.workspace.overview");
  const format = useFormatter();

  if (cycles.length === 0) return null;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
          <History className="h-4 w-4 text-muted-foreground" />
          <span>{tOverview("completionCyclesTitle")}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        {cycles.map((cycle) => {
          const completedDate = cycle.completed_at
            ? format.dateTime(new Date(cycle.completed_at), {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : null;
          const reopenedDate = cycle.reopened_at
            ? format.dateTime(new Date(cycle.reopened_at), {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : null;

          return (
            <div
              key={cycle.cycle_number}
              className="rounded-md border border-border bg-muted/20 p-2.5 space-y-1.5"
            >
              <div className="flex items-center justify-between font-semibold">
                <span>
                  {tOverview("cycleNumber", {
                    number: String(cycle.cycle_number),
                  })}
                </span>
                {reopenedDate ? (
                  <Badge variant="outline" className="text-[10px] font-normal">
                    {tOverview("reopenedOn", { date: reopenedDate })}
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="text-[10px] bg-green-500/10 text-green-700 dark:text-green-300 font-medium"
                  >
                    {tOverview("cycleActiveBadge")}
                  </Badge>
                )}
              </div>

              <div className="space-y-0.5 text-muted-foreground text-[11px]">
                {completedDate && (
                  <p>{tOverview("completedOn", { date: completedDate })}</p>
                )}
                {cycle.cycle_duration_days !== null &&
                  cycle.cycle_duration_days !== undefined && (
                    <p>
                      {tOverview("cycleDuration", {
                        days: cycle.cycle_duration_days,
                      })}
                    </p>
                  )}
                {(cycle.override_confirmed ||
                  (cycle.unfinished_task_count !== null &&
                    cycle.unfinished_task_count > 0)) && (
                  <div className="pt-0.5">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                      {tOverview("unfinishedOverrideBadge")}
                    </span>
                  </div>
                )}
              </div>

              {cycle.reopen_reason && (
                <p className="text-foreground/80 text-[11px] italic bg-muted/40 p-1.5 rounded border border-border/50">
                  {tOverview("reopenReason", {
                    reason: cycle.reopen_reason,
                  })}
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
