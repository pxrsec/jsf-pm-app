import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TasksTab } from "@/components/shared/projects/project-tasks/tasks-tab";
import { TaskFilters } from "@/components/shared/projects/project-tasks/task-filters";
import type { ProjectDetail, TaskWithAssignee } from "@/lib/projects/queries";

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

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => React.createElement("a", { href, ...props }, children),
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/pm/proyectos/proj-1",
  redirect: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => {
    return (key: string, params?: Record<string, unknown>) => {
      if (
        namespace === "projects.tasks.filters" ||
        namespace === "tasks.filters"
      ) {
        const map: Record<string, string> = {
          statusLabel: "Estado",
          priorityLabel: "Prioridad",
          typeLabel: "Tipo",
          assigneeLabel: "Asignado a",
          allStatuses: "Todos los estados",
          allPriorities: "Todas las prioridades",
          allTypes: "Todos los tipos",
          allAssignees: "Todos los asignados",
          clearFilters: "Limpiar filtros",
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
        namespace === "projects.tasks.taskType" ||
        namespace === "tasks.taskType"
      ) {
        return key === "internal_work" || key === "internalWork"
          ? "Trabajo interno"
          : "Solicitud de cliente";
      }
      if (namespace === "projects.tasks" || namespace === "tasks") {
        const map: Record<string, string> = {
          tabTitle: "Tareas",
          newTaskAction: "Nueva Tarea",
          newTaskButton: "Nueva Tarea",
          viewKanban: "Tablero Kanban",
          viewList: "Vista de Lista",
          "emptyState.noTasks": "Este proyecto aún no tiene tareas.",
          "emptyState.noTasksDescription":
            "Crea la primera tarea para comenzar a gestionar el trabajo del equipo.",
          "emptyState.createFirstTask": "Crear primera tarea",
          "emptyState.noFilterResults":
            "No se encontraron tareas con los filtros seleccionados.",
          "watcherMode.readOnlyLabel": "Solo lectura — capacidad observador",
          overdue: "Vencida",
          hasDeliverablesBadge: "Con entregables",
        };
        if (key === "kanban.columnAriaLabel") {
          return `Columna: ${params?.status} — ${params?.count} tareas`;
        }
        return map[key] ?? key;
      }
      if (namespace === "projects.roster.capacities") {
        return "PM Lead";
      }
      return key;
    };
  },
  useLocale: () => "es",
}));

// Mock @hello-pangea/dnd
vi.mock("@hello-pangea/dnd", () => ({
  DragDropContext: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Droppable: ({
    children,
  }: {
    children: (
      provided: {
        innerRef: () => void;
        droppableProps: Record<string, unknown>;
        placeholder: null;
      },
      snapshot: { isDraggingOver: boolean },
    ) => React.ReactNode;
  }) =>
    children(
      {
        innerRef: () => {},
        droppableProps: {},
        placeholder: null,
      },
      { isDraggingOver: false },
    ),
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

const mockProject: ProjectDetail = {
  id: "proj-1",
  name: "Portal Joya",
  project_type: "client",
  status: "in_progress",
  client_id: "client-1",
  client_scope: "Scope notes",
  internal_description: "Internal notes",
  deadline_at: "2026-12-31T00:00:00Z",
  drive_folder_url: null,
  completed_at: null,
  archived_at: null,
  archived_by: null,
  archive_reason: null,
  deleted_at: null,
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
  created_by: "user-1",
  updated_by: null,
  members: [
    {
      id: "pm-1",
      project_id: "proj-1",
      user_id: "user-1",
      member_type: "pm_lead",
      is_primary: true,
      receives_notifications: true,
      joined_at: "2026-08-01T00:00:00Z",
      deleted_at: null,
      created_by: "user-1",
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
      profile: {
        id: "user-1",
        full_name: "Ana Morales",
        role: "pm",
        avatar_url: null,
        is_active: true,
      },
    },
  ],
};

const mockTasks: TaskWithAssignee[] = [
  {
    id: "task-1",
    project_id: "proj-1",
    title: "Diseño UI",
    description: "Wireframes en Figma",
    task_type: "internal_work",
    priority: "high",
    status: "pending",
    deadline_at: "2026-11-15T12:00:00Z",
    assignee_id: "user-1",
    assigned_at: "2026-08-01T00:00:00Z",
    has_deliverables: false,
    started_at: null,
    completed_at: null,
    archived_at: null,
    archived_by: null,
    archive_reason: null,
    archived_parent_project_id: null,
    deleted_at: null,
    created_by: "user-1",
    updated_by: null,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    assignee: {
      id: "user-1",
      full_name: "Ana Morales",
      role: "pm",
      avatar_url: null,
    },
  },
  {
    id: "task-2",
    project_id: "proj-1",
    title: "Implementación Backend",
    description: "Creación de RPCs",
    task_type: "internal_work",
    priority: "blocking",
    status: "in_progress",
    deadline_at: "2026-11-20T12:00:00Z",
    assignee_id: "user-1",
    assigned_at: "2026-08-01T00:00:00Z",
    has_deliverables: true,
    started_at: null,
    completed_at: null,
    archived_at: null,
    archived_by: null,
    archive_reason: null,
    archived_parent_project_id: null,
    deleted_at: null,
    created_by: "user-1",
    updated_by: null,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    assignee: {
      id: "user-1",
      full_name: "Ana Morales",
      role: "pm",
      avatar_url: null,
    },
  },
];

describe("Task Workspace Component (TasksTab)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("PM Lead Capacity", () => {
    it("renders 'Nueva Tarea' button for PM Lead", () => {
      const html = renderToStaticMarkup(
        <TasksTab
          project={mockProject}
          initialTasks={mockTasks}
          effectiveCapacity="pm_lead"
          locale="es"
        />,
      );

      expect(html).toContain("Nueva Tarea");
    });

    it("renders both tasks across Kanban columns", () => {
      const html = renderToStaticMarkup(
        <TasksTab
          project={mockProject}
          initialTasks={mockTasks}
          effectiveCapacity="pm_lead"
          locale="es"
        />,
      );

      expect(html).toContain("Diseño UI");
      expect(html).toContain("Implementación Backend");
    });
  });

  describe("PM Watcher Capacity", () => {
    it("does NOT render 'Nueva Tarea' button for PM Watcher", () => {
      const html = renderToStaticMarkup(
        <TasksTab
          project={mockProject}
          initialTasks={mockTasks}
          effectiveCapacity="pm_watcher"
          locale="es"
        />,
      );

      expect(html).not.toContain("Nueva Tarea");
      expect(html).toContain("Diseño UI");
    });
  });

  describe("TaskFilters", () => {
    it("renders filter controls and clear button when active filters exist", () => {
      const html = renderToStaticMarkup(
        <TaskFilters
          members={mockProject.members}
          filters={{ status: "pending" }}
          onChange={vi.fn()}
          onClear={vi.fn()}
        />,
      );

      expect(html).toContain("Limpiar filtros");
    });
  });
});
