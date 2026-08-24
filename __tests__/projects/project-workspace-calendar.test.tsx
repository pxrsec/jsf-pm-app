// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock(
  "@/components/shared/projects/project-workspace/project-overview-tab",
  () => ({
    ProjectOverviewTab: () => (
      <div data-testid="overview-tab">Overview Tab</div>
    ),
  }),
);
vi.mock(
  "@/components/shared/projects/project-workspace/project-header",
  () => ({
    ProjectHeader: () => <div data-testid="project-header">Header</div>,
  }),
);
vi.mock("@/components/shared/projects/project-tasks/tasks-tab", () => ({
  TasksTab: () => <div data-testid="tasks-tab">Tasks Tab</div>,
}));
vi.mock(
  "@/components/shared/projects/project-deliverables/deliverables-tab",
  () => ({
    DeliverablesTab: () => (
      <div data-testid="deliverables-tab">Deliverables Tab</div>
    ),
  }),
);
vi.mock(
  "@/components/shared/projects/project-members/member-roster-tab",
  () => ({
    MemberRosterTab: () => <div data-testid="members-tab">Members Tab</div>,
  }),
);
vi.mock(
  "@/components/shared/projects/project-workspace/project-activity-tab",
  () => ({
    ProjectActivityTab: () => (
      <div data-testid="activity-tab">Activity Tab</div>
    ),
  }),
);
vi.mock(
  "@/components/shared/projects/project-workspace/project-edit-dialog",
  () => ({
    ProjectEditDialog: () => null,
  }),
);
vi.mock(
  "@/components/shared/projects/project-workspace/project-status-dialog",
  () => ({
    ProjectStatusDialog: () => null,
  }),
);
vi.mock(
  "@/components/shared/projects/project-lifecycle/project-complete-dialog",
  () => ({
    ProjectCompleteDialog: () => null,
  }),
);
vi.mock(
  "@/components/shared/projects/project-lifecycle/project-reopen-dialog",
  () => ({
    ProjectReopenDialog: () => null,
  }),
);

vi.mock("@/lib/calendar/actions", () => ({
  createCalendarMilestoneAction: vi.fn(),
  updateCalendarMilestoneAction: vi.fn(),
  softDeleteCalendarMilestoneAction: vi.fn(),
  getCalendarMilestoneForEditAction: vi.fn(),
}));

import type {
  CalendarEventDto,
  CalendarRangeState,
} from "@/lib/calendar/types";
import type { ProjectDetail } from "@/lib/projects/queries";
import { ProjectWorkspaceShell } from "@/components/shared/projects/project-workspace/project-workspace-shell";

const mockPush = vi.fn();

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      overview: "Resumen",
      tasks: "Tareas",
      deliverables: "Entregables",
      members: "Equipo",
      activity: "Actividad",
      calendar: "Calendario",
      "views.month": "Mes",
      "views.week": "Semana",
      "views.agenda": "Agenda",
      "views.list": "Lista",
      "nav.today": "Hoy",
      "nav.prev": "Anterior",
      "nav.next": "Siguiente",
      "actions.createMilestone": "Nuevo Hito",
      "states.empty": "No hay eventos",
      "scope.allProjectsFilter": "Todos los proyectos",
    };
    return map[key] ?? key;
  },
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement("a", { href, ...props }, children),
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/admin/proyectos/00000000-0000-0000-0000-000000000001",
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("tab=overview"),
}));

describe("Project Workspace Calendar Integration", () => {
  const mockProject: ProjectDetail = {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Acme Commercial",
    project_type: "client",
    status: "in_progress",
    client_id: "00000000-0000-0000-0000-000000000010",
    client_scope: "Scope notes",
    internal_description: "Internal notes",
    deadline_at: "2026-09-01T00:00:00-06:00",
    drive_folder_url: null,
    completed_at: null,
    archived_at: null,
    deleted_at: null,
    created_at: "2026-08-01T00:00:00-06:00",
    updated_at: "2026-08-01T00:00:00-06:00",
    created_by: "00000000-0000-0000-0000-000000000001",
    updated_by: null,
    members: [],
  };

  const mockRange: CalendarRangeState = {
    view: "month",
    from: "2026-08-01T00:00:00-06:00",
    to: "2026-09-01T00:00:00-06:00",
  };

  const mockCalendarEvents: CalendarEventDto[] = [
    {
      entity_id: "e1",
      project_id: "00000000-0000-0000-0000-000000000001",
      project_name: "Acme Commercial",
      task_id: null,
      title: "Shoot Day 1",
      event_type: "milestone",
      starts_at: "2026-08-15T00:00:00-06:00",
      ends_at: null,
      is_all_day: true,
      color_override: "chart-1",
    },
  ];

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("covers the transition journey: overview URL -> Calendar tab click -> URL has tab=calendar", () => {
    render(
      <ProjectWorkspaceShell
        project={mockProject}
        clients={[]}
        cycles={[]}
        eligiblePms={[]}
        eligibleOperators={[]}
        eligibleClients={[]}
        effectiveCapacity="admin"
        actorRole="admin"
        initialTab="overview"
      />,
    );

    const calendarTabTrigger = screen.getByRole("tab", { name: "Calendario" });
    expect(calendarTabTrigger).toBeInTheDocument();

    fireEvent.click(calendarTabTrigger);

    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining("tab=calendar"),
    );
  });

  it("renders server-fed calendar props when tab=calendar and props are present", () => {
    render(
      <ProjectWorkspaceShell
        project={mockProject}
        clients={[]}
        cycles={[]}
        eligiblePms={[]}
        eligibleOperators={[]}
        eligibleClients={[]}
        effectiveCapacity="admin"
        actorRole="admin"
        initialTab="calendar"
        initialCalendarEvents={mockCalendarEvents}
        calendarRange={mockRange}
      />,
    );

    expect(screen.getByText("Shoot Day 1")).toBeInTheDocument();
    // Global project selector should be hidden in workspace context
    expect(
      screen.queryByLabelText("Filtrar por proyecto"),
    ).not.toBeInTheDocument();
  });

  it("renders Calendar tab for PM Watcher without New Milestone management trigger", () => {
    render(
      <ProjectWorkspaceShell
        project={mockProject}
        clients={[]}
        cycles={[]}
        eligiblePms={[]}
        eligibleOperators={[]}
        eligibleClients={[]}
        effectiveCapacity="pm_watcher"
        actorRole="pm"
        initialTab="calendar"
        initialCalendarEvents={mockCalendarEvents}
        calendarRange={mockRange}
      />,
    );

    expect(screen.getByRole("tab", { name: "Calendario" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Nuevo Hito" }),
    ).not.toBeInTheDocument();
  });
});
