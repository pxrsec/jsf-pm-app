"use client";

import { useLocale, useTranslations } from "next-intl";
import { X, Clock, FileCheck, Bell, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UserOperationsMetricDto } from "@/lib/user-operations-metrics/types";
import {
  formatMetricCount,
  formatMetricHours,
  formatMetricTimestamp,
} from "./user-metrics-sort-utils";

interface UserMetricsDetailPanelProps {
  user: UserOperationsMetricDto;
  onClose: () => void;
}

export function UserMetricsDetailPanel({
  user,
  onClose,
}: UserMetricsDetailPanelProps) {
  const locale = useLocale();
  const tDetail = useTranslations("metrics.userAudit.detail");
  const tTable = useTranslations("metrics.userAudit.table");
  const tRoles = useTranslations("metrics.userAudit.roles");
  const tStates = useTranslations("metrics.userAudit.states");
  const tActions = useTranslations("metrics.userAudit.actions");

  const noDataLabel = tStates("noMeasuredObservations");
  const noActionLabel = tStates("noRecordedAction");
  const hoursUnit = tTable("hoursUnit");

  return (
    <section
      role="region"
      aria-labelledby="user-detail-heading"
      className="rounded-xl border border-primary/30 bg-card p-5 sm:p-6 shadow-md space-y-6 animate-in fade-in duration-200"
    >
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 pb-4">
        <div className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            {tDetail("sectionLabel")}
          </span>
          <h3
            id="user-detail-heading"
            className="text-lg font-bold text-foreground"
          >
            {user.fullName}
          </h3>
          <div className="flex items-center gap-2 pt-0.5">
            <span className="inline-block px-2.5 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground border border-border">
              {tRoles(user.applicationRole)}
            </span>
            <span
              className={`inline-block px-2.5 py-0.5 rounded text-xs font-medium border ${
                user.isActive
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20"
              }`}
            >
              {user.isActive ? tStates("active") : tStates("inactive")}
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          aria-label={tActions("closeDetailsAria")}
          className="min-h-[44px] px-3 text-xs font-medium gap-1.5"
        >
          <X className="h-4 w-4" aria-hidden="true" />
          <span>{tActions("closeDetails")}</span>
        </Button>
      </div>

      {/* Detail Breakdown Sections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* 1. Task Execution & Responsiveness */}
        <div className="rounded-lg border border-border/80 bg-muted/20 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground">
            <Clock className="h-4 w-4 text-primary" aria-hidden="true" />
            <h4>{tDetail("taskExecutionHeading")}</h4>
          </div>
          <dl className="space-y-2 text-xs divide-y divide-border/40">
            <div className="flex justify-between pt-1.5">
              <dt className="text-muted-foreground">
                {tTable("currentTasks")}:
              </dt>
              <dd className="font-semibold text-foreground">
                {formatMetricCount(user.currentActiveTaskCount, locale)}
              </dd>
            </div>
            <div className="flex justify-between pt-1.5">
              <dt className="text-muted-foreground">
                {tTable("assignedInRange")}:
              </dt>
              <dd className="font-semibold text-foreground">
                {formatMetricCount(user.taskAssignedCount, locale)}
              </dd>
            </div>
            <div className="flex justify-between pt-1.5">
              <dt className="text-muted-foreground">
                {tTable("startsRecorded")}:
              </dt>
              <dd className="font-semibold text-foreground">
                {formatMetricCount(user.taskStartedCount, locale)}
              </dd>
            </div>
            <div className="flex justify-between pt-1.5">
              <dt className="text-muted-foreground">
                {tTable("completionsRecorded")}:
              </dt>
              <dd className="font-semibold text-foreground">
                {formatMetricCount(user.taskCompletedCount, locale)}
              </dd>
            </div>
            <div className="flex justify-between pt-1.5">
              <dt className="text-muted-foreground">
                {tTable("avgStartHours")}:
              </dt>
              <dd className="font-medium text-foreground">
                {formatMetricHours(
                  user.averageAssignmentToStartHours,
                  locale,
                  noDataLabel,
                  hoursUnit,
                )}
              </dd>
            </div>
            <div className="flex justify-between pt-1.5">
              <dt className="text-muted-foreground">
                {tTable("unstartedEnd")}:
              </dt>
              <dd
                className={
                  user.unstartedTaskCountAtRangeEnd > 0
                    ? "font-bold text-amber-600 dark:text-amber-400"
                    : "font-semibold text-foreground"
                }
              >
                {formatMetricCount(user.unstartedTaskCountAtRangeEnd, locale)}
              </dd>
            </div>
          </dl>
        </div>

        {/* 2. Deliverables & Review Decisions */}
        <div className="rounded-lg border border-border/80 bg-muted/20 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground">
            <FileCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            <h4>{tDetail("deliverablesHeading")}</h4>
          </div>
          <dl className="space-y-2 text-xs divide-y divide-border/40">
            <div className="flex justify-between pt-1.5">
              <dt className="text-muted-foreground">
                {tTable("prodSubmissions")}:
              </dt>
              <dd className="font-semibold text-foreground">
                {formatMetricCount(
                  user.productionDeliverableSubmissionCount,
                  locale,
                )}
              </dd>
            </div>
            <div className="flex justify-between pt-1.5">
              <dt className="text-muted-foreground">
                {tTable("clientSubmissions")}:
              </dt>
              <dd className="font-semibold text-foreground">
                {formatMetricCount(user.clientSubmissionCount, locale)}
              </dd>
            </div>
            <div className="flex justify-between pt-1.5">
              <dt className="text-muted-foreground">
                {tTable("reviewsRecorded")}:
              </dt>
              <dd className="font-semibold text-foreground">
                {formatMetricCount(user.deliverableReviewCount, locale)}
              </dd>
            </div>
            <div className="flex justify-between pt-1.5">
              <dt className="text-muted-foreground">
                {tTable("deliveredHandoffs")}:
              </dt>
              <dd className="font-semibold text-foreground">
                {formatMetricCount(user.deliverableDeliveredCount, locale)}
              </dd>
            </div>
          </dl>
        </div>

        {/* 3. In-App Notification Responsiveness */}
        <div className="rounded-lg border border-border/80 bg-muted/20 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground">
            <Bell className="h-4 w-4 text-primary" aria-hidden="true" />
            <h4>{tDetail("notificationsHeading")}</h4>
          </div>
          <dl className="space-y-2 text-xs divide-y divide-border/40">
            <div className="flex justify-between pt-1.5">
              <dt className="text-muted-foreground">
                {tTable("inAppReceived")}:
              </dt>
              <dd className="font-semibold text-foreground">
                {formatMetricCount(user.inAppNotificationReceivedCount, locale)}
              </dd>
            </div>
            <div className="flex justify-between pt-1.5">
              <dt className="text-muted-foreground">{tTable("markedRead")}:</dt>
              <dd className="font-semibold text-foreground">
                {formatMetricCount(user.inAppNotificationReadCount, locale)}
              </dd>
            </div>
            <div className="flex justify-between pt-1.5">
              <dt className="text-muted-foreground">{tTable("unreadEnd")}:</dt>
              <dd className="font-semibold text-foreground">
                {formatMetricCount(
                  user.inAppNotificationUnreadCountAtRangeEnd,
                  locale,
                )}
              </dd>
            </div>
            <div className="flex justify-between pt-1.5">
              <dt className="text-muted-foreground">{tTable("unread24h")}:</dt>
              <dd
                className={
                  user.inAppNotificationUnreadOver24hCountAtRangeEnd > 0
                    ? "font-bold text-amber-600 dark:text-amber-400"
                    : "font-semibold text-foreground"
                }
              >
                {formatMetricCount(
                  user.inAppNotificationUnreadOver24hCountAtRangeEnd,
                  locale,
                )}
              </dd>
            </div>
            <div className="flex justify-between pt-1.5">
              <dt className="text-muted-foreground">
                {tTable("avgReadHours")}:
              </dt>
              <dd className="font-medium text-foreground">
                {formatMetricHours(
                  user.averageInAppNotificationReadHours,
                  locale,
                  noDataLabel,
                  hoursUnit,
                )}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Activity Timeline Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/60 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Activity
            className="h-4 w-4 text-primary shrink-0"
            aria-hidden="true"
          />
          <span>{tDetail("lastActionLabel")}:</span>
          <span className="font-medium text-foreground">
            {formatMetricTimestamp(
              user.lastWorkflowActionAt,
              locale,
              noActionLabel,
            )}
          </span>
        </div>
      </div>
    </section>
  );
}
