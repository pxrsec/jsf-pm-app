"use client";

import { useTranslations, useFormatter } from "next-intl";
import {
  Calendar,
  HardDrive,
  FileText,
  User,
  AlertTriangle,
  FileCheck2,
  Truck,
  Info,
  CheckCircle,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeliverableStatusBadge } from "./deliverable-status-badge";
import { DeliverableHistory } from "./deliverable-history";
import { DeliverableCommentsSection } from "./deliverable-comments-section";
import type {
  DeliverableDetailView,
  DeliverableVersionView,
} from "@/lib/deliverables/queries";

interface DeliverableDetailSheetProps {
  deliverable: DeliverableDetailView | null;
  effectiveCapacity: "admin" | "pm_lead" | "pm_watcher";
  currentUserId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmitClick: () => void;
  onReviewClick?: () => void;
  onDeliverClick?: () => void;
  onReportLink: (version: DeliverableVersionView) => void;
}

export function DeliverableDetailSheet({
  deliverable,
  effectiveCapacity,
  currentUserId,
  isOpen,
  onClose,
  onSubmitClick,
  onReviewClick,
  onDeliverClick,
  onReportLink,
}: DeliverableDetailSheetProps) {
  const t = useTranslations("projects.workspace.deliverables");
  const format = useFormatter();

  if (!deliverable) return null;

  const isProduction = deliverable.workflow_type === "production";
  const isWatcher = effectiveCapacity === "pm_watcher";
  const isAssignee = deliverable.assignee_id === currentUserId;
  const isLeadOrAdmin =
    effectiveCapacity === "admin" || effectiveCapacity === "pm_lead";
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
    isProduction && isLeadOrAdmin && deliverable.status === "approved";
  const isAwaitingClientReview =
    deliverable.status === "awaiting_client_review";
  const isDelivered = deliverable.status === "delivered";

  const assigneeName = deliverable.assignee?.full_name || t("unassigned");
  const assigneeInitials = assigneeName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return format.dateTime(new Date(dateStr), {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const subDeadline = formatDate(deliverable.submission_deadline_at);
  const revDeadline = formatDate(deliverable.internal_review_deadline_at);
  const delDeadline = formatDate(deliverable.client_delivery_deadline_at);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-6 space-y-6"
      >
        <SheetHeader className="space-y-2 border-b border-border/60 pb-4 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <DeliverableStatusBadge status={deliverable.status} />
            <Badge variant="outline" className="text-[11px] font-medium">
              {deliverable.workflow_type === "client_submission"
                ? t("workflowType.clientSubmission")
                : t("workflowType.production")}
            </Badge>
            <Badge
              variant="secondary"
              className="font-mono text-xs px-2 py-0.5"
            >
              {deliverable.current_version_number > 0
                ? `v${deliverable.current_version_number}`
                : t("versionZero")}
            </Badge>
            {deliverable.is_stalled && (
              <Badge
                variant="destructive"
                className="text-xs gap-1 bg-destructive/10 text-destructive border-destructive/20"
              >
                <AlertTriangle className="size-3" />
                <span>{t("stalledBadge")}</span>
              </Badge>
            )}
          </div>

          <SheetTitle className="text-lg sm:text-xl font-bold text-foreground">
            {deliverable.title}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            {t("detailSheet.title")}
          </SheetDescription>
        </SheetHeader>

        {/* Assignee & Planning Metadata */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                {assigneeInitials}
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">
                  {assigneeName}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {t("detailSheet.productionAssigneeRole")}
                </p>
              </div>
            </div>

            <Badge variant="outline" className="text-[10px] font-normal gap-1">
              <User className="size-3 text-muted-foreground" />
              <span>{deliverable.workflow_type}</span>
            </Badge>
          </div>

          {/* Specifications */}
          {deliverable.specifications && (
            <div className="space-y-1 pt-1 border-t border-border/50">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <FileText className="size-3.5" />
                <span>{t("detailSheet.specificationsTitle")}</span>
              </div>
              <p className="text-xs text-foreground/90 whitespace-pre-wrap pl-5 bg-muted/20 p-2 rounded-md border border-border/40">
                {deliverable.specifications}
              </p>
            </div>
          )}

          {/* Deadlines */}
          {(subDeadline || revDeadline || delDeadline) && (
            <div className="space-y-1.5 pt-1 border-t border-border/50 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
                <Calendar className="size-3.5" />
                <span>{t("detailSheet.deadlinesTitle")}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pl-5">
                {subDeadline && (
                  <div className="bg-muted/30 p-1.5 rounded text-[11px]">
                    <span className="text-muted-foreground block text-[10px]">
                      {t("detailSheet.submissionDeadlineShort")}
                    </span>
                    <span className="font-medium">{subDeadline}</span>
                  </div>
                )}
                {revDeadline && (
                  <div className="bg-muted/30 p-1.5 rounded text-[11px]">
                    <span className="text-muted-foreground block text-[10px]">
                      {t("detailSheet.internalReviewDeadlineShort")}
                    </span>
                    <span className="font-medium">{revDeadline}</span>
                  </div>
                )}
                {delDeadline && (
                  <div className="bg-muted/30 p-1.5 rounded text-[11px]">
                    <span className="text-muted-foreground block text-[10px]">
                      {t("detailSheet.clientDeliveryDeadlineShort")}
                    </span>
                    <span className="font-medium">{delDeadline}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Action / State Banners */}
        {canReview && (
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
            <div className="space-y-0.5">
              <h4 className="text-xs font-semibold text-foreground">
                {t("detailSheet.nextActionTitle")}
              </h4>
              <p className="text-xs text-muted-foreground">
                {t("detailSheet.reviewCta", {
                  version: String(deliverable.current_version_number || 1),
                })}
              </p>
            </div>
            <Button
              onClick={onReviewClick}
              size="sm"
              className="text-xs gap-1.5 shrink-0 shadow-xs bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <FileCheck2 className="size-3.5" />
              <span>
                {t("detailSheet.reviewCta", {
                  version: String(deliverable.current_version_number || 1),
                })}
              </span>
            </Button>
          </div>
        )}

        {canSubmit && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
            <div className="space-y-0.5">
              <h4 className="text-xs font-semibold text-foreground">
                {t("detailSheet.nextActionTitle")}
              </h4>
              <p className="text-xs text-muted-foreground">
                {deliverable.current_version_number === 0
                  ? t("detailSheet.submitCtaInitial")
                  : t("detailSheet.submitCta", {
                      version: String(deliverable.current_version_number + 1),
                    })}
              </p>
            </div>
            <Button
              onClick={onSubmitClick}
              size="sm"
              className="text-xs gap-1.5 shrink-0 shadow-xs"
            >
              <HardDrive className="size-3.5" />
              <span>{t("actions.submitVersion")}</span>
            </Button>
          </div>
        )}

        {canDeliver && (
          <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
            <div className="space-y-0.5">
              <h4 className="text-xs font-semibold text-foreground">
                {t("detailSheet.nextActionTitle")}
              </h4>
              <p className="text-xs text-muted-foreground">
                {t("detailSheet.deliverCta")}
              </p>
            </div>
            <Button
              onClick={onDeliverClick}
              size="sm"
              className="text-xs gap-1.5 shrink-0 shadow-xs bg-teal-600 hover:bg-teal-700 text-white"
            >
              <Truck className="size-3.5" />
              <span>{t("detailSheet.deliverCta")}</span>
            </Button>
          </div>
        )}

        {isAwaitingClientReview && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl border border-purple-500/20 bg-purple-500/10 text-purple-900 dark:text-purple-200 text-xs">
            <Info className="size-4 shrink-0 mt-0.5 text-purple-600 dark:text-purple-400" />
            <div className="space-y-0.5">
              <p className="font-semibold">
                {t("detailSheet.awaitingClientReviewTitle")}
              </p>
              <p className="text-purple-800/90 dark:text-purple-300/90 leading-relaxed">
                {t("detailSheet.awaitingClientReviewNotice")}
              </p>
            </div>
          </div>
        )}

        {isDelivered && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl border border-teal-500/20 bg-teal-500/10 text-teal-900 dark:text-teal-200 text-xs">
            <CheckCircle className="size-4 shrink-0 mt-0.5 text-teal-600 dark:text-teal-400" />
            <p className="leading-relaxed">
              {t("detailSheet.deliveredNotice")}
            </p>
          </div>
        )}

        {isWatcher && (
          <p className="text-[11px] text-muted-foreground italic bg-muted/40 p-2 rounded border border-border/60 text-center">
            {t("watcherMode.cannotMutate")}
          </p>
        )}

        {/* Immutable Version & Formal Review History */}
        <DeliverableHistory
          versions={deliverable.versions}
          feedback={deliverable.feedback}
          onReportLink={onReportLink}
        />

        {/* Collaboration Comments Section */}
        <div className="border-t border-border pt-4">
          <DeliverableCommentsSection
            projectId={deliverable.project_id}
            deliverableId={deliverable.id}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
