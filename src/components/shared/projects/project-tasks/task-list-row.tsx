"use client";

import { useTranslations } from "next-intl";
import { format, isPast } from "date-fns";
import {
  Calendar,
  Edit2,
  Eye,
  MoreHorizontal,
  Paperclip,
  Trash2,
  User,
} from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TaskPriorityBadge } from "./task-priority-badge";
import { TaskStatusBadge } from "./task-status-badge";
import type { TaskWithAssignee } from "@/lib/projects/queries";
import { cn } from "@/lib/utils";

interface TaskListRowProps {
  task: TaskWithAssignee;
  isWatcher: boolean;
  onViewDetails: (task: TaskWithAssignee) => void;
  onEdit: (task: TaskWithAssignee) => void;
  onArchive: (task: TaskWithAssignee) => void;
}

export function TaskListRow({
  task,
  isWatcher,
  onViewDetails,
  onEdit,
  onArchive,
}: TaskListRowProps) {
  const tType = useTranslations("projects.tasks.taskType");
  const tList = useTranslations("projects.tasks.list.actions");

  const deadlineDate = task.deadline_at ? new Date(task.deadline_at) : null;
  const isOverdue =
    deadlineDate && isPast(deadlineDate) && task.status !== "completed";
  const isBlocking = task.priority === "blocking";
  const isBlocked = task.status === "blocked";
  const typeKey =
    task.task_type === "internal_work" ? "internalWork" : "clientRequest";

  return (
    <TableRow
      className={cn(
        "cursor-pointer hover:bg-muted/50 transition-colors",
        isBlocking && "border-l-4 border-l-rose-400 dark:border-l-rose-500",
        isBlocked && "bg-red-50/40 dark:bg-red-950/20",
      )}
      onClick={() => onViewDetails(task)}
    >
      {/* Title */}
      <TableCell className="font-medium text-foreground py-3">
        <div className="flex items-center gap-2">
          <span className="hover:underline line-clamp-1">{task.title}</span>
          {task.has_deliverables && (
            <span className="p-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300">
              <Paperclip className="size-3" />
            </span>
          )}
        </div>
      </TableCell>

      {/* Type */}
      <TableCell className="py-3">
        <Badge variant="outline" className="text-[11px] font-normal">
          {tType(typeKey)}
        </Badge>
      </TableCell>

      {/* Status */}
      <TableCell className="py-3">
        <TaskStatusBadge status={task.status} />
      </TableCell>

      {/* Priority */}
      <TableCell className="py-3">
        <TaskPriorityBadge priority={task.priority} />
      </TableCell>

      {/* Assignee */}
      <TableCell className="py-3">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 font-semibold text-[10px] text-primary">
            {task.assignee?.full_name?.charAt(0) ?? (
              <User className="size-3" />
            )}
          </div>
          <span className="text-xs text-foreground truncate max-w-[130px]">
            {task.assignee?.full_name ?? "Sin asignar"}
          </span>
        </div>
      </TableCell>

      {/* Deadline */}
      <TableCell className="py-3">
        {deadlineDate ? (
          <div
            className={cn(
              "flex items-center gap-1.5 text-xs font-medium",
              isOverdue ? "text-destructive font-bold" : "text-muted-foreground",
            )}
          >
            <Calendar className="size-3.5 shrink-0" />
            <span>{format(deadlineDate, "dd MMM yyyy")}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Actions */}
      <TableCell
        className="py-3 text-right"
        onClick={(e) => e.stopPropagation()}
      >
        {!isWatcher ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground size-8 cursor-pointer hover:bg-muted"
              aria-label="Menu"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onViewDetails(task)}>
                <Eye className="mr-2 size-4" />
                <span>{tList("viewDetails")}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(task)}>
                <Edit2 className="mr-2 size-4" />
                <span>{tList("edit")}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onArchive(task)}
              >
                <Trash2 className="mr-2 size-4" />
                <span>{tList("archive")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewDetails(task)}
            className="size-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <Eye className="size-4" />
            <span className="sr-only">{tList("viewDetails")}</span>
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
