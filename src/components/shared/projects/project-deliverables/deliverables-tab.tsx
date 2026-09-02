"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Layers, FilterX, Plus, FileBox } from "lucide-react";
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
  canManageOperationalLifecycle?: boolean;
  currentUserId?: string;
}

export function DeliverablesTab({
  project,
  initialDeliverables,
  tasks,
  effectiveCapacity,
  canManageOperationalLifecycle,
  currentUserId,
}: DeliverablesTabProps) {
  const t = useTranslations("projects.workspace.deliverables");
  const router = useRouter();

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
  const [reviewingDeliverable, setReviewingDeliverable] = useState<
    DeliverableListItem | DeliverableDetailView | null
  >(null);
  const [deliveringDeliverable, setDeliveringDeliverable] = useState<
    DeliverableListItem | DeliverableDetailView | null
  >(null);
  const [selectedDetail, setSelectedDetail] =
    useState<DeliverableDetailView | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [reportingVersion, setReportingVersion] =
    useState<DeliverableVersionView | null>(null);

  const hasTasks = tasks.some((t) => !t.deleted_at);
  const isMissingClientMember =
    project.project_type === "client" &&
    !project.members.some((m) => m.member_type === "client" && !m.deleted_at);
  const isLeadOrAdmin =
    effectiveCapacity === "admin" || effectiveCapacity === "pm_lead";
  const canArchiveDeliverables = canManageOperationalLifecycle ?? true;

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
  };

  const handleActionError = (msg: string) => {
    toast.error(msg);
  };

  return (
    <div className="space-y-6">
      <DeliverablesFilterBar
        project={project}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        assigneeFilter={assigneeFilter}
        setAssigneeFilter={setAssigneeFilter}
        viewMode={viewMode}
        setViewMode={setViewMode}
        isLeadOrAdmin={isLeadOrAdmin}
        hasTasks={hasTasks}
        onOpenCreate={() => setIsCreateOpen(true)}
      />

      {isMissingClientMember && project.status !== "completed" && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 flex items-start gap-3">
          <Building2 className="size-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              {t("incompleteClientSetupTitle")}
            </h4>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t("incompleteClientSetupDescription")}
            </p>
          </div>
        </div>
      )}

      {!hasTasks && project.status !== "completed" && (
        <div className="bg-muted/50 border border-border rounded-xl p-4 flex items-start gap-3">
          <Layers className="size-5 text-muted-foreground mt-0.5 shrink-0" />
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-foreground">
              {t("noTasksTitle", { defaultMessage: "Tareas requeridas" })}
            </h4>
            <p className="text-xs text-muted-foreground">
              {t("noTasksDescription", {
                defaultMessage:
                  "Debes crear al menos una tarea en el proyecto antes de poder añadir entregables.",
              })}
            </p>
          </div>
        </div>
      )}

      {initialDeliverables.length === 0 ? (
        <div className="text-center py-16 px-4 bg-card rounded-xl border border-border/80 shadow-2xs space-y-3">
          <FileBox className="size-10 text-muted-foreground mx-auto" />
          <h3 className="text-base font-semibold text-foreground">
            {t("emptyStateTitle", {
              defaultMessage: "No hay entregables planificados",
            })}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {t("emptyStateDescription", {
              defaultMessage:
                "Planifica entregables asociados a tareas para dar seguimiento al trabajo del cliente.",
            })}
          </p>
          {isLeadOrAdmin &&
            hasTasks &&
            !isMissingClientMember &&
            project.status !== "completed" && (
              <Button
                size="sm"
                onClick={() => setIsCreateOpen(true)}
                className="text-xs mt-2 gap-1.5 shadow-xs"
              >
                <Plus className="size-3.5" />
                <span>
                  {t("emptyStateAction", {
                    defaultMessage: "Planificar primer entregable",
                  })}
                </span>
              </Button>
            )}
        </div>
      ) : filteredDeliverables.length === 0 ? (
        <div className="text-center py-16 px-4 bg-card rounded-xl border border-border/80 shadow-2xs space-y-3">
          <FilterX className="size-10 text-muted-foreground mx-auto" />
          <h3 className="text-base font-semibold text-foreground">
            {t("noResultsTitle", { defaultMessage: "Sin resultados" })}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {t("noResultsDescription", {
              defaultMessage:
                "No hay entregables que coincidan con los filtros seleccionados.",
            })}
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
          canArchiveDeliverables={canArchiveDeliverables}
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
              canArchiveDeliverables={canArchiveDeliverables}
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
