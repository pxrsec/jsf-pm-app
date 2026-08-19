"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations, useFormatter } from "next-intl";
import { MoreHorizontal, ExternalLink, Users } from "lucide-react";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PROJECT_STATUS_MAP } from "@/lib/status-maps";
import type { ProjectListItem, ProjectStatus } from "@/lib/projects/queries";

interface ProjectTableProps {
  projects: ProjectListItem[];
  baseHref: string;
}

export function ProjectTable({ projects, baseHref }: ProjectTableProps) {
  const t = useTranslations("projects.directory.table");
  const tStatus = useTranslations("shell.status");
  const tTypes = useTranslations("projects.types");
  const format = useFormatter();
  const router = useRouter();

  return (
    <div className="rounded-md border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[35%]">{t("columns.name")}</TableHead>
            <TableHead className="w-[15%]">{t("columns.type")}</TableHead>
            <TableHead className="w-[20%]">{t("columns.status")}</TableHead>
            <TableHead className="w-[20%]">{t("columns.deadline")}</TableHead>
            <TableHead className="w-[10%] text-right">
              {t("columns.actions")}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => {
            const statusConfig =
              PROJECT_STATUS_MAP[project.status as ProjectStatus] ??
              PROJECT_STATUS_MAP.planning;
            const StatusIcon = statusConfig.icon;

            const deadlineDate = project.deadline_at
              ? new Date(project.deadline_at)
              : null;

            return (
              <TableRow key={project.id} className="hover:bg-muted/40 transition-colors">
                <TableCell className="font-medium">
                  <div className="flex flex-col">
                    <Link
                      href={`${baseHref}/${project.id}`}
                      className="font-semibold text-foreground hover:text-primary transition-colors line-clamp-1"
                    >
                      {project.name}
                    </Link>
                    {project.internal_description && (
                      <span className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {project.internal_description}
                      </span>
                    )}
                  </div>
                </TableCell>

                <TableCell>
                  <Badge
                    variant={project.project_type === "client" ? "default" : "secondary"}
                    className="text-xs font-normal"
                  >
                    {project.project_type === "client"
                      ? tTypes("client")
                      : tTypes("internal")}
                  </Badge>
                </TableCell>

                <TableCell>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.badgeBg} ${statusConfig.badgeFg}`}
                  >
                    <StatusIcon className="h-3 w-3" />
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
                </TableCell>

                <TableCell className="text-xs text-muted-foreground">
                  {deadlineDate ? (
                    format.dateTime(deadlineDate, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  ) : (
                    "—"
                  )}
                </TableCell>

                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="inline-flex shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground h-8 w-8 cursor-pointer hover:bg-muted"
                      aria-label={t("columns.actions")}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        onClick={() => router.push(`${baseHref}/${project.id}`)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>{t("actions.open")}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => router.push(`${baseHref}/${project.id}?tab=members`)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Users className="h-3.5 w-3.5" />
                        <span>{t("actions.manageTeam")}</span>
                      </DropdownMenuItem>
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
