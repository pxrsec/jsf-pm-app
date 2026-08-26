"use client";

import { useLocale, useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ArrowUpDown, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  SortDirection,
  UserOperationsMetricDto,
  UserOperationsSortField,
} from "@/lib/user-operations-metrics/types";
import {
  formatMetricCount,
  formatMetricHours,
  formatMetricTimestamp,
} from "./user-metrics-sort-utils";

interface UserMetricsTableProps {
  users: readonly UserOperationsMetricDto[];
  selectedUserId?: string;
  sortField: UserOperationsSortField | null;
  sortDirection: SortDirection;
  onSortChange: (field: UserOperationsSortField) => void;
  onSelectUser: (userId: string) => void;
}

export function UserMetricsTable({
  users,
  selectedUserId,
  sortField,
  sortDirection,
  onSortChange,
  onSelectUser,
}: UserMetricsTableProps) {
  const locale = useLocale();
  const tTable = useTranslations("metrics.userAudit.table");
  const tSorting = useTranslations("metrics.userAudit.sorting");
  const tRoles = useTranslations("metrics.userAudit.roles");
  const tStates = useTranslations("metrics.userAudit.states");
  const tActions = useTranslations("metrics.userAudit.actions");

  const noDataLabel = tStates("noMeasuredObservations");
  const noActionLabel = tStates("noRecordedAction");
  const hoursUnit = tTable("hoursUnit");

  const renderSortHeader = (field: UserOperationsSortField, label: string) => {
    const isActive = sortField === field;
    const ariaSortValue = isActive
      ? sortDirection === "asc"
        ? "ascending"
        : "descending"
      : undefined;

    const accessibleSortLabel = isActive
      ? sortDirection === "asc"
        ? tSorting("sortedAscendingBy", { column: label })
        : tSorting("sortedDescendingBy", { column: label })
      : tSorting("sortBy", { column: label });

    return (
      <th
        scope="col"
        aria-sort={ariaSortValue}
        className="px-3 py-2 text-left text-xs font-semibold text-foreground whitespace-nowrap"
      >
        <button
          type="button"
          onClick={() => onSortChange(field)}
          aria-label={accessibleSortLabel}
          className="group inline-flex items-center gap-1.5 min-h-[44px] px-1 -ml-1 text-xs font-semibold text-foreground hover:text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
        >
          <span>{label}</span>
          <span className="text-muted-foreground group-hover:text-primary transition-colors">
            {isActive ? (
              sortDirection === "asc" ? (
                <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
              )
            ) : (
              <ArrowUpDown
                className="h-3.5 w-3.5 opacity-40 group-hover:opacity-100"
                aria-hidden="true"
              />
            )}
          </span>
        </button>
      </th>
    );
  };

  const renderPlainHeader = (label: string) => (
    <th
      scope="col"
      className="px-3 py-2 text-left text-xs font-semibold text-foreground whitespace-nowrap"
    >
      <span className="inline-flex items-center min-h-[44px]">{label}</span>
    </th>
  );

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse min-w-[1100px]">
          <caption className="sr-only">{tTable("caption")}</caption>
          <thead>
            <tr className="border-b border-border bg-muted/40">
              {renderSortHeader("name", tTable("user"))}
              {renderSortHeader("role", tTable("role"))}
              {renderPlainHeader(tTable("activeState"))}
              {renderSortHeader(
                "currentActiveTaskCount",
                tTable("currentTasks"),
              )}
              {renderPlainHeader(tTable("assignedInRange"))}
              {renderPlainHeader(tTable("startsRecorded"))}
              {renderSortHeader(
                "taskCompletedCount",
                tTable("completionsRecorded"),
              )}
              {renderSortHeader(
                "averageAssignmentToStartHours",
                tTable("avgStartHours"),
              )}
              {renderSortHeader(
                "unstartedTaskCountAtRangeEnd",
                tTable("unstartedEnd"),
              )}
              {renderPlainHeader(tTable("prodSubmissions"))}
              {renderPlainHeader(tTable("clientSubmissions"))}
              {renderSortHeader(
                "deliverableReviewCount",
                tTable("reviewsRecorded"),
              )}
              {renderPlainHeader(tTable("deliveredHandoffs"))}
              {renderPlainHeader(tTable("inAppReceived"))}
              {renderPlainHeader(tTable("markedRead"))}
              {renderPlainHeader(tTable("unreadEnd"))}
              {renderSortHeader(
                "inAppNotificationUnreadOver24hCountAtRangeEnd",
                tTable("unread24h"),
              )}
              {renderSortHeader(
                "averageInAppNotificationReadHours",
                tTable("avgReadHours"),
              )}
              {renderSortHeader("lastWorkflowActionAt", tTable("lastAction"))}
              <th
                scope="col"
                className="px-3 py-2 text-right text-xs font-semibold text-foreground whitespace-nowrap"
              >
                <span className="inline-flex items-center justify-end min-h-[44px]">
                  {tTable("actions")}
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {users.map((user) => {
              const isSelected = user.userId === selectedUserId;

              return (
                <tr
                  key={user.userId}
                  className={`transition-colors ${
                    isSelected
                      ? "bg-primary/10 font-medium border-l-4 border-l-primary"
                      : "hover:bg-muted/30"
                  }`}
                >
                  {/* User Full Name */}
                  <td className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap">
                    {user.fullName}
                    {isSelected && (
                      <span className="sr-only">
                        {" "}
                        ({tStates("detailsShownBelow")})
                      </span>
                    )}
                  </td>

                  {/* Role */}
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-muted text-muted-foreground border border-border">
                      {tRoles(user.applicationRole)}
                    </span>
                  </td>

                  {/* Active State */}
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium border ${
                        user.isActive
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20"
                      }`}
                    >
                      {user.isActive ? tStates("active") : tStates("inactive")}
                    </span>
                  </td>

                  {/* Current Active Tasks */}
                  <td className="px-3 py-2.5 text-foreground whitespace-nowrap">
                    {formatMetricCount(user.currentActiveTaskCount, locale)}
                  </td>

                  {/* Assigned in Range */}
                  <td className="px-3 py-2.5 text-foreground whitespace-nowrap">
                    {formatMetricCount(user.taskAssignedCount, locale)}
                  </td>

                  {/* Starts Recorded */}
                  <td className="px-3 py-2.5 text-foreground whitespace-nowrap">
                    {formatMetricCount(user.taskStartedCount, locale)}
                  </td>

                  {/* Completions Recorded */}
                  <td className="px-3 py-2.5 text-foreground whitespace-nowrap">
                    {formatMetricCount(user.taskCompletedCount, locale)}
                  </td>

                  {/* Avg Assignment -> Start Hours */}
                  <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                    {formatMetricHours(
                      user.averageAssignmentToStartHours,
                      locale,
                      noDataLabel,
                      hoursUnit,
                    )}
                  </td>

                  {/* Unstarted by Range End */}
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span
                      className={
                        user.unstartedTaskCountAtRangeEnd > 0
                          ? "font-semibold text-amber-600 dark:text-amber-400"
                          : "text-foreground"
                      }
                    >
                      {formatMetricCount(
                        user.unstartedTaskCountAtRangeEnd,
                        locale,
                      )}
                    </span>
                  </td>

                  {/* Production Deliverable Submissions */}
                  <td className="px-3 py-2.5 text-foreground whitespace-nowrap">
                    {formatMetricCount(
                      user.productionDeliverableSubmissionCount,
                      locale,
                    )}
                  </td>

                  {/* Client Submissions */}
                  <td className="px-3 py-2.5 text-foreground whitespace-nowrap">
                    {formatMetricCount(user.clientSubmissionCount, locale)}
                  </td>

                  {/* Deliverable Review Decisions */}
                  <td className="px-3 py-2.5 text-foreground whitespace-nowrap">
                    {formatMetricCount(user.deliverableReviewCount, locale)}
                  </td>

                  {/* Deliverable Delivered Handoffs */}
                  <td className="px-3 py-2.5 text-foreground whitespace-nowrap">
                    {formatMetricCount(user.deliverableDeliveredCount, locale)}
                  </td>

                  {/* In-App Notifications Received */}
                  <td className="px-3 py-2.5 text-foreground whitespace-nowrap">
                    {formatMetricCount(
                      user.inAppNotificationReceivedCount,
                      locale,
                    )}
                  </td>

                  {/* In-App Notifications Marked Read */}
                  <td className="px-3 py-2.5 text-foreground whitespace-nowrap">
                    {formatMetricCount(user.inAppNotificationReadCount, locale)}
                  </td>

                  {/* In-App Notifications Unread at Range End */}
                  <td className="px-3 py-2.5 text-foreground whitespace-nowrap">
                    {formatMetricCount(
                      user.inAppNotificationUnreadCountAtRangeEnd,
                      locale,
                    )}
                  </td>

                  {/* In-App Notifications Unread 24h+ at Range End */}
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span
                      className={
                        user.inAppNotificationUnreadOver24hCountAtRangeEnd > 0
                          ? "font-semibold text-amber-600 dark:text-amber-400"
                          : "text-foreground"
                      }
                    >
                      {formatMetricCount(
                        user.inAppNotificationUnreadOver24hCountAtRangeEnd,
                        locale,
                      )}
                    </span>
                  </td>

                  {/* Avg In-App Read Hours */}
                  <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                    {formatMetricHours(
                      user.averageInAppNotificationReadHours,
                      locale,
                      noDataLabel,
                      hoursUnit,
                    )}
                  </td>

                  {/* Last Recorded Workflow Action */}
                  <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                    {formatMetricTimestamp(
                      user.lastWorkflowActionAt,
                      locale,
                      noActionLabel,
                    )}
                  </td>

                  {/* Actions Column */}
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    <Button
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={() => onSelectUser(user.userId)}
                      aria-label={tActions("viewDetailsAria", {
                        name: user.fullName,
                      })}
                      className="min-h-[44px] min-w-[44px] text-xs font-medium gap-1.5"
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{tActions("viewDetails")}</span>
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
