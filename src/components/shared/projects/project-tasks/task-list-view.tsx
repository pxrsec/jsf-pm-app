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
import { Button } from "@/components/ui/button";
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
  onViewDetails: (task: TaskWithAssignee) => void;
  onEdit: (task: TaskWithAssignee) => void;
  onArchive: (task: TaskWithAssignee) => void;
}

export function TaskListView({
  tasks,
  isWatcher,
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
      let comparison = 0;

      if (sortField === "title") {
        comparison = a.title.localeCompare(b.title);
      } else if (sortField === "priority") {
        comparison =
          (PRIORITY_WEIGHTS[b.priority] ?? 0) -
          (PRIORITY_WEIGHTS[a.priority] ?? 0);
      } else if (sortField === "status") {
        comparison =
          (STATUS_WEIGHTS[a.status] ?? 0) - (STATUS_WEIGHTS[b.status] ?? 0);
      } else if (sortField === "deadline_at") {
        const dateA = a.deadline_at ? new Date(a.deadline_at).getTime() : 0;
        const dateB = b.deadline_at ? new Date(b.deadline_at).getTime() : 0;
        comparison = dateA - dateB;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [tasks, sortField, sortDirection]);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xs">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-[30%]">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("title")}
                  className="-ml-3 h-8 text-xs font-semibold"
                >
                  <span>{tColumns("title")}</span>
                  <ArrowUpDown className="ml-1 size-3.5" />
                </Button>
              </TableHead>

              <TableHead className="w-[12%] text-xs font-semibold">
                {tColumns("type")}
              </TableHead>

              <TableHead className="w-[15%]">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("status")}
                  className="-ml-3 h-8 text-xs font-semibold"
                >
                  <span>{tColumns("status")}</span>
                  <ArrowUpDown className="ml-1 size-3.5" />
                </Button>
              </TableHead>

              <TableHead className="w-[15%]">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("priority")}
                  className="-ml-3 h-8 text-xs font-semibold"
                >
                  <span>{tColumns("priority")}</span>
                  <ArrowUpDown className="ml-1 size-3.5" />
                </Button>
              </TableHead>

              <TableHead className="w-[15%] text-xs font-semibold">
                {tColumns("assignee")}
              </TableHead>

              <TableHead className="w-[13%]">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("deadline_at")}
                  className="-ml-3 h-8 text-xs font-semibold"
                >
                  <span>{tColumns("deadline")}</span>
                  <ArrowUpDown className="ml-1 size-3.5" />
                </Button>
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
