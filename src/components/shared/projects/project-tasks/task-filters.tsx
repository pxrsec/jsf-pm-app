"use client";

import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  ProjectMemberWithProfile,
  TaskFilters as TaskFiltersType,
  TaskPriority,
  TaskStatus,
  TaskType,
} from "@/lib/projects/queries";

interface TaskFiltersProps {
  members: ProjectMemberWithProfile[];
  filters: TaskFiltersType;
  onChange: (filters: TaskFiltersType) => void;
  onClear: () => void;
}

export function TaskFilters({
  members,
  filters,
  onChange,
  onClear,
}: TaskFiltersProps) {
  const t = useTranslations("projects.tasks.filters");
  const tStatus = useTranslations("projects.tasks.taskStatus");
  const tPriority = useTranslations("projects.tasks.priority");
  const tType = useTranslations("projects.tasks.taskType");

  const activeMembers = members.filter(
    (m) => !m.deleted_at && m.profile && m.profile.is_active,
  );

  const hasActiveFilters = Boolean(
    filters.status || filters.priority || filters.task_type || filters.assignee_id,
  );

  return (
    <div className="flex flex-wrap items-center gap-2.5 py-1">
      {/* Status Filter */}
      <div className="w-[140px] sm:w-[150px]">
        <Select
          value={filters.status ?? "all"}
          onValueChange={(val) =>
            onChange({
              ...filters,
              status: val === "all" ? undefined : (val as TaskStatus),
            })
          }
        >
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder={t("statusLabel")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">
              {t("allStatuses")}
            </SelectItem>
            <SelectItem value="pending" className="text-xs">
              {tStatus("pending")}
            </SelectItem>
            <SelectItem value="in_progress" className="text-xs">
              {tStatus("inProgress")}
            </SelectItem>
            <SelectItem value="in_review" className="text-xs">
              {tStatus("inReview")}
            </SelectItem>
            <SelectItem value="completed" className="text-xs">
              {tStatus("completed")}
            </SelectItem>
            <SelectItem value="blocked" className="text-xs">
              {tStatus("blocked")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Priority Filter */}
      <div className="w-[140px] sm:w-[150px]">
        <Select
          value={filters.priority ?? "all"}
          onValueChange={(val) =>
            onChange({
              ...filters,
              priority: val === "all" ? undefined : (val as TaskPriority),
            })
          }
        >
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder={t("priorityLabel")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">
              {t("allPriorities")}
            </SelectItem>
            <SelectItem value="blocking" className="text-xs font-semibold text-rose-700 dark:text-rose-400">
              {tPriority("blocking")}
            </SelectItem>
            <SelectItem value="high" className="text-xs">
              {tPriority("high")}
            </SelectItem>
            <SelectItem value="medium" className="text-xs">
              {tPriority("medium")}
            </SelectItem>
            <SelectItem value="low" className="text-xs">
              {tPriority("low")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Type Filter */}
      <div className="w-[140px] sm:w-[150px]">
        <Select
          value={filters.task_type ?? "all"}
          onValueChange={(val) =>
            onChange({
              ...filters,
              task_type: val === "all" ? undefined : (val as TaskType),
            })
          }
        >
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder={t("typeLabel")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">
              {t("allTypes")}
            </SelectItem>
            <SelectItem value="internal_work" className="text-xs">
              {tType("internalWork")}
            </SelectItem>
            <SelectItem value="client_request" className="text-xs">
              {tType("clientRequest")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Assignee Filter */}
      <div className="w-[150px] sm:w-[170px]">
        <Select
          value={filters.assignee_id ?? "all"}
          onValueChange={(val) =>
            onChange({
              ...filters,
              assignee_id: val === "all" || !val ? undefined : val,
            })
          }
        >
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder={t("assigneeLabel")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">
              {t("allAssignees")}
            </SelectItem>
            {activeMembers.map((m) => (
              <SelectItem key={m.id} value={m.user_id} className="text-xs">
                {m.profile?.full_name ?? "Usuario"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-9 text-xs text-muted-foreground hover:text-foreground gap-1 px-2.5"
        >
          <X className="size-3.5" />
          <span>{t("clearFilters")}</span>
        </Button>
      )}
    </div>
  );
}
