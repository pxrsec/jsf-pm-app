// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import esCatalog from "../../messages/es-MX.json";
import enCatalog from "../../messages/en-US.json";

vi.mock("server-only", () => ({}));

vi.mock("@/i18n/routing", () => ({
  Link: ({
    href,
    children,
    className,
    "aria-label": ariaLabel,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    "aria-label"?: string;
  }) =>
    React.createElement(
      "a",
      {
        href,
        className,
        "aria-label": ariaLabel,
        "data-testid": "locale-link",
      },
      children,
    ),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/operador/agenda",
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async (namespace?: string) => {
    return (key: string, params?: Record<string, string>) => {
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
            str = str.replace(`{${k}}`, v);
          }
          return str;
        }
        return val;
      }
      return fullPath;
    };
  }),
}));

import { OperatorAgendaTaskCard } from "@/app/[locale]/(protected)/operador/agenda/_components/operator-agenda-task-card";
import { OperatorAgendaList } from "@/app/[locale]/(protected)/operador/agenda/_components/operator-agenda-list";
import { OperatorAgendaEmptyState } from "@/app/[locale]/(protected)/operador/agenda/_components/operator-agenda-empty-state";
import { OperatorProjectList } from "@/app/[locale]/(protected)/operador/proyectos/_components/operator-project-list";
import { OperatorProjectTaskList } from "@/app/[locale]/(protected)/operador/proyectos/_components/operator-project-task-list";
import type {
  OperatorAgendaItem,
  OperatorOwnWorkProject,
  OperatorOwnWorkProjectDetail,
} from "@/lib/operator/queries";

function getLeafEntries(
  obj: Record<string, unknown>,
  prefix = "",
): Array<{ path: string; value: string; params: string[] }> {
  const result: Array<{ path: string; value: string; params: string[] }> = [];
  for (const [k, v] of Object.entries(obj)) {
    const currentPath = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "object" && v !== null) {
      result.push(...getLeafEntries(v as Record<string, unknown>, currentPath));
    } else if (typeof v === "string") {
      const matches = v.match(/\{([^}]+)\}/g) || [];
      const params = matches.map((m) => m.slice(1, -1)).sort();
      result.push({ path: currentPath, value: v, params });
    }
  }
  return result;
}

describe("Operator Agenda & Navigation Routes (__tests__/operator/operator-agenda-routes.test.tsx)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Catalog Parity for Operator Subtrees", () => {
    it("verifies identical leaf keys, non-empty values, and matching interpolation parameters in es-MX and en-US", () => {
      const esAgenda = (esCatalog as Record<string, unknown>)
        .projects as Record<string, unknown>;
      const enAgenda = (enCatalog as Record<string, unknown>)
        .projects as Record<string, unknown>;

      const esSubtrees = {
        operatorAgenda: esAgenda.operatorAgenda as Record<string, unknown>,
        operatorProjects: esAgenda.operatorProjects as Record<string, unknown>,
      };
      const enSubtrees = {
        operatorAgenda: enAgenda.operatorAgenda as Record<string, unknown>,
        operatorProjects: enAgenda.operatorProjects as Record<string, unknown>,
      };

      expect(esSubtrees.operatorAgenda).toBeDefined();
      expect(enSubtrees.operatorAgenda).toBeDefined();
      expect(esSubtrees.operatorProjects).toBeDefined();
      expect(enSubtrees.operatorProjects).toBeDefined();

      const esLeaves = getLeafEntries(esSubtrees);
      const enLeaves = getLeafEntries(enSubtrees);

      const esMap = new Map(esLeaves.map((l) => [l.path, l]));
      const enMap = new Map(enLeaves.map((l) => [l.path, l]));

      expect(Array.from(esMap.keys()).sort()).toEqual(
        Array.from(enMap.keys()).sort(),
      );

      for (const [path, esEntry] of esMap) {
        const enEntry = enMap.get(path);
        expect(enEntry).toBeDefined();
        expect(esEntry.value.trim().length).toBeGreaterThan(0);
        expect(enEntry?.value.trim().length).toBeGreaterThan(0);
        expect(esEntry.params).toEqual(enEntry?.params);
      }
    });
  });

  describe("OperatorAgendaTaskCard", () => {
    const baseItem: OperatorAgendaItem = {
      taskId: "00000000-0000-0000-0000-000000000001",
      taskTitle: "Color Grading Scene 3",
      taskDescription: "Adjust LUTs for daylight sequence",
      taskStatus: "in_progress",
      taskPriority: "high",
      taskStartedAt: "2026-08-20T10:00:00Z",
      taskDeadlineAt: "2026-08-22T18:00:00Z",
      assignedAt: "2026-08-21T10:00:00Z",
      urgencyCategory: "urgent",
      projectId: "10000000-0000-0000-0000-000000000001",
      projectName: "Commercial Campaign",
      deliverables: [
        {
          deliverableId: "d-1",
          deliverableTitle: "Scene 3 Final Cut",
          deliverableStatus: "pending",
          deliverableWorkflowType: "production",
          currentVersionNumber: 1,
          internalReviewDeadlineAt: "2026-08-22T14:00:00Z",
          clientDeliveryDeadlineAt: "2026-08-22T18:00:00Z",
        },
      ],
    };

    const mockTranslations = {
      urgencyLabel: "Urgente",
      urgencyAria: "Urgente: entrega en menos de 24 horas",
      statusLabel: "En progreso",
      priorityLabel: "Alta",
      deliverablesCount: "1 entregable",
      assignedAtLabel: "Asignada: 21 ago, 10:00",
      deadlineAtLabel: "Límite: 22 ago, 18:00",
      completedAtLabel: "Completada: 22 ago, 18:00",
      viewProjectAria: "Ver tareas del proyecto Commercial Campaign",
    };

    it("renders task title, project link, non-color urgency cue, task status, and deliverable badge", () => {
      const html = renderToStaticMarkup(
        React.createElement(OperatorAgendaTaskCard, {
          item: baseItem,
          locale: "es-MX",
          translations: mockTranslations,
        }),
      );

      expect(html).toContain("Color Grading Scene 3");
      expect(html).toContain("Commercial Campaign");
      expect(html).toContain(
        'href="/operador/proyectos/10000000-0000-0000-0000-000000000001"',
      );
      expect(html).toContain("Urgente");
      expect(html).toContain(
        'aria-label="Urgente: entrega en menos de 24 horas"',
      );
      expect(html).toContain("En progreso");
      expect(html).toContain("Alta");
      expect(html).toContain("1 entregable");
      expect(html).toContain("Límite: 22 ago, 18:00");
    });

    it("renders all 6 urgency categories with distinctive labels and aria attributes", () => {
      const categories: Array<OperatorAgendaItem["urgencyCategory"]> = [
        "new",
        "normal",
        "upcoming",
        "urgent",
        "overdue",
        "completed",
      ];

      for (const cat of categories) {
        const item: OperatorAgendaItem = {
          ...baseItem,
          urgencyCategory: cat,
        };
        const trans = {
          ...mockTranslations,
          urgencyLabel: cat.toUpperCase(),
          urgencyAria: `Aria for ${cat}`,
        };

        const html = renderToStaticMarkup(
          React.createElement(OperatorAgendaTaskCard, {
            item,
            locale: "es-MX",
            translations: trans,
          }),
        );

        expect(html).toContain(`aria-label="Aria for ${cat}"`);
        expect(html).toContain(cat.toUpperCase());
      }
    });
  });

  describe("OperatorAgendaEmptyState", () => {
    it("renders truthful empty message and action link to own projects", () => {
      render(
        React.createElement(OperatorAgendaEmptyState, {
          translations: {
            title: "No hay tareas pendientes",
            description: "No tienes tareas asignadas actualmente en tu agenda.",
            browseProjectsAction: "Ver proyectos asignados",
          },
        }),
      );

      expect(screen.getByText("No hay tareas pendientes")).toBeInTheDocument();
      expect(
        screen.getByText(
          "No tienes tareas asignadas actualmente en tu agenda.",
        ),
      ).toBeInTheDocument();
      const link = screen.getByRole("link", {
        name: "Ver proyectos asignados",
      });
      expect(link).toHaveAttribute("href", "/operador/proyectos");
    });
  });

  describe("OperatorAgendaList Server Component", () => {
    it("renders active tasks and completed-today section separately", async () => {
      const activeItem: OperatorAgendaItem = {
        taskId: "t-active",
        taskTitle: "Active Editing Task",
        taskDescription: null,
        taskStatus: "in_progress",
        taskPriority: "medium",
        taskStartedAt: null,
        taskDeadlineAt: "2026-08-23T12:00:00Z",
        assignedAt: "2026-08-20T12:00:00Z",
        urgencyCategory: "normal",
        projectId: "p-1",
        projectName: "Project One",
        deliverables: [],
      };

      const completedItem: OperatorAgendaItem = {
        taskId: "t-completed",
        taskTitle: "Done Task",
        taskDescription: null,
        taskStatus: "completed",
        taskPriority: "low",
        taskStartedAt: "2026-08-20T10:00:00Z",
        taskDeadlineAt: "2026-08-21T10:00:00Z",
        assignedAt: "2026-08-19T10:00:00Z",
        urgencyCategory: "completed",
        projectId: "p-1",
        projectName: "Project One",
        deliverables: [],
      };

      const jsx = await OperatorAgendaList({
        items: [activeItem, completedItem],
        locale: "es-MX",
      });

      const html = renderToStaticMarkup(jsx);

      expect(html).toContain("Active Editing Task");
      expect(html).toContain("Done Task");
      expect(html).toContain('data-testid="completed-today-section"');
      expect(html).toContain("Completadas hoy");
    });
  });

  describe("OperatorProjectList Server Component", () => {
    it("renders project cards with own assigned task counts and safe links", async () => {
      const projects: OperatorOwnWorkProject[] = [
        {
          projectId: "10000000-0000-0000-0000-000000000001",
          projectName: "Promo Video 2026",
          ownTaskCount: 3,
          activeTaskCount: 2,
          completedTaskCount: 1,
          nearestDeadline: "2026-08-25T18:00:00Z",
          urgencyCategories: ["urgent", "normal", "completed"],
        },
      ];

      const jsx = await OperatorProjectList({
        projects,
        locale: "es-MX",
      });

      const html = renderToStaticMarkup(jsx);

      expect(html).toContain("Promo Video 2026");
      expect(html).toContain("3 tareas asignadas");
      expect(html).toContain(
        'href="/operador/proyectos/10000000-0000-0000-0000-000000000001"',
      );
      expect(html).not.toContain("Project tasks");
      expect(html).not.toContain("Proyectos generales");
    });
  });

  describe("OperatorProjectTaskList Server Component", () => {
    it("renders scoped tasks for selected project with back link", async () => {
      const projectDetail: OperatorOwnWorkProjectDetail = {
        projectId: "10000000-0000-0000-0000-000000000001",
        projectName: "Promo Video 2026",
        tasks: [
          {
            taskId: "t-1",
            taskTitle: "Audio Mix",
            taskDescription: "Stereo master",
            taskStatus: "in_progress",
            taskPriority: "high",
            taskStartedAt: null,
            taskDeadlineAt: "2026-08-24T18:00:00Z",
            assignedAt: "2026-08-20T10:00:00Z",
            urgencyCategory: "urgent",
            projectId: "10000000-0000-0000-0000-000000000001",
            projectName: "Promo Video 2026",
            deliverables: [],
          },
        ],
      };

      const jsx = await OperatorProjectTaskList({
        projectDetail,
        locale: "es-MX",
      });

      const html = renderToStaticMarkup(jsx);

      expect(html).toContain("Promo Video 2026");
      expect(html).toContain("Audio Mix");
      expect(html).toContain('href="/operador/proyectos"');
      expect(html).toContain("Volver a Mis Proyectos");
    });
  });
});
