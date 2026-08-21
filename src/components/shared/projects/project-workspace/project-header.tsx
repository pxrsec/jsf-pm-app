"use client";

import Link from "next/link";
import { useTranslations, useFormatter } from "next-intl";
import {
  ChevronRight,
  Edit2,
  Calendar,
  UserCheck,
  MoreVertical,
  Pause,
  Play,
  XCircle,
  Archive,
  RotateCcw,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PROJECT_STATUS_MAP } from "@/lib/status-maps";
import type { ProjectDetail, ProjectStatus } from "@/lib/projects/queries";
import type { ClientListItem } from "@/lib/clients/queries";
import type { ProjectStatusActionType } from "./project-status-dialog";

interface ProjectHeaderProps {
  project: ProjectDetail;
  clients: ClientListItem[];
  effectiveCapacity: "admin" | "pm_lead" | "pm_watcher";
  baseHref: string;
  onOpenEditDialog: () => void;
  onOpenStatusDialog: (action: ProjectStatusActionType) => void;
}

export function ProjectHeader({
  project,
  clients,
  effectiveCapacity,
  baseHref,
  onOpenEditDialog,
  onOpenStatusDialog,
}: ProjectHeaderProps) {
  const t = useTranslations("projects.workspace");
  const tStatus = useTranslations("shell.status");
  const tTypes = useTranslations("projects.types");
  const format = useFormatter();

  const isWatcher = effectiveCapacity === "pm_watcher";
  const isAdmin = effectiveCapacity === "admin";

  const primaryLead = project.members.find(
    (m) => m.member_type === "pm_lead" && m.is_primary,
  );

  const clientOrg = clients.find((c) => c.id === project.client_id);

  const statusConfig =
    PROJECT_STATUS_MAP[project.status as ProjectStatus] ??
    PROJECT_STATUS_MAP.planning;
  const StatusIcon = statusConfig.icon;

  const deadlineDate = project.deadline_at
    ? new Date(project.deadline_at)
    : null;

  return (
    <div className="border-b border-border bg-card/60 pb-5">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
        {/* Breadcrumbs */}
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 text-xs text-muted-foreground pt-3"
        >
          <Link
            href={baseHref}
            className="hover:text-foreground transition-colors"
          >
            {t("breadcrumbs.root")}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium truncate max-w-xs">
            {project.name}
          </span>
        </nav>

        {/* Title and Actions Row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground line-clamp-1">
            {project.name}
          </h1>

          {!isWatcher && (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenEditDialog}
                className="h-8 gap-1.5 text-xs"
              >
                <Edit2 className="h-3.5 w-3.5" />
                <span>{t("summary.editAction")}</span>
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex shrink-0 items-center justify-center rounded-md border border-input bg-input/20 px-2.5 py-1 text-xs font-medium transition-colors outline-none hover:bg-input/50 h-8 gap-1.5 cursor-pointer">
                  <span>{t("summary.statusActions")}</span>
                  <MoreVertical className="h-3.5 w-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 text-xs">
                  {project.status === "in_progress" && (
                    <DropdownMenuItem
                      onClick={() => onOpenStatusDialog("pause")}
                      className="cursor-pointer gap-2"
                    >
                      <Pause className="h-3.5 w-3.5" />
                      <span>Pausar Proyecto</span>
                    </DropdownMenuItem>
                  )}

                  {project.status === "paused" && (
                    <DropdownMenuItem
                      onClick={() => onOpenStatusDialog("resume")}
                      className="cursor-pointer gap-2"
                    >
                      <Play className="h-3.5 w-3.5 text-green-600" />
                      <span>Reanudar Proyecto</span>
                    </DropdownMenuItem>
                  )}

                  {project.status !== "completed" &&
                    project.status !== "cancelled" && (
                      <DropdownMenuItem
                        onClick={() => onOpenStatusDialog("complete")}
                        className="cursor-pointer gap-2 text-green-600 focus:text-green-700 dark:text-green-400 dark:focus:text-green-300"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>{t("summary.completeProject")}</span>
                      </DropdownMenuItem>
                    )}

                  {project.status === "completed" && (
                    <DropdownMenuItem
                      onClick={() => onOpenStatusDialog("reopen")}
                      className="cursor-pointer gap-2 text-primary"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>{t("summary.reopenProject")}</span>
                    </DropdownMenuItem>
                  )}

                  {project.status !== "cancelled" &&
                    project.status !== "completed" && (
                      <DropdownMenuItem
                        onClick={() => onOpenStatusDialog("cancel")}
                        className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span>Cancelar Proyecto</span>
                      </DropdownMenuItem>
                    )}

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={() => onOpenStatusDialog("archive")}
                    className="cursor-pointer gap-2 text-muted-foreground"
                  >
                    <Archive className="h-3.5 w-3.5" />
                    <span>Archivar Proyecto</span>
                  </DropdownMenuItem>

                  {isAdmin && (
                    <DropdownMenuItem
                      onClick={() => onOpenStatusDialog("restore")}
                      className="cursor-pointer gap-2 text-primary"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Restaurar Proyecto</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {/* Badges Row */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* Status Badge */}
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConfig.badgeBg} ${statusConfig.badgeFg}`}
          >
            <StatusIcon className="h-3.5 w-3.5" />
            <span>
              {tStatus(
                statusConfig.labelKey as
                  | "planning"
                  | "inProgress"
                  | "paused"
                  | "completed"
                  | "cancelled",
              )}
            </span>
          </span>

          {/* Type Badge */}
          <Badge
            variant={
              project.project_type === "client" ? "default" : "secondary"
            }
            className="text-xs font-normal h-6"
          >
            {project.project_type === "client"
              ? clientOrg
                ? `Cliente: ${clientOrg.display_name}`
                : `Cliente: ${tTypes("unassigned")}`
              : tTypes("internal")}
          </Badge>

          {/* Primary PM Lead Badge */}
          {primaryLead && (
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-border bg-muted/50 text-xs text-foreground">
              <UserCheck className="h-3.5 w-3.5 text-primary" />
              <span className="text-muted-foreground">
                {t("summary.primaryLeadLabel")}:
              </span>
              <span className="font-medium">
                {primaryLead.profile?.full_name ?? "Lead"}
              </span>
            </div>
          )}

          {/* Deadline Badge */}
          {deadlineDate && (
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-border bg-muted/50 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                {t("summary.deadlineLabel")}:{" "}
                {format.dateTime(deadlineDate, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
