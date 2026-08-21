import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TASK_STATUS_MAP, TASK_PRIORITY_MAP } from "@/lib/status-maps";
import { TaskPriorityBadge } from "@/components/shared/projects/project-tasks/task-priority-badge";
import { TaskStatusBadge } from "@/components/shared/projects/project-tasks/task-status-badge";
import { TaskKanbanCard } from "@/components/shared/projects/project-tasks/task-kanban-card";
import type { TaskWithAssignee } from "@/lib/projects/queries";

vi.mock("server-only", () => ({}));

vi.mock("@/config/app.config", () => ({
  publicConfig: {
    appUrl: "http://localhost:3000",
    supabaseUrl: "https://example.supabase.co",
    supabasePublishableKey: "sb_publishable_test_key",
  },
  serverConfig: {
    supabaseServiceRoleKey: "sb_secret_test_key",
  },
}));

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => {
    return (key: string) => {
      if (
        namespace === "projects.tasks.priority" ||
        namespace === "tasks.priority"
      ) {
        const map: Record<string, string> = {
          low: "Baja",
          medium: "Media",
          high: "Alta",
          blocking: "Bloqueante",
        };
        return map[key] ?? key;
      }
      if (
        namespace === "projects.tasks.taskStatus" ||
        namespace === "tasks.taskStatus"
      ) {
        const map: Record<string, string> = {
          pending: "Pendiente",
          in_progress: "En progreso",
          inProgress: "En progreso",
          in_review: "En revisión",
          inReview: "En revisión",
          completed: "Completada",
          blocked: "Bloqueada",
        };
        return map[key] ?? key;
      }
      if (
        namespace === "projects.tasks.taskType" ||
        namespace === "tasks.taskType"
      ) {
        return key === "internal_work" || key === "internalWork"
          ? "Trabajo interno"
          : "Solicitud de cliente";
      }
      if (namespace === "projects.tasks" || namespace === "tasks") {
        return key;
      }
      if (namespace === "projects.roster.capacities") {
        return "PM Lead";
      }
      return key;
    };
  },
  useLocale: () => "es",
}));

// Mock @hello-pangea/dnd Draggable
vi.mock("@hello-pangea/dnd", () => ({
  Draggable: ({
    children,
  }: {
    children: (
      provided: {
        innerRef: () => void;
        draggableProps: Record<string, unknown>;
        dragHandleProps: Record<string, unknown>;
      },
      snapshot: { isDragging: boolean },
    ) => React.ReactNode;
  }) =>
    children(
      {
        innerRef: () => {},
        draggableProps: {},
        dragHandleProps: {},
      },
      { isDragging: false },
    ),
}));

describe("Task Status vs Priority Semantic Distinction", () => {
  it("TASK_STATUS_MAP.blocked.icon is NOT the same icon as TASK_PRIORITY_MAP.blocking.icon", () => {
    expect(TASK_STATUS_MAP.blocked.icon).not.toBe(
      TASK_PRIORITY_MAP.blocking.icon,
    );
  });

  it("TASK_STATUS_MAP.blocked and TASK_PRIORITY_MAP.blocking have distinct badgeBg and badgeFg styles", () => {
    expect(TASK_STATUS_MAP.blocked.badgeBg).not.toBe(
      TASK_PRIORITY_MAP.blocking.badgeBg,
    );
    expect(TASK_STATUS_MAP.blocked.badgeFg).not.toBe(
      TASK_PRIORITY_MAP.blocking.badgeFg,
    );
    expect(TASK_PRIORITY_MAP.blocking.badgeBg).toContain("rose");
    expect(TASK_STATUS_MAP.blocked.badgeBg).toContain("red");
  });

  it("TaskPriorityBadge with priority='blocking' renders 'Bloqueante' text with rose background", () => {
    const html = renderToStaticMarkup(
      <TaskPriorityBadge priority="blocking" />,
    );
    expect(html).toContain("Bloqueante");
    expect(html).toContain("bg-rose-200");
  });

  it("TaskStatusBadge with status='blocked' renders 'Bloqueada' text with red background", () => {
    const html = renderToStaticMarkup(<TaskStatusBadge status="blocked" />);
    expect(html).toContain("Bloqueada");
    expect(html).toContain("bg-red-100");
  });

  it("TaskKanbanCard with priority='blocking' applies rose left-border accent", () => {
    const blockingTask: TaskWithAssignee = {
      id: "task-blocking",
      project_id: "proj-1",
      title: "Critical architecture design",
      description: "Blocks all other tasks",
      task_type: "internal_work",
      priority: "blocking",
      status: "in_progress",
      deadline_at: "2026-11-30T12:00:00Z",
      assignee_id: "user-1",
      assigned_at: "2026-08-19T00:00:00Z",
      has_deliverables: false,
      started_at: null,
      completed_at: null,
      deleted_at: null,
      created_by: "user-1",
      updated_by: null,
      created_at: "2026-08-19T00:00:00Z",
      updated_at: "2026-08-19T00:00:00Z",
      assignee: {
        id: "user-1",
        full_name: "Ana Morales",
        role: "pm",
        avatar_url: null,
      },
    };

    const html = renderToStaticMarkup(
      <TaskKanbanCard
        task={blockingTask}
        index={0}
        isWatcher={false}
        onClick={vi.fn()}
      />,
    );

    expect(html).toContain("border-l-rose-400");
    expect(html).toContain("Critical architecture design");
  });

  it("TaskKanbanCard with status='blocked' but priority='medium' does NOT have rose left-border accent", () => {
    const blockedTask: TaskWithAssignee = {
      id: "task-blocked",
      project_id: "proj-1",
      title: "Blocked waiting on client assets",
      description: "External blocker",
      task_type: "internal_work",
      priority: "medium",
      status: "blocked",
      deadline_at: "2026-11-30T12:00:00Z",
      assignee_id: "user-1",
      assigned_at: "2026-08-19T00:00:00Z",
      has_deliverables: false,
      started_at: null,
      completed_at: null,
      deleted_at: null,
      created_by: "user-1",
      updated_by: null,
      created_at: "2026-08-19T00:00:00Z",
      updated_at: "2026-08-19T00:00:00Z",
      assignee: {
        id: "user-1",
        full_name: "Ana Morales",
        role: "pm",
        avatar_url: null,
      },
    };

    const html = renderToStaticMarkup(
      <TaskKanbanCard
        task={blockedTask}
        index={0}
        isWatcher={false}
        onClick={vi.fn()}
      />,
    );

    expect(html).not.toContain("border-l-rose-400");
    expect(html).toContain("Blocked waiting on client assets");
  });
});
