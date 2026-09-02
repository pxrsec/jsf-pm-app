"use client";

import { useTranslations, useFormatter } from "next-intl";
import {
  MoreHorizontal,
  Edit,
  Archive,
  Eye,
  HardDrive,
  AlertTriangle,
  FileCheck2,
  Truck,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeliverableStatusBadge } from "./deliverable-status-badge";
import type { DeliverableListItem } from "@/lib/deliverables/queries";

interface DeliverableListProps {
  deliverables: DeliverableListItem[];
  effectiveCapacity: "admin" | "pm_lead" | "pm_watcher";
  canArchiveDeliverables?: boolean;
  currentUserId?: string;
  onViewDetails: (d: DeliverableListItem) => void;
  onSubmitVersion: (d: DeliverableListItem) => void;
  onEdit: (d: DeliverableListItem) => void;
  onArchive: (d: DeliverableListItem) => void;
  onReview?: (d: DeliverableListItem) => void;
  onDeliver?: (d: DeliverableListItem) => void;
}

export function DeliverableList({
  deliverables,
  effectiveCapacity,
  canArchiveDeliverables,
  currentUserId,
  onViewDetails,
  onSubmitVersion,
  onEdit,
  onArchive,
  onReview,
  onDeliver,
}: DeliverableListProps) {
  const t = useTranslations("projects.workspace.deliverables");
  const format = useFormatter();

  const isLeadOrAdmin =
    effectiveCapacity === "admin" || effectiveCapacity === "pm_lead";

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="text-xs font-semibold">
              {t("columns.title")}
            </TableHead>
            <TableHead className="text-xs font-semibold w-[160px]">
              {t("columns.status")}
            </TableHead>
            <TableHead className="text-xs font-semibold w-[90px]">
              {t("columns.version")}
            </TableHead>
            <TableHead className="text-xs font-semibold w-[180px]">
              {t("columns.assignee")}
            </TableHead>
            <TableHead className="text-xs font-semibold w-[150px]">
              {t("columns.deadlines")}
            </TableHead>
            <TableHead className="text-xs font-semibold w-[70px] text-right">
              {t("columns.actions")}
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {deliverables.map((deliverable) => {
            const isProduction = deliverable.workflow_type === "production";
            const isAssignee = deliverable.assignee_id === currentUserId;
            const canEdit =
              isLeadOrAdmin &&
              (deliverable.status === "pending" ||
                deliverable.status === "changes_requested");
            const canSubmit =
              isProduction &&
              (isAssignee || isLeadOrAdmin) &&
              (deliverable.status === "pending" ||
                deliverable.status === "changes_requested");
            const canReview =
              isProduction &&
              isLeadOrAdmin &&
              deliverable.status === "awaiting_internal_review";
            const canDeliver =
              isProduction &&
              isLeadOrAdmin &&
              deliverable.status === "approved";
            const canArchive =
              (canArchiveDeliverables ?? true) &&
              deliverable.status !== "delivered";

            const assigneeName =
              deliverable.assignee?.full_name || t("unassigned");
            const assigneeInitials = assigneeName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();

            const rawDeadline =
              deliverable.workflow_type === "client_submission"
                ? deliverable.submission_deadline_at
                : deliverable.internal_review_deadline_at;

            const deadline = rawDeadline
              ? format.dateTime(new Date(rawDeadline), {
                  month: "short",
                  day: "numeric",
                })
              : null;

            return (
              <TableRow
                key={deliverable.id}
                onClick={() => onViewDetails(deliverable)}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
              >
                {/* Title */}
                <TableCell className="font-medium text-xs py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="hover:underline font-semibold text-foreground line-clamp-1">
                      {deliverable.title}
                    </span>
                    {deliverable.is_stalled && (
                      <Badge
                        variant="destructive"
                        className="text-[10px] gap-0.5 bg-destructive/10 text-destructive border-destructive/20 px-1 py-0"
                      >
                        <AlertTriangle className="size-2.5" />
                        <span>{t("stalledBadge")}</span>
                      </Badge>
                    )}
                  </div>
                </TableCell>

                {/* Status */}
                <TableCell className="py-3.5">
                  <DeliverableStatusBadge status={deliverable.status} />
                </TableCell>

                {/* Version */}
                <TableCell className="py-3.5">
                  <Badge
                    variant="secondary"
                    className="font-mono text-xs font-medium"
                  >
                    {deliverable.current_version_number > 0
                      ? `v${deliverable.current_version_number}`
                      : "v0"}
                  </Badge>
                </TableCell>

                {/* Assignee */}
                <TableCell className="py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">
                      {assigneeInitials}
                    </div>
                    <span className="text-xs text-foreground truncate max-w-[140px]">
                      {assigneeName}
                    </span>
                  </div>
                </TableCell>

                {/* Deadlines */}
                <TableCell className="py-3.5 text-xs text-muted-foreground">
                  {deadline ? (
                    <span>{deadline}</span>
                  ) : (
                    <span className="italic text-muted-foreground/60">
                      {t("deadlines.noDeadlines")}
                    </span>
                  )}
                </TableCell>

                {/* Actions Dropdown */}
                <TableCell
                  className="py-3.5 text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="inline-flex shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground size-7 cursor-pointer hover:bg-muted"
                      aria-label={t("actionsMenuAriaLabel")}
                    >
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => onViewDetails(deliverable)}
                        className="text-xs gap-2"
                      >
                        <Eye className="size-3.5" />
                        <span>{t("actions.openDetails")}</span>
                      </DropdownMenuItem>

                      {canReview && onReview && (
                        <DropdownMenuItem
                          onClick={() => onReview(deliverable)}
                          className="text-xs gap-2 text-indigo-600 dark:text-indigo-400 font-medium"
                        >
                          <FileCheck2 className="size-3.5" />
                          <span>{t("actions.reviewVersion")}</span>
                        </DropdownMenuItem>
                      )}

                      {canSubmit && (
                        <DropdownMenuItem
                          onClick={() => onSubmitVersion(deliverable)}
                          className="text-xs gap-2"
                        >
                          <HardDrive className="size-3.5" />
                          <span>{t("actions.submitVersion")}</span>
                        </DropdownMenuItem>
                      )}

                      {canDeliver && onDeliver && (
                        <DropdownMenuItem
                          onClick={() => onDeliver(deliverable)}
                          className="text-xs gap-2 text-teal-600 dark:text-teal-400 font-medium"
                        >
                          <Truck className="size-3.5" />
                          <span>{t("actions.markDelivered")}</span>
                        </DropdownMenuItem>
                      )}

                      {canEdit && (
                        <DropdownMenuItem
                          onClick={() => onEdit(deliverable)}
                          className="text-xs gap-2"
                        >
                          <Edit className="size-3.5" />
                          <span>{t("actions.edit")}</span>
                        </DropdownMenuItem>
                      )}

                      {canArchive && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onArchive(deliverable)}
                            className="text-xs gap-2 text-destructive focus:text-destructive"
                          >
                            <Archive className="size-3.5" />
                            <span>{t("actions.archive")}</span>
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
