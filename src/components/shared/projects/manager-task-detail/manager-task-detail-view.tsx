"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { Link, useRouter } from "@/i18n/routing";
import { toast } from "sonner";
import { ArrowLeft, Clock, User, FolderKanban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ManagerTaskDetail } from "@/lib/projects/manager-task-queries";
import type {
  DeliverableDetailView,
  DeliverableListItem,
  DeliverableVersionView,
} from "@/lib/deliverables/queries";
import { getManagerTaskDeliverableDetailAction } from "@/lib/deliverables/actions";
import { ManagerTaskResources } from "./manager-task-resources";
import { ManagerTaskDeliverablesList } from "./manager-task-deliverables-list";
import { DeliverableDetailSheet } from "@/components/shared/projects/project-deliverables/deliverable-detail-sheet";
import { DeliverableSubmitDialog } from "@/components/shared/projects/project-deliverables/deliverable-submit-dialog";
import { DeliverableReviewDialog } from "@/components/shared/projects/project-deliverables/deliverable-review-dialog";
import { DeliverableDeliveryDialog } from "@/components/shared/projects/project-deliverables/deliverable-delivery-dialog";
import { DeliverableLinkReportDialog } from "@/components/shared/projects/project-deliverables/deliverable-link-report-dialog";

interface ManagerTaskDetailViewProps {
  task: ManagerTaskDetail;
  role: "admin" | "pm";
  effectiveCapacity: "admin" | "pm_lead" | "pm_watcher";
  currentUserId: string;
  safeReturnHref: string;
}

export function ManagerTaskDetailView({
  task,
  role,
  effectiveCapacity,
  currentUserId,
  safeReturnHref,
}: ManagerTaskDetailViewProps) {
  const t = useTranslations("projects.managerTask");
  const tWorkspace = useTranslations("projects.workspace.overview");
  const tTasks = useTranslations("projects.workspace.tasks");
  const format = useFormatter();
  const router = useRouter();

  // Dialog & selection state ownership
  const [selectedDetail, setSelectedDetail] =
    useState<DeliverableDetailView | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [submittingDeliverable, setSubmittingDeliverable] = useState<
    DeliverableListItem | DeliverableDetailView | null
  >(null);
  const [reviewingDeliverable, setReviewingDeliverable] = useState<
    DeliverableListItem | DeliverableDetailView | null
  >(null);
  const [deliveringDeliverable, setDeliveringDeliverable] = useState<
    DeliverableListItem | DeliverableDetailView | null
  >(null);
  const [reportingVersion, setReportingVersion] =
    useState<DeliverableVersionView | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Fail-closed initial load: do not open sheet if null or error
  const handleSelectDeliverable = async (deliverableId: string) => {
    setIsLoadingDetail(true);
    try {
      const detail = await getManagerTaskDeliverableDetailAction({
        taskId: task.taskId,
        projectId: task.projectId,
        deliverableId,
      });

      if (!detail) {
        toast.error(t("absence.description"));
        return;
      }

      setSelectedDetail(detail);
      setIsDetailOpen(true);
    } catch {
      toast.error(t("absence.description"));
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // State-reset on mutation success
  const handleMutationSuccess = (message?: string) => {
    setSubmittingDeliverable(null);
    setReviewingDeliverable(null);
    setDeliveringDeliverable(null);
    setIsDetailOpen(false);
    setSelectedDetail(null);
    if (message) toast.success(message);
    router.refresh();
  };

  const handleReportSuccess = (message: string) => {
    setReportingVersion(null);
    toast.success(message);
  };

  const getInitials = (name?: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const projectsListHref =
    role === "admin" ? "/admin/proyectos" : "/pm/proyectos";

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {/* Navigation Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href={safeReturnHref}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "gap-2 text-muted-foreground hover:text-foreground",
            )}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            <span>{t("backToTasks")}</span>
          </Link>

          {/* Breadcrumbs */}
          <nav
            aria-label="Breadcrumbs"
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <Link
              href={projectsListHref}
              className="hover:underline hover:text-foreground"
            >
              {t("breadcrumbs.projects")}
            </Link>
            <span>/</span>
            <Link
              href={safeReturnHref}
              aria-label={t("viewProjectAria", {
                projectName: task.projectName,
              })}
              className="hover:underline hover:text-foreground"
            >
              {task.projectName}
            </Link>
            <span>/</span>
            <span className="font-medium text-foreground truncate max-w-[200px]">
              {task.title}
            </span>
          </nav>
        </div>

        {/* Title & Status Badges */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {task.title}
            </h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FolderKanban className="size-3.5" aria-hidden="true" />
              <span>{task.projectName}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {tTasks(`types.${task.taskType}`)}
            </Badge>
            <Badge
              variant={
                task.status === "completed"
                  ? "default"
                  : task.status === "in_progress"
                    ? "secondary"
                    : "outline"
              }
              className="capitalize"
            >
              {tTasks(`status.${task.status}`)}
            </Badge>
            <Badge
              variant={
                task.priority === "blocking"
                  ? "destructive"
                  : task.priority === "high"
                    ? "default"
                    : "secondary"
              }
              className="capitalize"
            >
              {tTasks(`priority.${task.priority}`)}
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Columns: Description & Deliverables */}
        <div className="space-y-6 lg:col-span-2">
          {/* Description Section */}
          <section
            aria-labelledby="task-description-heading"
            className="rounded-xl border border-border bg-card p-6 shadow-sm"
          >
            <h2
              id="task-description-heading"
              className="text-base font-semibold text-foreground mb-3"
            >
              {t("descriptionTitle")}
            </h2>
            {task.description ? (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
                {task.description}
              </p>
            ) : (
              <p className="text-sm italic text-muted-foreground">
                {t("noDescription")}
              </p>
            )}
          </section>

          {/* Associated Deliverables Section */}
          <section
            aria-labelledby="task-deliverables-heading"
            className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2
                id="task-deliverables-heading"
                className="text-base font-semibold text-foreground"
              >
                {t("deliverablesTitle")}
              </h2>
              <span className="text-xs text-muted-foreground">
                {t("deliverablesCount", { count: task.deliverables.length })}
              </span>
            </div>

            <ManagerTaskDeliverablesList
              deliverables={task.deliverables}
              onSelectDeliverable={handleSelectDeliverable}
              selectedDeliverableId={selectedDetail?.id}
              isLoadingDetail={isLoadingDetail}
            />
          </section>
        </div>

        {/* Right 1 Column: Timeline, Assignee, Resources */}
        <div className="space-y-6">
          {/* Timeline & Dates */}
          <section
            aria-labelledby="task-timeline-heading"
            className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4"
          >
            <h2
              id="task-timeline-heading"
              className="text-base font-semibold text-foreground flex items-center gap-2"
            >
              <Clock
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <span>{t("timeContext")}</span>
            </h2>

            <dl className="space-y-2.5 text-xs">
              {task.assignedAt && (
                <div className="flex justify-between items-center py-1 border-b border-border/50">
                  <dt className="text-muted-foreground">
                    {t("assignedAt", { date: "" }).replace(":", "")}
                  </dt>
                  <dd className="font-medium text-foreground">
                    {format.dateTime(new Date(task.assignedAt), {
                      dateStyle: "medium",
                    })}
                  </dd>
                </div>
              )}
              {task.deadlineAt && (
                <div className="flex justify-between items-center py-1 border-b border-border/50">
                  <dt className="text-muted-foreground">
                    {t("deadlineAt", { date: "" }).replace(":", "")}
                  </dt>
                  <dd className="font-semibold text-foreground">
                    {format.dateTime(new Date(task.deadlineAt), {
                      dateStyle: "medium",
                    })}
                  </dd>
                </div>
              )}
              {task.startedAt && (
                <div className="flex justify-between items-center py-1 border-b border-border/50">
                  <dt className="text-muted-foreground">
                    {t("startedAt", { date: "" }).replace(":", "")}
                  </dt>
                  <dd className="font-medium text-foreground">
                    {format.dateTime(new Date(task.startedAt), {
                      dateStyle: "medium",
                    })}
                  </dd>
                </div>
              )}
              {task.completedAt && (
                <div className="flex justify-between items-center py-1">
                  <dt className="text-muted-foreground">
                    {t("completedAt", { date: "" }).replace(":", "")}
                  </dt>
                  <dd className="font-medium text-foreground">
                    {format.dateTime(new Date(task.completedAt), {
                      dateStyle: "medium",
                    })}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {/* Assignee Card */}
          <section
            aria-labelledby="task-assignee-heading"
            className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-3"
          >
            <h2
              id="task-assignee-heading"
              className="text-base font-semibold text-foreground flex items-center gap-2"
            >
              <User
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <span>{tWorkspace("members.roster.columns.member")}</span>
            </h2>

            {task.assignee ? (
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                  {getInitials(task.assignee.full_name)}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">
                    {task.assignee.full_name}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {task.assignee.role}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                {tWorkspace("unassigned")}
              </p>
            )}
          </section>

          {/* Resources Card */}
          <section
            aria-labelledby="task-resources-heading"
            className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-3"
          >
            <h2
              id="task-resources-heading"
              className="text-base font-semibold text-foreground"
            >
              {t("resourcesTitle")}
            </h2>

            <ManagerTaskResources resources={task.resources} />
          </section>
        </div>
      </div>

      {/* Shared Deliverables Sheet & Controlled Dialogs */}
      <DeliverableDetailSheet
        deliverable={selectedDetail}
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedDetail(null);
        }}
        effectiveCapacity={effectiveCapacity}
        currentUserId={currentUserId}
        onSubmitClick={() => setSubmittingDeliverable(selectedDetail)}
        onReviewClick={() => setReviewingDeliverable(selectedDetail)}
        onDeliverClick={() => setDeliveringDeliverable(selectedDetail)}
        onReportLink={(v) => setReportingVersion(v)}
      />

      <DeliverableSubmitDialog
        isOpen={!!submittingDeliverable}
        deliverable={submittingDeliverable}
        onClose={() => setSubmittingDeliverable(null)}
        onSuccess={handleMutationSuccess}
      />

      <DeliverableReviewDialog
        isOpen={!!reviewingDeliverable}
        deliverable={reviewingDeliverable}
        onClose={() => setReviewingDeliverable(null)}
        onSuccess={handleMutationSuccess}
      />

      <DeliverableDeliveryDialog
        isOpen={!!deliveringDeliverable}
        deliverable={deliveringDeliverable}
        projectId={task.projectId}
        onClose={() => setDeliveringDeliverable(null)}
        onSuccess={handleMutationSuccess}
      />

      <DeliverableLinkReportDialog
        isOpen={!!reportingVersion}
        version={reportingVersion}
        onClose={() => setReportingVersion(null)}
        onSuccess={handleReportSuccess}
      />
    </div>
  );
}
