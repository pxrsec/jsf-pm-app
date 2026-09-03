"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { ArrowUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TaskListRow } from "./task-list-row";
import type { TaskWithAssignee } from "@/lib/projects/queries";

type SortField = "title" | "priority" | "status" | "deadline_at";
type SortDirection = "asc" | "desc";

const PRIORITY_WEIGHTS: Record<string, number> = {
  blocking: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const STATUS_WEIGHTS: Record<string, number> = {
  pending: 1,
  in_progress: 2,
  in_review: 3,
  completed: 4,
  blocked: 5,
};

interface TaskListViewProps {
  tasks: TaskWithAssignee[];
  isWatcher: boolean;
  canArchiveTasks?: boolean;
  onViewDetails: (task: TaskWithAssignee) => void;
  onEdit: (task: TaskWithAssignee) => void;
  onArchive: (task: TaskWithAssignee) => void;
}

export function TaskListView({
  tasks,
  isWatcher,
  canArchiveTasks = true,
  onViewDetails,
  onEdit,
  onArchive,
}: TaskListViewProps) {
  const t = useTranslations("projects.tasks");
  const tColumns = useTranslations("projects.tasks.list.columns");

  const [sortField, setSortField] = useState<SortField>("deadline_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      let aVal: string | number = a[sortField] ?? "";
      let bVal: string | number = b[sortField] ?? "";

      if (sortField === "priority") {
        aVal = PRIORITY_WEIGHTS[a.priority] ?? 0;
        bVal = PRIORITY_WEIGHTS[b.priority] ?? 0;
      } else if (sortField === "status") {
        aVal = STATUS_WEIGHTS[a.status] ?? 0;
        bVal = STATUS_WEIGHTS[b.status] ?? 0;
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [tasks, sortField, sortDirection]);

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden shadow-2xs">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead
                className="cursor-pointer select-none text-xs font-semibold"
                onClick={() => handleSort("title")}
              >
                <div className="flex items-center gap-1">
                  <span>{tColumns("title")}</span>
                  <ArrowUpDown className="size-3 text-muted-foreground" />
                </div>
              </TableHead>
              <TableHead className="text-xs font-semibold">
                {tColumns("type")}
              </TableHead>
              <TableHead
                className="cursor-pointer select-none text-xs font-semibold"
                onClick={() => handleSort("status")}
              >
                <div className="flex items-center gap-1">
                  <span>{tColumns("status")}</span>
                  <ArrowUpDown className="size-3 text-muted-foreground" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none text-xs font-semibold"
                onClick={() => handleSort("priority")}
              >
                <div className="flex items-center gap-1">
                  <span>{tColumns("priority")}</span>
                  <ArrowUpDown className="size-3 text-muted-foreground" />
                </div>
              </TableHead>
              <TableHead className="text-xs font-semibold">
                {tColumns("assignee")}
              </TableHead>
              <TableHead
                className="cursor-pointer select-none text-xs font-semibold"
                onClick={() => handleSort("deadline_at")}
              >
                <div className="flex items-center gap-1">
                  <span>{tColumns("deadline")}</span>
                  <ArrowUpDown className="size-3 text-muted-foreground" />
                </div>
              </TableHead>
              <TableHead className="w-[50px] text-right text-xs font-semibold">
                {tColumns("actions")}
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {sortedTasks.length === 0 ? (
              <TableRow>
                <td
                  colSpan={7}
                  className="h-32 text-center text-xs text-muted-foreground"
                >
                  {t("emptyState.noFilterResults")}
                </td>
              </TableRow>
            ) : (
              sortedTasks.map((task) => (
                <TaskListRow
                  key={task.id}
                  task={task}
                  isWatcher={isWatcher}
                  canArchive={canArchiveTasks}
                  onViewDetails={onViewDetails}
                  onEdit={onEdit}
                  onArchive={onArchive}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
