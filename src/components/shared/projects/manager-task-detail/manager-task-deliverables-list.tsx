"use client";

import { useTranslations, useFormatter } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeliverableStatusBadge } from "@/components/shared/projects/project-deliverables/deliverable-status-badge";
import type { ManagerTaskDeliverableSummary } from "@/lib/projects/manager-task-queries";
import { Calendar, Eye, Loader2 } from "lucide-react";

interface ManagerTaskDeliverablesListProps {
  deliverables: ManagerTaskDeliverableSummary[];
  onSelectDeliverable: (deliverableId: string) => void;
  selectedDeliverableId?: string | null;
  isLoadingDetail?: boolean;
}

export function ManagerTaskDeliverablesList({
  deliverables,
  onSelectDeliverable,
  selectedDeliverableId,
  isLoadingDetail = false,
}: ManagerTaskDeliverablesListProps) {
  const t = useTranslations("projects.managerTask");
  const tDeliverables = useTranslations("projects.workspace.deliverables");
  const format = useFormatter();

  if (deliverables.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center">
        <p className="text-sm text-muted-foreground">{t("noDeliverables")}</p>
      </div>
    );
  }

  const getInitials = (name?: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <ul className="space-y-3">
      {deliverables.map((d) => {
        const isSelected = selectedDeliverableId === d.id;
        const isCurrentLoading = isSelected && isLoadingDetail;

        return (
          <li
            key={d.id}
            className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-border/80 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-foreground text-sm truncate">
                  {d.title}
                </h3>
                <Badge variant="outline" className="text-xs">
                  {tDeliverables(`workflows.${d.workflowType}`)}
                </Badge>
                <DeliverableStatusBadge status={d.status} />
                <Badge variant="secondary" className="text-xs font-mono">
                  {t("versionIndicator", {
                    version: d.currentVersionNumber,
                  })}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                {/* Assignee */}
                <div className="flex items-center gap-1.5">
                  <div className="size-4 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[9px] shrink-0">
                    {getInitials(d.assignee?.full_name)}
                  </div>
                  <span className="truncate max-w-[140px]">
                    {d.assignee?.full_name ?? tDeliverables("unassigned")}
                  </span>
                </div>

                {/* Deadlines */}
                {d.submissionDeadlineAt && (
                  <div className="flex items-center gap-1">
                    <Calendar className="size-3.5" aria-hidden="true" />
                    <span>
                      {t("submissionDeadline", {
                        date: format.dateTime(
                          new Date(d.submissionDeadlineAt),
                          {
                            month: "short",
                            day: "numeric",
                          },
                        ),
                      })}
                    </span>
                  </div>
                )}
                {d.internalReviewDeadlineAt && (
                  <div className="flex items-center gap-1">
                    <Calendar className="size-3.5" aria-hidden="true" />
                    <span>
                      {t("internalReviewDeadline", {
                        date: format.dateTime(
                          new Date(d.internalReviewDeadlineAt),
                          {
                            month: "short",
                            day: "numeric",
                          },
                        ),
                      })}
                    </span>
                  </div>
                )}
                {d.clientDeliveryDeadlineAt && (
                  <div className="flex items-center gap-1">
                    <Calendar className="size-3.5" aria-hidden="true" />
                    <span>
                      {t("clientDeliveryDeadline", {
                        date: format.dateTime(
                          new Date(d.clientDeliveryDeadlineAt),
                          {
                            month: "short",
                            day: "numeric",
                          },
                        ),
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 pt-2 sm:pt-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSelectDeliverable(d.id)}
                disabled={isCurrentLoading}
                aria-label={t("openDeliverableDetailAria", { title: d.title })}
                className="w-full sm:w-auto"
              >
                {isCurrentLoading ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : (
                  <Eye className="mr-1.5 size-3.5" aria-hidden="true" />
                )}
                {t("openDeliverableDetail")}
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
