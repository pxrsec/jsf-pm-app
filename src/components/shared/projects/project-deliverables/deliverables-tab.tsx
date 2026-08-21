"use client";

import { useState, useMemo, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Building2,
  FolderLock,
  Layers,
  FilterX,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeliverablesFilterBar } from "./deliverables-filter-bar";
import { DeliverableList } from "./deliverable-list";
import { DeliverableCard } from "./deliverable-card";
import { DeliverableCreateDialog } from "./deliverable-create-dialog";
import { DeliverableEditDialog } from "./deliverable-edit-dialog";
import { DeliverableArchiveDialog } from "./deliverable-archive-dialog";
import { DeliverableSubmitDialog } from "./deliverable-submit-dialog";
import { DeliverableReviewDialog } from "./deliverable-review-dialog";
import { DeliverableDeliveryDialog } from "./deliverable-delivery-dialog";
import { DeliverableDetailSheet } from "./deliverable-detail-sheet";
import { DeliverableLinkReportDialog } from "./deliverable-link-report-dialog";
import { getDeliverableDetailAction } from "@/lib/deliverables/actions";
import type { ProjectDetail, TaskWithAssignee } from "@/lib/projects/queries";
import type {
  DeliverableListItem,
  DeliverableDetailView,
  DeliverableVersionView,
} from "@/lib/deliverables/queries";

interface DeliverablesTabProps {
  project: ProjectDetail;
  initialDeliverables: DeliverableListItem[];
  tasks: TaskWithAssignee[];
  effectiveCapacity: "admin" | "pm_lead" | "pm_watcher";
  currentUserId?: string;
}

export function DeliverablesTab({
  project,
  initialDeliverables,
  tasks,
  effectiveCapacity,
  currentUserId,
}: DeliverablesTabProps) {
  const t = useTranslations("projects.workspace.deliverables");
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingDeliverable, setEditingDeliverable] =
    useState<DeliverableListItem | null>(null);
  const [archivingDeliverableId, setArchivingDeliverableId] = useState<
    string | null
  >(null);
  const [submittingDeliverable, setSubmittingDeliverable] =
    useState<DeliverableListItem | null>(null);
  const [reviewingDeliverable, setReviewingDeliverable] =
    useState<DeliverableListItem | DeliverableDetailView | null>(null);
  const [deliveringDeliverable, setDeliveringDeliverable] =
    useState<DeliverableListItem | DeliverableDetailView | null>(null);
  const [selectedDetail, setSelectedDetail] =
    useState<DeliverableDetailView | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [reportingVersion, setReportingVersion] =
    useState<DeliverableVersionView | null>(null);

  const isInternal = project.project_type === "internal";
  const hasClientOrg = Boolean(project.client_id);
  const hasActiveClientMember = project.members.some(
    (m) =>
      !m.deleted_at &&
      m.member_type === "client" &&
      m.profile?.is_active === true,
  );
  const isClientReady = hasClientOrg && hasActiveClientMember;
  const isLeadOrAdmin =
    effectiveCapacity === "admin" || effectiveCapacity === "pm_lead";

  const filteredDeliverables = useMemo(() => {
    return initialDeliverables.filter((d) => {
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (assigneeFilter !== "all" && d.assignee_id !== assigneeFilter)
        return false;
      return true;
    });
  }, [initialDeliverables, statusFilter, assigneeFilter]);

  const handleOpenDetail = async (deliverable: DeliverableListItem) => {
    setSelectedDetail({ ...deliverable, versions: [], feedback: [] });
    setIsDetailOpen(true);
    try {
      const fullDetail = await getDeliverableDetailAction(deliverable.id);
      if (fullDetail) setSelectedDetail(fullDetail);
    } catch {
      // Keep optimistic view
    }
  };

  const handleRefresh = (msg?: string) => {
    if (msg) toast.success(msg);
    router.refresh();
    startTransition(() => {
      if (selectedDetail) {
        getDeliverableDetailAction(selectedDetail.id)
          .then((fresh) => {
            if (fresh) setSelectedDetail(fresh);
            else {
              setIsDetailOpen(false);
              setSelectedDetail(null);
            }
          })
          .catch(() => {
            setIsDetailOpen(false);
            setSelectedDetail(null);
          });
      }
    });
  };

  const handleActionError = (code: string) => {
    if (code === "NOT_FOUND") {
      setIsDetailOpen(false);
      setSelectedDetail(null);
    }
    router.refresh();
    if (selectedDetail && code !== "NOT_FOUND") {
      getDeliverableDetailAction(selectedDetail.id).then((fresh) => {
        if (fresh) setSelectedDetail(fresh);
        else {
          setIsDetailOpen(false);
          setSelectedDetail(null);
        }
      });
    }
  };

  if (isInternal) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-border/80 bg-muted/20 space-y-3">
        <div className="size-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
          <FolderLock className="size-6" />
        </div>
        <div className="space-y-1 max-w-md">
          <h3 className="text-base font-semibold text-foreground">
            {t("internalIneligibleTitle")}
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("internalIneligibleDescription")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!isClientReady && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200">
          <Building2 className="size-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="space-y-0.5 text-xs">
            <p className="font-semibold">{t("incompleteClientSetupTitle")}</p>
            <p className="text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
              {t("incompleteClientSetupDescription")}
            </p>
          </div>
        </div>
      )}

      <DeliverablesFilterBar
        project={project}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        assigneeFilter={assigneeFilter}
        setAssigneeFilter={setAssigneeFilter}
        viewMode={viewMode}
        setViewMode={setViewMode}
        isLeadOrAdmin={isLeadOrAdmin}
        isClientReady={isClientReady}
        onOpenCreate={() => setIsCreateOpen(true)}
      />

      {initialDeliverables.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-border/80 bg-muted/10 space-y-3">
          <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Layers className="size-6" />
          </div>
          <div className="space-y-1 max-w-sm">
            <h3 className="text-base font-semibold text-foreground">
              {t("emptyStateTitle")}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t("emptyStateDescription")}
            </p>
          </div>
          {isLeadOrAdmin && isClientReady && (
            <Button
              onClick={() => setIsCreateOpen(true)}
              size="sm"
              className="text-xs gap-1.5 mt-2"
            >
              <Plus className="size-3.5" />
              <span>{t("emptyStateAction")}</span>
            </Button>
          )}
        </div>
      ) : filteredDeliverables.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-border/80 bg-muted/10 space-y-2">
          <FilterX className="size-8 text-muted-foreground/60" />
          <h4 className="text-sm font-semibold text-foreground">
            {t("emptyFilterTitle")}
          </h4>
          <p className="text-xs text-muted-foreground">
            {t("emptyFilterDescription")}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setStatusFilter("all");
              setAssigneeFilter("all");
            }}
            className="text-xs mt-2"
          >
            {t("clearFilters")}
          </Button>
        </div>
      ) : viewMode === "table" ? (
        <DeliverableList
          deliverables={filteredDeliverables}
          effectiveCapacity={effectiveCapacity}
          currentUserId={currentUserId}
          onViewDetails={handleOpenDetail}
          onSubmitVersion={(d) => setSubmittingDeliverable(d)}
          onEdit={(d) => setEditingDeliverable(d)}
          onArchive={(d) => setArchivingDeliverableId(d.id)}
          onReview={(d) => setReviewingDeliverable(d)}
          onDeliver={(d) => setDeliveringDeliverable(d)}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDeliverables.map((d) => (
            <DeliverableCard
              key={d.id}
              deliverable={d}
              effectiveCapacity={effectiveCapacity}
              currentUserId={currentUserId}
              onViewDetails={handleOpenDetail}
              onSubmitVersion={(deliv) => setSubmittingDeliverable(deliv)}
              onEdit={(deliv) => setEditingDeliverable(deliv)}
              onArchive={(deliv) => setArchivingDeliverableId(deliv.id)}
              onReview={(deliv) => setReviewingDeliverable(deliv)}
              onDeliver={(deliv) => setDeliveringDeliverable(deliv)}
            />
          ))}
        </div>
      )}

      <DeliverableCreateDialog
        project={project}
        tasks={tasks}
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={handleRefresh}
      />

      <DeliverableEditDialog
        project={project}
        deliverable={editingDeliverable}
        isOpen={Boolean(editingDeliverable)}
        onClose={() => setEditingDeliverable(null)}
        onSuccess={handleRefresh}
      />

      <DeliverableArchiveDialog
        deliverableId={archivingDeliverableId}
        projectId={project.id}
        isOpen={Boolean(archivingDeliverableId)}
        onClose={() => setArchivingDeliverableId(null)}
        onSuccess={handleRefresh}
      />

      <DeliverableSubmitDialog
        deliverable={submittingDeliverable}
        isOpen={Boolean(submittingDeliverable)}
        onClose={() => setSubmittingDeliverable(null)}
        onSuccess={handleRefresh}
      />

      <DeliverableReviewDialog
        deliverable={reviewingDeliverable}
        isOpen={Boolean(reviewingDeliverable)}
        onClose={() => setReviewingDeliverable(null)}
        onSuccess={handleRefresh}
        onError={handleActionError}
      />

      <DeliverableDeliveryDialog
        deliverable={deliveringDeliverable}
        projectId={project.id}
        isOpen={Boolean(deliveringDeliverable)}
        onClose={() => setDeliveringDeliverable(null)}
        onSuccess={handleRefresh}
        onError={handleActionError}
      />

      <DeliverableDetailSheet
        deliverable={selectedDetail}
        effectiveCapacity={effectiveCapacity}
        currentUserId={currentUserId}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onSubmitClick={() => {
          if (selectedDetail) {
            setSubmittingDeliverable(selectedDetail);
          }
        }}
        onReviewClick={() => {
          if (selectedDetail) {
            setReviewingDeliverable(selectedDetail);
          }
        }}
        onDeliverClick={() => {
          if (selectedDetail) {
            setDeliveringDeliverable(selectedDetail);
          }
        }}
        onReportLink={(ver) => setReportingVersion(ver)}
      />

      <DeliverableLinkReportDialog
        version={reportingVersion}
        isOpen={Boolean(reportingVersion)}
        onClose={() => setReportingVersion(null)}
        onSuccess={handleRefresh}
      />
    </div>
  );
}
