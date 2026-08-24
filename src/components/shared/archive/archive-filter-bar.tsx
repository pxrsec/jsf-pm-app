"use client";

import { useTransition, useCallback } from "react";
import { useRouter, usePathname } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter, Calendar, Loader2 } from "lucide-react";
import type {
  ArchiveProjectFilterOption,
  FinalizedArchiveStatus,
} from "@/lib/archive/types";
import {
  getDefaultArchiveRange,
  formatIsoWithOffset,
} from "@/lib/archive/date-utils";
import { TZDate } from "@date-fns/tz";
import { CALENDAR_TIME_ZONE } from "@/lib/calendar/date-utils";

interface ArchiveFilterBarProps {
  currentStatus?: FinalizedArchiveStatus;
  currentFrom: string;
  currentTo: string;
  currentProjectId?: string;
  projects?: readonly ArchiveProjectFilterOption[];
  paramPrefix?: string;
}

export function ArchiveFilterBar({
  currentStatus,
  currentFrom,
  currentTo,
  currentProjectId,
  projects,
  paramPrefix = "",
}: ArchiveFilterBarProps) {
  const t = useTranslations("archive.filters");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const fromKey = paramPrefix ? `${paramPrefix}From` : "from";
  const toKey = paramPrefix ? `${paramPrefix}To` : "to";
  const statusKey = paramPrefix ? `${paramPrefix}Status` : "status";
  const projectKey = paramPrefix ? `${paramPrefix}ProjectId` : "projectId";

  const updateFilters = useCallback(
    (updates: {
      from?: string;
      to?: string;
      status?: string | null;
      projectId?: string | null;
    }) => {
      const params = new URLSearchParams(searchParams.toString());

      if (updates.from !== undefined) {
        params.set(fromKey, updates.from);
      }
      if (updates.to !== undefined) {
        params.set(toKey, updates.to);
      }
      if (updates.status !== undefined) {
        if (updates.status && updates.status !== "all") {
          params.set(statusKey, updates.status);
        } else {
          params.delete(statusKey);
        }
      }
      if (updates.projectId !== undefined) {
        if (updates.projectId && updates.projectId !== "all") {
          params.set(projectKey, updates.projectId);
        } else {
          params.delete(projectKey);
        }
      }

      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [searchParams, fromKey, toKey, statusKey, projectKey, router, pathname],
  );

  const handleStatusChange = (val: string | null) => {
    updateFilters({ status: val });
  };

  const handleProjectChange = (val: string | null) => {
    updateFilters({ projectId: val });
  };

  const handlePresetLast90Days = () => {
    const range = getDefaultArchiveRange();
    updateFilters({ from: range.from, to: range.to });
  };

  const handlePresetPrevious90Days = () => {
    const now = new Date();
    const endTz = new TZDate(
      now.getTime() - 90 * 24 * 60 * 60 * 1000,
      CALENDAR_TIME_ZONE,
    );
    const startTz = new TZDate(
      now.getTime() - 180 * 24 * 60 * 60 * 1000,
      CALENDAR_TIME_ZONE,
    );

    updateFilters({
      from: formatIsoWithOffset(startTz),
      to: formatIsoWithOffset(endTz),
    });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 shadow-xs">
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Status Filter */}
        <div className="flex items-center gap-1.5">
          <Filter
            className="h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Select
            value={currentStatus ?? "all"}
            onValueChange={handleStatusChange}
            disabled={isPending}
          >
            <SelectTrigger
              aria-label={t("statusAria")}
              className="h-9 w-[160px] text-xs font-medium"
            >
              <SelectValue placeholder={t("allStatuses")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allStatuses")}</SelectItem>
              <SelectItem value="approved">{t("statusApproved")}</SelectItem>
              <SelectItem value="delivered">{t("statusDelivered")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Optional Project Filter (Admin & PM only) */}
        {projects && projects.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Select
              value={currentProjectId ?? "all"}
              onValueChange={handleProjectChange}
              disabled={isPending}
            >
              <SelectTrigger
                aria-label={t("projectAria")}
                className="h-9 w-[190px] text-xs font-medium"
              >
                <SelectValue placeholder={t("allProjects")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allProjects")}</SelectItem>
                {projects.map((proj) => (
                  <SelectItem key={proj.id} value={proj.id}>
                    {proj.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Date Range Presets */}
        <div className="flex items-center gap-1.5">
          <Calendar
            className="h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Button
            type="button"
            variant={
              currentFrom === getDefaultArchiveRange().from &&
              currentTo === getDefaultArchiveRange().to
                ? "secondary"
                : "outline"
            }
            size="sm"
            onClick={handlePresetLast90Days}
            disabled={isPending}
            className="h-9 text-xs font-medium"
          >
            {t("presetLast90")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePresetPrevious90Days}
            disabled={isPending}
            className="h-9 text-xs font-medium"
          >
            {t("presetPrevious90")}
          </Button>
        </div>
      </div>

      {isPending && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground animate-pulse">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          <span>{t("filtering")}</span>
        </div>
      )}
    </div>
  );
}
