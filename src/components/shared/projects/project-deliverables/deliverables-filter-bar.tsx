"use client";

import { useTranslations } from "next-intl";
import { Plus, Table as TableIcon, LayoutGrid, FilterX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProjectDetail } from "@/lib/projects/queries";
import type { DeliverableStatus } from "@/lib/deliverables/queries";

import { DELIVERABLE_STATUS_TRANSLATION_KEYS } from "@/lib/status-maps";

interface DeliverablesFilterBarProps {
  project: ProjectDetail;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  assigneeFilter: string;
  setAssigneeFilter: (val: string) => void;
  viewMode: "table" | "cards";
  setViewMode: (mode: "table" | "cards") => void;
  isLeadOrAdmin: boolean;
  hasTasks: boolean;
  onOpenCreate: () => void;
}

export function DeliverablesFilterBar({
  project,
  statusFilter,
  setStatusFilter,
  assigneeFilter,
  setAssigneeFilter,
  viewMode,
  setViewMode,
  isLeadOrAdmin,
  hasTasks,
  onOpenCreate,
}: DeliverablesFilterBarProps) {
  const t = useTranslations("projects.workspace.deliverables");

  const statuses: DeliverableStatus[] = [
    "pending",
    "awaiting_internal_review",
    "awaiting_client_review",
    "approved",
    "changes_requested",
    "delivered",
    "submitted",
  ];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={statusFilter}
          onValueChange={(val) => {
            if (val) setStatusFilter(val);
          }}
          items={[
            { value: "all", label: t("allStatuses") },
            ...statuses.map((s) => ({
              value: s,
              label: t(
                `status.${DELIVERABLE_STATUS_TRANSLATION_KEYS[s]}` as "status.pending",
              ),
            })),
          ]}
        >
          <SelectTrigger className="w-[170px] h-8 text-xs bg-card">
            <SelectValue placeholder={t("filterStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">
              {t("allStatuses")}
            </SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s} value={s} className="text-xs">
                {t(
                  `status.${DELIVERABLE_STATUS_TRANSLATION_KEYS[s]}` as "status.pending",
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={assigneeFilter}
          onValueChange={(val) => {
            if (val) setAssigneeFilter(val);
          }}
          items={[
            { value: "all", label: t("allAssignees") },
            ...project.members
              .filter((m) => !m.deleted_at && m.profile)
              .map((m) => ({
                value: m.user_id,
                label: m.profile?.full_name || t("userFallback"),
              })),
          ]}
        >
          <SelectTrigger className="w-[170px] h-8 text-xs bg-card">
            <SelectValue placeholder={t("filterAssignee")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">
              {t("allAssignees")}
            </SelectItem>
            {project.members
              .filter((m) => !m.deleted_at && m.profile)
              .map((m) => (
                <SelectItem
                  key={m.user_id}
                  value={m.user_id}
                  className="text-xs"
                >
                  {m.profile?.full_name || t("userFallback")}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        {(statusFilter !== "all" || assigneeFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter("all");
              setAssigneeFilter("all");
            }}
            className="h-8 px-2 text-xs text-muted-foreground gap-1"
          >
            <FilterX className="size-3.5" />
            <span>{t("clearFilters")}</span>
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto">
        <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border/60">
          <Button
            variant={viewMode === "table" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setViewMode("table")}
            className="size-7"
            aria-label={t("viewTable")}
          >
            <TableIcon className="size-3.5" />
          </Button>
          <Button
            variant={viewMode === "cards" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setViewMode("cards")}
            className="size-7"
            aria-label={t("viewCards")}
          >
            <LayoutGrid className="size-3.5" />
          </Button>
        </div>

        {isLeadOrAdmin && hasTasks && (
          <Button
            onClick={onOpenCreate}
            size="sm"
            className="h-8 text-xs gap-1.5 shadow-xs"
          >
            <Plus className="size-3.5" />
            <span>{t("newDeliverableAction")}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
