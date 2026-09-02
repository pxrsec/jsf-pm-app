"use client";

import { useState } from "react";
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

interface RecycleBinViewProps {
  initialResult: AvailableResult<OperationalRecycleBinItem[]>;
  renderRowAction?: (item: OperationalRecycleBinItem) => React.ReactNode;
}

export function RecycleBinView({
  initialResult,
  renderRowAction,
}: RecycleBinViewProps) {
  const t = useTranslations("operationalLifecycle.recycleBin");
  const tEntities = useTranslations(
    "operationalLifecycle.recycleBin.entityTypes",
  );
  const tErrors = useTranslations("operationalLifecycle.errors");
  const format = useFormatter();
  const router = useRouter();

  const [pendingRestores, setPendingRestores] = useState<Set<string>>(
    new Set(),
  );

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
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
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
            className="text-xs mt-2"
          >
            {t("retryAction")}
          </Button>
        </div>
      </div>
    );
  }

  const items = initialResult.data;

  return (
    <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          {t("description")}
        </p>
      </div>

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
                {items.map((item) => {
                  const key = `${item.entityType}:${item.entityId}`;
                  const isPending = pendingRestores.has(key);
                  const isRestoreDisabled = item.parentIsArchived || isPending;

                  return (
                    <TableRow key={key}>
                      <TableCell className="py-3">
                        <Badge
                          variant="outline"
                          className="text-[10px] gap-1 px-2 py-0.5 font-normal capitalize"
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

          {/* Mobile Cards View (hidden on desktop) */}
          <div className="md:hidden space-y-3">
            {items.map((item) => {
              const key = `mobile-${item.entityType}:${item.entityId}`;
              const isPending = pendingRestores.has(
                `${item.entityType}:${item.entityId}`,
              );
              const isRestoreDisabled = item.parentIsArchived || isPending;

              return (
                <div
                  key={key}
                  className="bg-card rounded-xl border border-border p-4 shadow-2xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Badge
                      variant="outline"
                      className="text-[10px] gap-1 px-2 py-0.5 font-normal capitalize shrink-0"
                    >
                      {getEntityIcon(item.entityType)}
                      <span>{tEntities(item.entityType)}</span>
                    </Badge>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {format.dateTime(new Date(item.archivedAt), {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-foreground line-clamp-2">
                      {item.title}
                    </h3>
                    {item.archiveReason && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {item.archiveReason}
                      </p>
                    )}
                  </div>

                  {item.parentIsArchived && (
                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg p-2 text-xs text-amber-800 dark:text-amber-300">
                      {t("parentArchivedInlineNotice")}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/60">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isRestoreDisabled}
                      onClick={() => handleRestore(item)}
                      className="min-h-[44px] h-11 text-xs gap-1.5 px-3 flex-1 sm:flex-initial"
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
