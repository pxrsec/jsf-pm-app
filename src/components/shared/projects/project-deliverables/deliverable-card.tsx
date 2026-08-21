"use client";

import { useTranslations, useFormatter } from "next-intl";
import {
  Calendar,
  HardDrive,
  MoreVertical,
  Edit,
  Archive,
  Eye,
  AlertTriangle,
  FileCheck2,
  Truck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

interface DeliverableCardProps {
  deliverable: DeliverableListItem;
  effectiveCapacity: "admin" | "pm_lead" | "pm_watcher";
  currentUserId?: string;
  onViewDetails: (d: DeliverableListItem) => void;
  onSubmitVersion: (d: DeliverableListItem) => void;
  onEdit: (d: DeliverableListItem) => void;
  onArchive: (d: DeliverableListItem) => void;
  onReview?: (d: DeliverableListItem) => void;
  onDeliver?: (d: DeliverableListItem) => void;
}

export function DeliverableCard({
  deliverable,
  effectiveCapacity,
  currentUserId,
  onViewDetails,
  onSubmitVersion,
  onEdit,
  onArchive,
  onReview,
  onDeliver,
}: DeliverableCardProps) {
  const t = useTranslations("projects.workspace.deliverables");
  const format = useFormatter();

  const isLeadOrAdmin =
    effectiveCapacity === "admin" || effectiveCapacity === "pm_lead";
  const isAssignee = deliverable.assignee_id === currentUserId;
  const canEdit =
    isLeadOrAdmin &&
    (deliverable.status === "pending" ||
      deliverable.status === "changes_requested");
  const canSubmit =
    (isAssignee || isLeadOrAdmin) &&
    (deliverable.status === "pending" ||
      deliverable.status === "changes_requested");
  const canReview =
    isLeadOrAdmin && deliverable.status === "awaiting_internal_review";
  const canDeliver = isLeadOrAdmin && deliverable.status === "approved";
  const canArchive = isLeadOrAdmin && deliverable.status !== "delivered";

  const assigneeName = deliverable.assignee?.full_name || t("unassigned");
  const assigneeInitials = assigneeName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const deadline = deliverable.submission_deadline_at
    ? format.dateTime(new Date(deliverable.submission_deadline_at), {
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <Card
      className="overflow-hidden hover:border-primary/40 transition-all cursor-pointer shadow-2xs"
      onClick={() => onViewDetails(deliverable)}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header Badges & Actions */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <DeliverableStatusBadge status={deliverable.status} />
            <Badge
              variant="secondary"
              className="font-mono text-[11px] px-1.5 py-0"
            >
              {deliverable.current_version_number > 0
                ? `v${deliverable.current_version_number}`
                : "v0"}
            </Badge>
            {deliverable.is_stalled && (
              <Badge
                variant="destructive"
                className="text-[10px] gap-1 bg-destructive/10 text-destructive border-destructive/20 px-1.5 py-0"
              >
                <AlertTriangle className="size-2.5" />
                <span>{t("stalledBadge")}</span>
              </Badge>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground size-7 cursor-pointer hover:bg-muted"
              aria-label={t("actionsMenuAriaLabel")}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <MoreVertical className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
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
        </div>

        {/* Title */}
        <h4 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">
          {deliverable.title}
        </h4>

        {/* Footer: Assignee & Deadline */}
        <div className="flex items-center justify-between pt-1 border-t border-border/50 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[9px] shrink-0">
              {assigneeInitials}
            </div>
            <span className="truncate max-w-[130px]">{assigneeName}</span>
          </div>

          {deadline ? (
            <div className="flex items-center gap-1 text-[11px]">
              <Calendar className="size-3 text-muted-foreground" />
              <span>{deadline}</span>
            </div>
          ) : (
            <span className="text-[11px] italic text-muted-foreground/70">
              {t("deadlines.noDeadlines")}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
