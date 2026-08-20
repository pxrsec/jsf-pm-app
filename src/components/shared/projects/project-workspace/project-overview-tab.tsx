"use client";

import { useState } from "react";
import { useTranslations, useFormatter } from "next-intl";
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
import type {
  ProjectDetail,
  ProjectCompletionCyclesView,
} from "@/lib/projects/queries";
import type { ClientListItem } from "@/lib/clients/queries";

interface ProjectOverviewTabProps {
  project: ProjectDetail;
  clients: ClientListItem[];
  cycles: ProjectCompletionCyclesView[];
  onOpenEditDialog?: () => void;
  onSelectTab?: (tab: string) => void;
}

export function ProjectOverviewTab({
  project,
  clients,
  cycles,
  onOpenEditDialog,
  onSelectTab,
}: ProjectOverviewTabProps) {
  const t = useTranslations("projects.workspace");
  const tOverview = useTranslations("projects.workspace.overview");
  const format = useFormatter();
  const [copied, setCopied] = useState(false);

  const clientOrg = clients.find((c) => c.id === project.client_id);
  const clientMembers = project.members.filter(
    (m) => m.member_type === "client",
  );

  const isClientProject = project.project_type === "client";
  const isMissingClientSetup =
    isClientProject && (!project.client_id || clientMembers.length === 0);

  const handleCopyId = () => {
    navigator.clipboard.writeText(project.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

          {/* Storage & Links */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                {tOverview("linksCardTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {project.drive_folder_url ? (
                <div className="flex items-center justify-between p-3 rounded-md border border-border bg-muted/40">
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span className="text-xs font-mono text-muted-foreground truncate">
                      {project.drive_folder_url}
                    </span>
                  </div>
                  <a
                    href={project.drive_folder_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                      className: "h-8 gap-1.5 shrink-0",
                    })}
                  >
                    <span>{tOverview("openDriveFolder")}</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {tOverview("noDriveLink")}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Work Summary Preview */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                {tOverview("quickStatsTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                onClick={() => onSelectTab?.("tasks")}
                className="flex items-center justify-between p-3.5 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      {tOverview("tasksCount")}
                    </p>
                    <p className="text-lg font-bold text-foreground">—</p>
                  </div>
                </div>
                <span className="text-xs text-primary font-medium">Ver</span>
              </div>

              <div
                onClick={() => isClientProject && onSelectTab?.("deliverables")}
                className={`flex items-center justify-between p-3.5 rounded-lg border border-border bg-muted/30 ${
                  isClientProject
                    ? "hover:bg-muted/60 cursor-pointer"
                    : "opacity-60 cursor-not-allowed"
                } transition-colors`}
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
                      {isClientProject ? "—" : "N/A"}
                    </p>
                  </div>
                </div>
                {isClientProject && (
                  <span className="text-xs text-primary font-medium">Ver</span>
                )}
              </div>
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
                    aria-label="Copy project ID"
                  >
                    {copied ? (
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </Button>
                </div>
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
            </CardContent>
          </Card>

          {/* Team Summary Card */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold">
                {tOverview("teamSummaryTitle")}
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSelectTab?.("members")}
                className="h-7 text-xs text-primary font-medium px-2"
              >
                {tOverview("viewAllMembers", { count: project.members.length })}
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2.5">
                {project.members.slice(0, 5).map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                        {member.profile?.full_name?.charAt(0) ?? "U"}
                      </div>
                      <span className="font-medium text-foreground truncate">
                        {member.profile?.full_name ?? "Usuario"}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {member.is_primary ? "Lead ★" : member.member_type}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Completion Cycles History Card */}
          <CompletionCyclesCard cycles={cycles} />
        </div>
      </div>
    </div>
  );
}
