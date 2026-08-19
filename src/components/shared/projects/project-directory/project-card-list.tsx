"use client";

import Link from "next/link";
import { useTranslations, useFormatter } from "next-intl";
import { Calendar, ArrowRight } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PROJECT_STATUS_MAP } from "@/lib/status-maps";
import type { ProjectListItem, ProjectStatus } from "@/lib/projects/queries";

interface ProjectCardListProps {
  projects: ProjectListItem[];
  baseHref: string;
}

export function ProjectCardList({ projects, baseHref }: ProjectCardListProps) {
  const t = useTranslations("projects.directory");
  const tStatus = useTranslations("shell.status");
  const tTypes = useTranslations("projects.types");
  const format = useFormatter();

  return (
    <div className="flex flex-col gap-3">
      {projects.map((project) => {
        const statusConfig =
          PROJECT_STATUS_MAP[project.status as ProjectStatus] ??
          PROJECT_STATUS_MAP.planning;
        const StatusIcon = statusConfig.icon;

        const deadlineDate = project.deadline_at
          ? new Date(project.deadline_at)
          : null;

        return (
          <Card
            key={project.id}
            className="border-border bg-card shadow-sm hover:shadow-md transition-shadow"
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base font-semibold">
                  <Link
                    href={`${baseHref}/${project.id}`}
                    className="text-foreground hover:text-primary transition-colors"
                  >
                    {project.name}
                  </Link>
                </CardTitle>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusConfig.badgeBg} ${statusConfig.badgeFg}`}
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
              </div>
            </CardHeader>

            <CardContent className="pb-3 text-xs text-muted-foreground flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Badge
                  variant={project.project_type === "client" ? "default" : "secondary"}
                  className="text-xs font-normal"
                >
                  {project.project_type === "client"
                    ? tTypes("client")
                    : tTypes("internal")}
                </Badge>

                {deadlineDate && (
                  <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    <span>{t("cards.deadline")}</span>
                    <span className="font-medium text-foreground">
                      {format.dateTime(deadlineDate, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                )}
              </div>

              {project.internal_description && (
                <p className="line-clamp-2 text-foreground/80 mt-1">
                  {project.internal_description}
                </p>
              )}
            </CardContent>

            <CardFooter className="pt-0">
              <Link
                href={`${baseHref}/${project.id}`}
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                  className: "w-full justify-between h-9",
                })}
              >
                <span>{t("cards.openAction")}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
