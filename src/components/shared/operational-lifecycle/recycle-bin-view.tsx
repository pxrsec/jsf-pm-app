"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Archive,
  Calendar,
  CheckSquare,
  FileBox,
  FolderKanban,
  Info,
  Loader2,
  RotateCcw,
  Search,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { restoreArchivedOperationalEntityAction } from "@/lib/operational-lifecycle/actions";
import { getOperationalLifecycleErrorKey } from "@/lib/operational-lifecycle/errors";
import type {
  AvailableResult,
  OperationalLifecycleEntityType,
  OperationalRecycleBinItem,
} from "@/lib/operational-lifecycle/types";
import {
  RecycleBinQuickNav,
  type RecycleBinFilterType,
} from "./recycle-bin-quick-nav";
import { cn } from "@/lib/utils";

interface RecycleBinViewProps {
  initialResult: AvailableResult<OperationalRecycleBinItem[]>;
  renderRowAction?: (item: OperationalRecycleBinItem) => React.ReactNode;
  baseRolePath?: "/pm" | "/admin";
}

export function RecycleBinView({
  initialResult,
  renderRowAction,
  baseRolePath = "/pm",
}: RecycleBinViewProps) {
  const t = useTranslations("operationalLifecycle.recycleBin");
  const tEntities = useTranslations(
    "operationalLifecycle.recycleBin.entityTypes",
  );
  const tQuick = useTranslations("operationalLifecycle.recycleBin.filters");
  const tErrors = useTranslations("operationalLifecycle.errors");
  const format = useFormatter();
  const router = useRouter();

  const [pendingRestores, setPendingRestores] = useState<Set<string>>(
    new Set(),
  );
  const [activeType, setActiveType] = useState<RecycleBinFilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const getEntityIcon = (type: OperationalLifecycleEntityType) => {
    switch (type) {
      case "project":
        return <FolderKanban className="size-3.5" />;
      case "task":
        return <CheckSquare className="size-3.5" />;
      case "deliverable":
        return <FileBox className="size-3.5" />;
      case "milestone":
        return <Calendar className="size-3.5" />;
    }
  };

  const getEntityTypeBadgeClass = (type: OperationalLifecycleEntityType) => {
    switch (type) {
      case "project":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/40";
      case "task":
        return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/40";
      case "deliverable":
        return "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-900/40";
      case "milestone":
        return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/40";
    }
  };

  const stats = useMemo(() => {
    if (initialResult.status !== "available") {
      return {
        all: 0,
        project: 0,
        task: 0,
        deliverable: 0,
        milestone: 0,
        restorable: 0,
        blocked: 0,
      };
    }
    const items = initialResult.data;
    return {
      all: items.length,
      project: items.filter((i) => i.entityType === "project").length,
      task: items.filter((i) => i.entityType === "task").length,
      deliverable: items.filter((i) => i.entityType === "deliverable").length,
      milestone: items.filter((i) => i.entityType === "milestone").length,
      restorable: items.filter((i) => !i.parentIsArchived).length,
      blocked: items.filter((i) => i.parentIsArchived).length,
    };
  }, [initialResult]);

  const filteredItems = useMemo(() => {
    if (initialResult.status !== "available") return [];
    return initialResult.data.filter((item) => {
      if (activeType !== "all" && item.entityType !== activeType) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = item.title.toLowerCase().includes(q);
        const matchReason = item.archiveReason?.toLowerCase().includes(q);
        return matchTitle || Boolean(matchReason);
      }
      return true;
    });
  }, [initialResult, activeType, searchQuery]);

  const handleRestore = async (item: OperationalRecycleBinItem) => {
    const key = `${item.entityType}:${item.entityId}`;
    setPendingRestores((prev) => new Set(prev).add(key));

    try {
      const result = await restoreArchivedOperationalEntityAction({
        entityType: item.entityType,
        entityId: item.entityId,
      });

      if (!result.ok) {
        const errorKey = getOperationalLifecycleErrorKey(result.error.code);
        toast.error(tErrors(errorKey as never) || t("restoreErrorToast"));
      } else {
        toast.success(t("restoreSuccessToast"));
        router.refresh();
      }
    } catch {
      toast.error(t("restoreErrorToast"));
    } finally {
      setPendingRestores((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  if (initialResult.status === "unavailable") {
    return (
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {t("description")}
          </p>
        </div>
        <div className="text-center py-16 px-4 bg-card rounded-xl border border-border shadow-2xs space-y-3">
          <Info className="size-10 text-muted-foreground mx-auto" />
          <h3 className="text-base font-semibold text-foreground">
            {t("unavailable")}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {t("unavailableDescription")}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.refresh()}
            className="text-xs mt-2 min-h-[44px] sm:min-h-0"
          >
            {t("retryAction")}
          </Button>
        </div>
      </div>
    );
  }

  const items = initialResult.data;

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Quick Navigation, Header & Filters */}
      <RecycleBinQuickNav
        activeType={activeType}
        onTypeChange={setActiveType}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        stats={stats}
        totalFiltered={filteredItems.length}
        baseRolePath={baseRolePath}
      />

      {items.length === 0 ? (
        <div className="text-center py-16 px-4 bg-card rounded-xl border border-border shadow-2xs space-y-3">
          <Archive className="size-10 text-muted-foreground mx-auto" />
          <h3 className="text-base font-semibold text-foreground">
            {t("empty")}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {t("emptyDescription")}
          </p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12 px-4 bg-card rounded-xl border border-dashed border-border shadow-2xs space-y-3">
          <Search className="size-8 text-muted-foreground mx-auto opacity-50" />
          <h3 className="text-sm font-semibold text-foreground">
            {tQuick("noSearchResults")}
          </h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {tQuick("noFilterResults")}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setActiveType("all");
              setSearchQuery("");
            }}
            className="text-xs min-h-[44px] sm:min-h-0 cursor-pointer mt-2"
          >
            {tQuick("clearFilters")}
          </Button>
        </div>
      ) : (
        <>
          {/* Desktop Table View (hidden on mobile) */}
          <div className="hidden md:block bg-card rounded-xl border border-border overflow-hidden shadow-2xs">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-xs font-semibold w-[140px]">
                    {t("columns.entityType")}
                  </TableHead>
                  <TableHead className="text-xs font-semibold">
                    {t("columns.title")}
                  </TableHead>
                  <TableHead className="text-xs font-semibold w-[160px]">
                    {t("columns.archivedAt")}
                  </TableHead>
                  <TableHead className="text-xs font-semibold w-[200px]">
                    {t("columns.reason")}
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-right w-[140px]">
                    {t("columns.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => {
                  const key = `${item.entityType}:${item.entityId}`;
                  const isPending = pendingRestores.has(key);
                  const isRestoreDisabled = item.parentIsArchived || isPending;

                  return (
                    <TableRow key={key}>
                      <TableCell className="py-3">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] gap-1 px-2.5 py-0.5 font-medium capitalize",
                            getEntityTypeBadgeClass(item.entityType),
                          )}
                        >
                          {getEntityIcon(item.entityType)}
                          <span>{tEntities(item.entityType)}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3 font-medium text-foreground">
                        <div className="space-y-1">
                          <span className="line-clamp-1 text-sm font-semibold">
                            {item.title}
                          </span>
                          {item.parentIsArchived && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300 font-normal"
                            >
                              {t("parentArchivedBadge")}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 text-xs text-muted-foreground">
                        {format.dateTime(new Date(item.archivedAt), {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "numeric",
                          minute: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="py-3 text-xs text-muted-foreground">
                        {item.archiveReason ? (
                          <span className="line-clamp-2">
                            {item.archiveReason}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {item.parentIsArchived ? (
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <button
                                    type="button"
                                    disabled
                                    className="inline-flex items-center justify-center rounded-md border border-input bg-background h-8 px-3 text-xs gap-1 opacity-50 cursor-not-allowed select-none"
                                    aria-label={t("restoreAriaLabel", {
                                      type: tEntities(item.entityType),
                                      title: item.title,
                                    })}
                                  >
                                    <RotateCcw className="size-3.5" />
                                    <span>{t("restoreAction")}</span>
                                  </button>
                                }
                              />
                              <TooltipContent>
                                <p className="text-xs">
                                  {t("parentArchivedTooltip")}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isRestoreDisabled}
                              onClick={() => handleRestore(item)}
                              className="h-8 text-xs gap-1 cursor-pointer"
                              aria-label={t("restoreAriaLabel", {
                                type: tEntities(item.entityType),
                                title: item.title,
                              })}
                            >
                              {isPending ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <RotateCcw className="size-3.5" />
                              )}
                              <span>
                                {isPending
                                  ? t("restoreSubmitting")
                                  : t("restoreAction")}
                              </span>
                            </Button>
                          )}
                          {renderRowAction && renderRowAction(item)}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards View (Optimized for mobile-first UX/UI) */}
          <div className="md:hidden space-y-3">
            {filteredItems.map((item) => {
              const key = `mobile-${item.entityType}:${item.entityId}`;
              const isPending = pendingRestores.has(
                `${item.entityType}:${item.entityId}`,
              );
              const isRestoreDisabled = item.parentIsArchived || isPending;

              return (
                <div
                  key={key}
                  className="bg-card rounded-xl border border-border p-4 shadow-2xs space-y-3 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] gap-1 px-2.5 py-0.5 font-medium capitalize shrink-0",
                        getEntityTypeBadgeClass(item.entityType),
                      )}
                    >
                      {getEntityIcon(item.entityType)}
                      <span>{tEntities(item.entityType)}</span>
                    </Badge>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {format.dateTime(new Date(item.archivedAt), {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "numeric",
                      })}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-foreground line-clamp-2">
                      {item.title}
                    </h3>
                    {item.archiveReason && (
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 bg-muted/40 rounded-md p-2 border border-border/50">
                        {item.archiveReason}
                      </p>
                    )}
                  </div>

                  {item.parentIsArchived && (
                    <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg p-2.5 text-xs text-amber-800 dark:text-amber-300">
                      <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                      <span>{t("parentArchivedInlineNotice")}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isRestoreDisabled}
                      onClick={() => handleRestore(item)}
                      className="min-h-[44px] h-11 text-xs gap-1.5 px-3 flex-1 cursor-pointer font-medium"
                      aria-label={t("restoreAriaLabel", {
                        type: tEntities(item.entityType),
                        title: item.title,
                      })}
                    >
                      {isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <RotateCcw className="size-4" />
                      )}
                      <span>
                        {isPending
                          ? t("restoreSubmitting")
                          : t("restoreAction")}
                      </span>
                    </Button>
                    {renderRowAction && renderRowAction(item)}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
