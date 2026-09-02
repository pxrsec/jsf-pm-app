"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import {
  ArrowLeft,
  Search,
  X,
  Archive,
  RotateCcw,
  AlertTriangle,
  FolderKanban,
  CheckSquare,
  FileBox,
  Calendar,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OperationalLifecycleEntityType } from "@/lib/operational-lifecycle/types";

export type RecycleBinFilterType = OperationalLifecycleEntityType | "all";

export interface RecycleBinStats {
  all: number;
  project: number;
  task: number;
  deliverable: number;
  milestone: number;
  restorable: number;
  blocked: number;
}

interface RecycleBinQuickNavProps {
  activeType: RecycleBinFilterType;
  onTypeChange: (type: RecycleBinFilterType) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  stats: RecycleBinStats;
  totalFiltered: number;
  baseRolePath?: "/pm" | "/admin";
}

export function RecycleBinQuickNav({
  activeType,
  onTypeChange,
  searchQuery,
  onSearchChange,
  stats,
  totalFiltered,
  baseRolePath = "/pm",
}: RecycleBinQuickNavProps) {
  const t = useTranslations("operationalLifecycle.recycleBin");
  const tEntities = useTranslations(
    "operationalLifecycle.recycleBin.entityTypes",
  );
  const tQuick = useTranslations("operationalLifecycle.recycleBin.filters");

  const filterTabs: Array<{
    type: RecycleBinFilterType;
    label: string;
    count: number;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      type: "all",
      label: tQuick("all"),
      count: stats.all,
      icon: Layers,
    },
    {
      type: "project",
      label: tEntities("project"),
      count: stats.project,
      icon: FolderKanban,
    },
    {
      type: "task",
      label: tEntities("task"),
      count: stats.task,
      icon: CheckSquare,
    },
    {
      type: "deliverable",
      label: tEntities("deliverable"),
      count: stats.deliverable,
      icon: FileBox,
    },
    {
      type: "milestone",
      label: tEntities("milestone"),
      count: stats.milestone,
      icon: Calendar,
    },
  ];

  const archiveHref = `${baseRolePath}/archivo`;
  const dashboardHref = baseRolePath;

  return (
    <div className="space-y-4">
      {/* Top quick navigation links (Mobile & Desktop friendly) */}
      <div className="flex items-center justify-between gap-2">
        <Link
          href={dashboardHref}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors min-h-[44px] sm:min-h-0 py-1"
        >
          <ArrowLeft className="size-3.5 shrink-0" />
          <span>{tQuick("backToDashboard")}</span>
        </Link>

        <Link
          href={archiveHref}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors min-h-[44px] sm:min-h-0"
        >
          <Archive className="size-3.5 shrink-0 text-muted-foreground" />
          <span>{tQuick("viewArchive")}</span>
        </Link>
      </div>

      {/* Title & Description with Stats Chips */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-2xl">
            {t("description")}
          </p>
        </div>

        {/* Quick summary chips */}
        {stats.all > 0 && (
          <div className="flex items-center flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium">
              <Layers className="size-3" />
              <span>{tQuick("statsTotal", { count: stats.all })}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-medium">
              <RotateCcw className="size-3" />
              <span>
                {tQuick("statsRestorable", { count: stats.restorable })}
              </span>
            </span>
            {stats.blocked > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium">
                <AlertTriangle className="size-3" />
                <span>{tQuick("statsBlocked", { count: stats.blocked })}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Quick Navigation Filter Bar & Search */}
      <div className="space-y-3 pt-2">
        {/* Horizontal scrollable navigation filter pills */}
        <div
          role="tablist"
          aria-label="Filter recycle bin by entity type"
          className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar sm:flex-wrap -mx-4 px-4 sm:mx-0 sm:px-0"
        >
          {filterTabs.map((tab) => {
            const isActive = activeType === tab.type;
            const Icon = tab.icon;

            return (
              <button
                key={tab.type}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onTypeChange(tab.type)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-all shrink-0 min-h-[44px] sm:min-h-[38px] select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-card border border-border/80 text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                <span>{tab.label}</span>
                <Badge
                  variant={isActive ? "secondary" : "outline"}
                  className={cn(
                    "text-[10px] px-1.5 py-0 h-4 font-normal",
                    isActive
                      ? "bg-primary-foreground/20 text-primary-foreground border-transparent"
                      : "text-muted-foreground bg-muted/50",
                  )}
                >
                  {tab.count}
                </Badge>
              </button>
            );
          })}
        </div>

        {/* Search bar & count indicator */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={tQuick("searchPlaceholder")}
              className="pl-9 pr-8 h-10 text-xs sm:text-sm bg-card min-h-[44px] sm:min-h-[40px]"
            />
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onSearchChange("")}
                className="absolute right-1 top-1/2 -translate-y-1/2 size-7 p-0 text-muted-foreground hover:text-foreground min-h-[44px] sm:min-h-[28px] min-w-[44px] sm:min-w-[28px]"
                aria-label={tQuick("clearSearch")}
              >
                <X className="size-3.5" />
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground shrink-0">
            {tQuick("showingCount", {
              count: totalFiltered,
              total: stats.all,
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
