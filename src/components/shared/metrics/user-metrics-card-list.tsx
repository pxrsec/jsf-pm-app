"use client";

import { useLocale, useTranslations } from "next-intl";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UserOperationsMetricDto } from "@/lib/user-operations-metrics/types";
import {
  formatMetricCount,
  formatMetricHours,
  formatMetricTimestamp,
} from "./user-metrics-sort-utils";

interface UserMetricsCardListProps {
  users: readonly UserOperationsMetricDto[];
  selectedUserId?: string;
  onSelectUser: (userId: string) => void;
}

export function UserMetricsCardList({
  users,
  selectedUserId,
  onSelectUser,
}: UserMetricsCardListProps) {
  const locale = useLocale();
  const tTable = useTranslations("metrics.userAudit.table");
  const tRoles = useTranslations("metrics.userAudit.roles");
  const tStates = useTranslations("metrics.userAudit.states");
  const tActions = useTranslations("metrics.userAudit.actions");

  const noDataLabel = tStates("noMeasuredObservations");
  const noActionLabel = tStates("noRecordedAction");
  const hoursUnit = tTable("hoursUnit");

  return (
    <div className="space-y-4">
      {users.map((user) => {
        const isSelected = user.userId === selectedUserId;

        return (
          <div
            key={user.userId}
            className={`rounded-xl border p-4 shadow-sm space-y-3.5 transition-colors ${
              isSelected
                ? "bg-primary/5 border-primary/40 ring-1 ring-primary/20"
                : "bg-card border-border"
            }`}
          >
            {/* Header: User name, role badge, active state */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {user.fullName}
                  {isSelected && (
                    <span className="sr-only">
                      {" "}
                      ({tStates("detailsShownBelow")})
                    </span>
                  )}
                </h3>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-muted text-muted-foreground border border-border">
                  {tRoles(user.applicationRole)}
                </span>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium border ${
                    user.isActive
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20"
                  }`}
                >
                  {user.isActive ? tStates("active") : tStates("inactive")}
                </span>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">
                  {tTable("currentTasks")}:
                </span>
                <span className="font-medium text-foreground">
                  {formatMetricCount(user.currentActiveTaskCount, locale)}
                </span>
              </div>

              <div>
                <span className="text-muted-foreground block text-[11px]">
                  {tTable("unstartedEnd")}:
                </span>
                <span
                  className={
                    user.unstartedTaskCountAtRangeEnd > 0
                      ? "font-semibold text-amber-600 dark:text-amber-400"
                      : "font-medium text-foreground"
                  }
                >
                  {formatMetricCount(user.unstartedTaskCountAtRangeEnd, locale)}
                </span>
              </div>

              <div>
                <span className="text-muted-foreground block text-[11px]">
                  {tTable("completionsRecorded")}:
                </span>
                <span className="font-medium text-foreground">
                  {formatMetricCount(user.taskCompletedCount, locale)}
                </span>
              </div>

              <div>
                <span className="text-muted-foreground block text-[11px]">
                  {tTable("avgStartHours")}:
                </span>
                <span className="font-medium text-muted-foreground">
                  {formatMetricHours(
                    user.averageAssignmentToStartHours,
                    locale,
                    noDataLabel,
                    hoursUnit,
                  )}
                </span>
              </div>

              <div>
                <span className="text-muted-foreground block text-[11px]">
                  {tTable("unread24h")}:
                </span>
                <span
                  className={
                    user.inAppNotificationUnreadOver24hCountAtRangeEnd > 0
                      ? "font-semibold text-amber-600 dark:text-amber-400"
                      : "font-medium text-foreground"
                  }
                >
                  {formatMetricCount(
                    user.inAppNotificationUnreadOver24hCountAtRangeEnd,
                    locale,
                  )}
                </span>
              </div>

              <div>
                <span className="text-muted-foreground block text-[11px]">
                  {tTable("lastAction")}:
                </span>
                <span className="font-medium text-muted-foreground text-[11px]">
                  {formatMetricTimestamp(
                    user.lastWorkflowActionAt,
                    locale,
                    noActionLabel,
                  )}
                </span>
              </div>
            </div>

            {/* Action Button: 44px min target */}
            <div className="pt-2 border-t border-border/50 flex justify-end">
              <Button
                type="button"
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={() => onSelectUser(user.userId)}
                aria-label={tActions("viewDetailsAria", {
                  name: user.fullName,
                })}
                className="w-full sm:w-auto min-h-[44px] text-xs font-medium gap-1.5"
              >
                <Eye className="h-4 w-4" aria-hidden="true" />
                <span>{tActions("viewDetails")}</span>
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
