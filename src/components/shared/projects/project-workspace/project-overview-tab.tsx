"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations, useFormatter } from "next-intl";
import { copyTextToClipboard } from "@/lib/clipboard";
import {
  ExternalLink,
  Copy,
  Check,
  Layers,
  Send,
  AlertTriangle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { CompletionCyclesCard } from "./completion-cycles-card";
import { ProjectMilestoneTimeline } from "./project-milestone-timeline";
import { ProjectTeamSummary } from "./project-team-summary";
import type {
  ProjectDetail,
  ProjectCompletionCyclesView,
  TaskWithAssignee,
} from "@/lib/projects/queries";
import type { DeliverableListItem } from "@/lib/deliverables/queries";
import type { ClientListItem } from "@/lib/clients/queries";
import type { MilestoneSummaryDto } from "@/lib/calendar/types";

interface ProjectOverviewTabProps {
  project: ProjectDetail;
  clients: ClientListItem[];
  cycles: ProjectCompletionCyclesView[];
  tasks: readonly TaskWithAssignee[];
  deliverables: readonly DeliverableListItem[];
  milestoneSummaries?: readonly MilestoneSummaryDto[];
  canManageMilestones?: boolean;
  onOpenEditDialog?: () => void;
  onSelectTab?: (tab: string) => void;
  onOpenMilestone?: (milestoneId: string) => void;
}

export function ProjectOverviewTab({
  project,
  clients,
  cycles,
  tasks,
  deliverables,
  milestoneSummaries = [],
  canManageMilestones = false,
  onOpenEditDialog,
  onSelectTab,
  onOpenMilestone,
}: ProjectOverviewTabProps) {
  const t = useTranslations("projects.workspace");
  const tOverview = useTranslations("projects.workspace.overview");
  const format = useFormatter();
  const [copied, setCopied] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
    },
    [],
  );

  const taskStatusOrder = [
    "pending",
    "in_progress",
    "in_review",
    "blocked",
    "completed",
  ] as const;
  const deliverableStatusOrder = [
    "pending",
    "submitted",
    "awaiting_internal_review",
    "changes_requested",
    "approved",
    "delivered",
  ] as const;
  const activeTasks = tasks.filter((task) => task.status !== "completed");
  const countByStatus = <T extends { status: string }>(
    items: readonly T[],
    order: readonly string[],
  ) =>
    order.flatMap((status) => {
      const count = items.filter((item) => item.status === status).length;
      return count ? [{ status, count }] : [];
    });
  const taskBreakdown = countByStatus(tasks, taskStatusOrder);
  const deliverableBreakdown = countByStatus(
    deliverables,
    deliverableStatusOrder,
  );

  const handleCopyId = async () => {
    const didCopy = await copyTextToClipboard(project.id);
    setCopyMessage(tOverview(didCopy ? "copySuccess" : "copyError"));
    if (!didCopy) return;
    setCopied(true);
    if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
    copyResetTimer.current = setTimeout(() => setCopied(false), 2000);
  };
  const clientOrg = clients.find((client) => client.id === project.client_id);
  const clientMembers = project.members.filter(
    (m) => m.member_type === "client",
  );

  const isClientProject = project.project_type === "client";
  const isMissingClientSetup = isClientProject && clientMembers.length === 0;

  const createdDate = new Date(project.created_at);
  const deadlineDate = project.deadline_at
    ? new Date(project.deadline_at)
    : null;

  return (
    <div className="space-y-6">
      {/* Client Setup Warning Banner */}
      {isMissingClientSetup && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4 text-yellow-900 dark:text-yellow-100">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold">
                {t("clientSetupBanner.title")}
              </h4>
              <p className="text-xs text-yellow-800/90 dark:text-yellow-200/90 mt-0.5 max-w-2xl">
                {t("clientSetupBanner.description")}
              </p>
            </div>
          </div>
          {onOpenEditDialog && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenEditDialog}
              className="border-yellow-600/40 text-yellow-900 dark:text-yellow-100 hover:bg-yellow-500/20 shrink-0 self-start sm:self-auto h-8 text-xs font-medium"
            >
              {t("clientSetupBanner.linkCta")}
            </Button>
          )}
        </div>
      )}

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Internal Description */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                {tOverview("descriptionCardTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">
                {project.internal_description}
              </p>
            </CardContent>
          </Card>

          {/* Client Scope (if client project) */}
          {isClientProject && (
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">
                  {tOverview("clientScopeCardTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">
                  {project.client_scope || (
                    <em className="text-muted-foreground text-xs">
                      {tOverview("noClientScope")}
                    </em>
                  )}
                </p>
              </CardContent>
            </Card>
          )}

          <ProjectMilestoneTimeline
            milestones={milestoneSummaries}
            canManageMilestones={canManageMilestones}
            onOpenCalendar={() => onSelectTab?.("calendar")}
            onOpenMilestone={(milestoneId) => onOpenMilestone?.(milestoneId)}
          />

          {/* Work Summary Preview */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                {tOverview("quickStatsTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onSelectTab?.("tasks")}
                className="h-auto min-h-[88px] justify-between whitespace-normal p-3.5 text-left hover:bg-muted/60"
                aria-label={tOverview("openTasks", {
                  count: activeTasks.length,
                })}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      {tOverview("tasksCount")}
                    </p>
                    <p className="text-lg font-bold text-foreground">
                      {tOverview("activeCount", { count: activeTasks.length })}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {taskBreakdown
                        .map(
                          ({ status, count }) =>
                            `${tOverview(`taskStatus.${status}`)} ${count}`,
                        )
                        .join(" · ") || tOverview("noTasks")}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-medium text-primary">
                  {tOverview("view")}
                </span>
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => onSelectTab?.("deliverables")}
                className="h-auto min-h-[88px] justify-between whitespace-normal p-3.5 text-left hover:bg-muted/60"
                aria-label={tOverview("openDeliverables", {
                  count: deliverables.length,
                })}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <Send className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      {tOverview("deliverablesCount")}
                    </p>
                    <p className="text-lg font-bold text-foreground">
                      {deliverables.length}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {deliverableBreakdown
                        .map(
                          ({ status, count }) =>
                            `${tOverview(`deliverableStatus.${status}`)} ${count}`,
                        )
                        .join(" · ") || tOverview("noDeliverables")}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-medium text-primary">
                  {tOverview("view")}
                </span>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column (1/3 width) */}
        <div className="space-y-6">
          {/* Project Meta Card */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                {tOverview("metaCardTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5 text-xs">
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground font-medium">
                  {tOverview("projectId")}
                </span>
                <div className="flex items-center justify-between bg-muted/40 px-2.5 py-1.5 rounded border border-border font-mono text-[11px]">
                  <span className="truncate pr-2">{project.id}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleCopyId}
                    className="h-6 w-6 shrink-0"
                    aria-label={tOverview("copyProjectId")}
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                <span className="sr-only" role="status" aria-live="polite">
                  {copyMessage}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-border pt-2.5">
                <span className="text-muted-foreground">
                  {tOverview("createdDate")}
                </span>
                <span className="font-medium text-foreground">
                  {format.dateTime(createdDate, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>

              {deadlineDate && (
                <div className="flex items-center justify-between border-t border-border pt-2.5">
                  <span className="text-muted-foreground">
                    {t("summary.deadlineLabel")}
                  </span>
                  <span className="font-medium text-foreground">
                    {format.dateTime(deadlineDate, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              )}

              {isClientProject && (
                <div className="flex items-center justify-between border-t border-border pt-2.5">
                  <span className="text-muted-foreground">
                    {tOverview("associatedClient")}
                  </span>
                  <span className="font-medium text-foreground">
                    {clientOrg ? (
                      clientOrg.display_name
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[11px] font-normal"
                      >
                        {tOverview("unassignedClient")}
                      </Badge>
                    )}
                  </span>
                </div>
              )}

              <div className="border-t border-border pt-2.5">
                <span className="text-muted-foreground">
                  {tOverview("linksCardTitle")}
                </span>
                {project.drive_folder_url ? (
                  <div className="mt-1.5 flex items-center justify-between gap-2 rounded border border-border bg-muted/40 p-2">
                    <span className="truncate font-mono text-[11px] text-muted-foreground">
                      {project.drive_folder_url}
                    </span>
                    <a
                      href={project.drive_folder_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                        className: "h-8 shrink-0 gap-1.5",
                      })}
                    >
                      <span>{tOverview("openDriveFolder")}</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tOverview("noDriveLink")}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <ProjectTeamSummary
            members={project.members}
            onOpenMembers={() => onSelectTab?.("members")}
          />

          {/* Completion Cycles History Card */}
          <CompletionCyclesCard cycles={cycles} />
        </div>
      </div>
    </div>
  );
}
