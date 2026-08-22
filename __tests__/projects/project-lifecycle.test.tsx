import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import esCatalog from "../../messages/es-MX.json";
import type {
  ProjectDetail,
  ProjectCompletionCyclesView,
  TaskWithAssignee,
} from "@/lib/projects/queries";

vi.mock("server-only", () => ({}));

const { mockSupabase, mockSession, mockRpc } = vi.hoisted(() => {
  const mockRpc = vi.fn().mockResolvedValue({
    data: {
      project_id: "proj-123",
      is_ready: true,
      unfinished_task_count: 0,
      unfinished_tasks: [],
      unfinished_deliverable_count: 0,
      unfinished_deliverables: [],
    },
    error: null,
  });

  const mockSupabase = {
    rpc: mockRpc,
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  };

  const mockSession = {
    user: { id: "user-pm-111", email: "pm@joya.test" },
    role: "pm",
    profile: {
      id: "user-pm-111",
      full_name: "PM User",
      role: "pm",
    },
  };

  return {
    mockSupabase,
    mockSession,
    mockRpc,
  };
});

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

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
    setAll: vi.fn(),
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi
    .fn()
    .mockImplementation(() => Promise.resolve(mockSession)),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockReturnValue(mockSupabase),
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-menu">{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-menu-trigger">{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-menu-content">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <div data-testid="dropdown-menu-item" onClick={onClick}>
      {children}
    </div>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => {
    return (key: string, params?: Record<string, unknown>) => {
      const fullPath = namespace ? `${namespace}.${key}` : key;
      const val = fullPath
        .split(".")
        .reduce<unknown>(
          (acc, part) => (acc as Record<string, unknown>)?.[part],
          esCatalog,
        );
      if (typeof val === "string") {
        if (params) {
          let str = val;
          for (const [k, v] of Object.entries(params)) {
            str = str.replace(`{${k}}`, String(v));
          }
          return str;
        }
        return val;
      }
      return fullPath;
    };
  },
  useFormatter: () => ({
    dateTime: (date: Date) => date.toISOString().slice(0, 10),
  }),
  useLocale: () => "es",
}));

import {
  getCompletionReadinessAction,
  reopenProjectAction,
} from "@/lib/projects/lifecycle-actions";
import { CompletedProjectBanner } from "@/components/shared/projects/project-workspace/completed-project-banner";
import { ProjectHeader } from "@/components/shared/projects/project-workspace/project-header";
import { CompletionCyclesCard } from "@/components/shared/projects/project-workspace/completion-cycles-card";
import { TasksTab } from "@/components/shared/projects/project-tasks/tasks-tab";

const mockActiveProject: ProjectDetail = {
  id: "proj-123",
  name: "Proyecto En Progreso",
  project_type: "client",
  status: "in_progress",
  client_id: "client-1",
  client_scope: "Scope notes",
  internal_description: "Internal notes",
  deadline_at: "2026-12-31T00:00:00Z",
  drive_folder_url: null,
  completed_at: null,
  archived_at: null,
  deleted_at: null,
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
  created_by: "user-1",
  updated_by: null,
  members: [
    {
      id: "pm-1",
      project_id: "proj-123",
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

const mockCompletedProject: ProjectDetail = {
  ...mockActiveProject,
  id: "proj-completed",
  name: "Proyecto Completado",
  status: "completed",
  completed_at: "2026-08-15T10:00:00Z",
};

describe("S04-05 Project Completion, Reopening, and Visible Audit Context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.role = "pm";
  });

  // ── 1. Server Actions: getCompletionReadinessAction ────────────────────────
  describe("getCompletionReadinessAction", () => {
    it("rejects unauthorized roles (e.g. operator, client) with UNAUTHORIZED", async () => {
      mockSession.role = "operator";
      const result = await getCompletionReadinessAction("proj-123");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("UNAUTHORIZED");
      }
    });

    it("returns readiness data when called by authorized pm or admin", async () => {
      mockSession.role = "pm";
      mockRpc.mockResolvedValueOnce({
        data: {
          project_id: "proj-123",
          is_ready: true,
          unfinished_task_count: 0,
          unfinished_tasks: [],
          unfinished_deliverable_count: 0,
          unfinished_deliverables: [],
        },
        error: null,
      });

      const result = await getCompletionReadinessAction("proj-123");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.is_ready).toBe(true);
        expect(result.data.unfinished_task_count).toBe(0);
      }
    });

    it("forwards error when underlying command fails", async () => {
      mockSession.role = "admin";
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: "Database connection failure" },
      });

      const result = await getCompletionReadinessAction("proj-123");
      expect(result.ok).toBe(false);
    });
  });

  // ── 2. Server Actions: reopenProjectAction ─────────────────────────────────
  describe("reopenProjectAction", () => {
    it("rejects unauthorized roles with UNAUTHORIZED", async () => {
      mockSession.role = "client";
      const result = await reopenProjectAction({
        project_id: "a0000000-0000-0000-0000-000000000001",
        reopen_reason: "Client requests revisions",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("UNAUTHORIZED");
      }
    });

    it("returns VALIDATION_FAILED when reopen_reason is empty or whitespace", async () => {
      mockSession.role = "pm";
      const result = await reopenProjectAction({
        project_id: "a0000000-0000-0000-0000-000000000001",
        reopen_reason: "   ",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
      }
    });

    it("returns VALIDATION_FAILED when reopen_reason exceeds 500 characters", async () => {
      mockSession.role = "pm";
      const longReason = "a".repeat(501);
      const result = await reopenProjectAction({
        project_id: "a0000000-0000-0000-0000-000000000001",
        reopen_reason: longReason,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
      }
    });

    it("calls transition_project_status with next_status: in_progress and returns success", async () => {
      mockSession.role = "pm";
      mockRpc.mockResolvedValueOnce({
        data: {
          project_id: "a0000000-0000-0000-0000-000000000001",
          old_status: "completed",
          new_status: "in_progress",
        },
        error: null,
      });

      const result = await reopenProjectAction({
        project_id: "a0000000-0000-0000-0000-000000000001",
        reopen_reason: "Approved scope expansion",
      });

      expect(result.ok).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith(
        "transition_project_status",
        expect.objectContaining({
          p_project_id: "a0000000-0000-0000-0000-000000000001",
          p_next_status: "in_progress",
          p_reopen_reason: "Approved scope expansion",
          p_confirm_unfinished: false,
        }),
      );
    });
  });

  // ── 3. Component: CompletedProjectBanner ───────────────────────────────────
  describe("CompletedProjectBanner", () => {
    it("renders completion date and reopen CTA for PM Lead", () => {
      const html = renderToStaticMarkup(
        <CompletedProjectBanner
          completedAt="2026-08-15T10:00:00Z"
          effectiveCapacity="pm_lead"
          onReopenClick={vi.fn()}
        />,
      );

      expect(html).toContain("Proyecto Completado");
      expect(html).toContain("2026-08-15");
      expect(html).toContain("Reabrir Proyecto");
    });

    it("hides reopen CTA button when user is a PM Watcher", () => {
      const html = renderToStaticMarkup(
        <CompletedProjectBanner
          completedAt="2026-08-15T10:00:00Z"
          effectiveCapacity="pm_watcher"
          onReopenClick={vi.fn()}
        />,
      );

      expect(html).toContain("Proyecto Completado");
      expect(html).not.toContain("Reabrir Proyecto");
    });
  });

  // ── 4. Component: ProjectHeader Dropdown Items ───────────────────
  describe("ProjectHeader Dropdown Items", () => {
    it("shows 'Completar Proyecto' and 'Cancelar Proyecto' on active project for PM Lead", () => {
      const html = renderToStaticMarkup(
        <ProjectHeader
          project={mockActiveProject}
          clients={[]}
          effectiveCapacity="pm_lead"
          baseHref="/pm/proyectos"
          onOpenEditDialog={vi.fn()}
          onOpenStatusDialog={vi.fn()}
        />,
      );

      expect(html).toContain("Completar Proyecto");
      expect(html).toContain("Cancelar Proyecto");
      expect(html).not.toContain("Reabrir Proyecto");
      expect(html).toContain("Editar Información");
    });

    it("shows 'Reabrir Proyecto' and suppresses 'Cancelar Proyecto' and 'Completar Proyecto' on completed project", () => {
      const html = renderToStaticMarkup(
        <ProjectHeader
          project={mockCompletedProject}
          clients={[]}
          effectiveCapacity="pm_lead"
          baseHref="/pm/proyectos"
          onOpenEditDialog={vi.fn()}
          onOpenStatusDialog={vi.fn()}
        />,
      );

      expect(html).toContain("Reabrir Proyecto");
      expect(html).not.toContain("Completar Proyecto");
      expect(html).not.toContain("Cancelar Proyecto");
      // Edit button remains available for metadata maintenance
      expect(html).toContain("Editar Información");
    });

    it("hides all lifecycle dropdown items for PM Watcher", () => {
      const html = renderToStaticMarkup(
        <ProjectHeader
          project={mockCompletedProject}
          clients={[]}
          effectiveCapacity="pm_watcher"
          baseHref="/pm/proyectos"
          onOpenEditDialog={vi.fn()}
          onOpenStatusDialog={vi.fn()}
        />,
      );

      expect(html).not.toContain("Reabrir Proyecto");
      expect(html).not.toContain("Completar Proyecto");
      expect(html).not.toContain("Editar Información");
    });
  });

  // ── 5. Component: TasksTab 'Nueva Tarea' Gating ────────────────────────────
  describe("TasksTab Gating on Completed Projects", () => {
    const mockTasks: TaskWithAssignee[] = [
      {
        id: "task-1",
        project_id: "proj-123",
        title: "Tarea Existente",
        description: "Detalles",
        task_type: "internal_work",
        priority: "medium",
        status: "completed",
        deadline_at: "2026-11-15T12:00:00Z",
        has_deliverables: false,
        assignee_id: "user-1",
        assigned_at: "2026-08-01T00:00:00Z",
        started_at: null,
        completed_at: null,
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

    it("shows 'Nueva Tarea' button on active projects for PM Lead", () => {
      const html = renderToStaticMarkup(
        <TasksTab
          project={mockActiveProject}
          initialTasks={mockTasks}
          effectiveCapacity="pm_lead"
          locale="es"
        />,
      );

      expect(html).toContain("Nueva Tarea");
    });

    it("hides 'Nueva Tarea' button on completed projects", () => {
      const html = renderToStaticMarkup(
        <TasksTab
          project={mockCompletedProject}
          initialTasks={mockTasks}
          effectiveCapacity="pm_lead"
          locale="es"
        />,
      );

      expect(html).not.toContain("Nueva Tarea");
    });
  });

  // ── 6. Component: CompletionCyclesCard ─────────────────────────────────────
  describe("CompletionCyclesCard", () => {
    const mockCycles: ProjectCompletionCyclesView[] = [
      {
        project_id: "proj-123",
        project_name: "Proyecto Test",
        cycle_number: 1,
        completed_at: "2026-08-10T12:00:00Z",
        completed_by: "user-1",
        unfinished_task_count: 2,
        unfinished_deliverable_count: 0,
        override_confirmed: true,
        reopened_at: "2026-08-12T14:00:00Z",
        reopened_by: "user-1",
        reopen_reason: "Cliente solicitó cambios de último momento",
        cycle_duration_days: 15,
        current_completed_at: null,
        current_project_status: "in_progress",
      },
      {
        project_id: "proj-123",
        project_name: "Proyecto Test",
        cycle_number: 2,
        completed_at: "2026-08-18T16:00:00Z",
        completed_by: "user-1",
        unfinished_task_count: 0,
        unfinished_deliverable_count: 0,
        override_confirmed: false,
        reopened_at: null,
        reopened_by: null,
        reopen_reason: null,
        cycle_duration_days: 6,
        current_completed_at: "2026-08-18T16:00:00Z",
        current_project_status: "completed",
      },
    ];

    it("renders all available cycle fields including cycle number, dates, duration, override badge, and reopen reason", () => {
      const html = renderToStaticMarkup(
        <CompletionCyclesCard cycles={mockCycles} />,
      );

      expect(html).toContain("Historial de Ciclos de Completado");
      expect(html).toContain("Ciclo #1");
      expect(html).toContain("Ciclo #2");
      expect(html).toContain("Duración: 15 días");
      expect(html).toContain("Duración: 6 días");
      expect(html).toContain("Completado con trabajo pendiente");
      expect(html).toContain("Cliente solicitó cambios de último momento");
      expect(html).toContain("Ciclo activo");
    });
  });
});
