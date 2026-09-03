"use client";

import { useTranslations } from "next-intl";
import { ExternalLink, Paperclip } from "lucide-react";
import type { ManagerTaskResource } from "@/lib/projects/manager-task-queries";

interface ManagerTaskResourcesProps {
  resources: ManagerTaskResource[];
}

export function ManagerTaskResources({ resources }: ManagerTaskResourcesProps) {
  const t = useTranslations("projects.managerTask");

  if (resources.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-center">
        <p className="text-sm text-muted-foreground">{t("noResources")}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {resources.map((resource) => (
        <li key={resource.id}>
          <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("externalResourceAria", { name: resource.name })}
            className="flex items-center justify-between rounded-lg border border-border bg-card p-3 text-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <Paperclip
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="truncate font-medium text-foreground">
                {resource.name}
              </span>
            </div>
            <ExternalLink
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </a>
        </li>
      ))}
    </ul>
  );
}
