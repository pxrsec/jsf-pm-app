// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type {
  CalendarEventDto,
  CalendarRangeState,
} from "@/lib/calendar/types";
import { CalendarMonthView } from "../_components/views/calendar-month-view";
import { CalendarWeekView } from "../_components/views/calendar-week-view";
import { CalendarAgendaView } from "../_components/views/calendar-agenda-view";
import { CalendarListView } from "../_components/views/calendar-list-view";

let currentMockLocale = "es-MX";

vi.mock("next-intl", () => ({
  useLocale: () => currentMockLocale,
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      "table.date": "Fecha",
      "table.time": "Horario",
      "table.event": "Evento",
      "table.project": "Proyecto",
      "table.type": "Tipo de Evento",
      "table.actions": "Acciones",
      "table.allDay": "Todo el día",
      "eventTypes.project_deadline": "Entrega de Proyecto",
      "eventTypes.task_deadline": "Fecha Límite de Tarea",
      "eventTypes.milestone": "Hito Manual",
      "actions.editMilestone": "Editar Hito",
      "actions.deleteMilestone": "Eliminar Hito",
      "states.empty": "No hay eventos",
      "states.emptyFiltered": "No hay eventos filtrados",
      "aria.grid": "Cuadrícula del mes",
      "aria.list": "Lista de eventos",
    };
    return map[key] ?? key;
  },
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({
    href,
    children,
    className,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    [key: string]: unknown;
  }) =>
    React.createElement(
      "a",
      { href, className, ...props, "data-testid": "calendar-link" },
      children,
    ),
}));

describe("Calendar Presentation Views", () => {
  afterEach(() => {
    cleanup();
  });
  const mockRange: CalendarRangeState = {
    view: "month",
    from: "2026-08-01T00:00:00-06:00",
    to: "2026-09-01T00:00:00-06:00",
  };

  const mockEvents: CalendarEventDto[] = [
    {
      entity_id: "e1",
      project_id: "00000000-0000-0000-0000-000000000001",
      project_name: "Documentary Film",
      task_id: null,
      title: "Rough Cut Delivery",
      event_type: "project_deadline",
      starts_at: "2026-08-18T00:00:00-06:00",
      ends_at: null,
      is_all_day: true,
      color_override: null,
    },
    {
      entity_id: "e2",
      project_id: "00000000-0000-0000-0000-000000000002",
      project_name: "Commercial Ad",
      task_id: "00000000-0000-0000-0000-000000000003",
      title: "Color Grading Session",
      event_type: "milestone",
      starts_at: "2026-08-20T14:00:00-06:00",
      ends_at: null,
      is_all_day: false,
      color_override: "chart-1",
    },
  ];

  describe("CalendarListView", () => {
    it("renders semantic table with proper columns (and no Task column)", () => {
      render(
        <CalendarListView
          events={mockEvents}
          currentRange={mockRange}
          canManageMilestones={true}
          userRole="admin"
        />,
      );

      expect(screen.getByText("Fecha")).toBeInTheDocument();
      expect(screen.getByText("Horario")).toBeInTheDocument();
      expect(screen.getByText("Evento")).toBeInTheDocument();
      expect(screen.getByText("Proyecto")).toBeInTheDocument();
      expect(screen.getByText("Tipo de Evento")).toBeInTheDocument();
      expect(screen.getByText("Acciones")).toBeInTheDocument();

      // Verify no task column header
      expect(screen.queryByText("Tarea")).not.toBeInTheDocument();

      // Verify event titles and project names (no UUIDs displayed)
      expect(screen.getByText("Rough Cut Delivery")).toBeInTheDocument();
      expect(screen.getByText("Documentary Film")).toBeInTheDocument();
      expect(
        screen.queryByText("00000000-0000-0000-0000-000000000001"),
      ).not.toBeInTheDocument();
    });

    it("renders Admin project deep links for Admin user", () => {
      render(
        <CalendarListView
          events={mockEvents}
          currentRange={mockRange}
          canManageMilestones={true}
          userRole="admin"
        />,
      );

      const links = screen.getAllByTestId("calendar-link");
      expect(
        links.some((l) =>
          l.getAttribute("href")?.includes("/admin/proyectos/"),
        ),
      ).toBe(true);
    });

    it("renders PM project deep links for PM user", () => {
      render(
        <CalendarListView
          events={mockEvents}
          currentRange={mockRange}
          canManageMilestones={true}
          userRole="pm"
        />,
      );

      const links = screen.getAllByTestId("calendar-link");
      expect(
        links.some((l) => l.getAttribute("href")?.includes("/pm/proyectos/")),
      ).toBe(true);
    });

    it("renders Client project deep links for Client user", () => {
      render(
        <CalendarListView
          events={mockEvents}
          currentRange={mockRange}
          canManageMilestones={false}
          userRole="client"
        />,
      );

      const links = screen.getAllByTestId("calendar-link");
      expect(
        links.some((l) =>
          l.getAttribute("href")?.includes("/cliente/proyectos/"),
        ),
      ).toBe(true);
    });

    it("renders non-interactive text for Operator user (zero deep links)", () => {
      render(
        <CalendarListView
          events={mockEvents}
          currentRange={mockRange}
          canManageMilestones={false}
          userRole="operator"
        />,
      );

      expect(screen.queryByTestId("calendar-link")).not.toBeInTheDocument();
      expect(screen.getByText("Documentary Film")).toBeInTheDocument();
    });
  });

  describe("CalendarMonthView", () => {
    it("renders month grid with events and badges", () => {
      render(
        <CalendarMonthView
          events={mockEvents}
          currentRange={mockRange}
          canManageMilestones={true}
          userRole="admin"
        />,
      );

      expect(screen.getByText("Rough Cut Delivery")).toBeInTheDocument();
      expect(screen.getByText("Color Grading Session")).toBeInTheDocument();
    });
  });

  describe("CalendarWeekView", () => {
    it("renders 7-day week columns", () => {
      const weekRange: CalendarRangeState = {
        view: "week",
        from: "2026-08-16T00:00:00-06:00",
        to: "2026-08-23T00:00:00-06:00",
      };

      render(
        <CalendarWeekView
          events={mockEvents}
          currentRange={weekRange}
          canManageMilestones={true}
          userRole="admin"
        />,
      );

      expect(screen.getByText("Rough Cut Delivery")).toBeInTheDocument();
      expect(screen.getByText("Color Grading Session")).toBeInTheDocument();
    });
  });

  describe("CalendarAgendaView", () => {
    it("renders grouped date cards", () => {
      render(
        <CalendarAgendaView
          events={mockEvents}
          currentRange={mockRange}
          canManageMilestones={true}
          userRole="admin"
        />,
      );

      expect(screen.getByText("Rough Cut Delivery")).toBeInTheDocument();
      expect(screen.getByText("Color Grading Session")).toBeInTheDocument();
    });
  });

  describe("Locale Adaptation (English & Spanish)", () => {
    it("renders localized weekday headers and dates in English when locale is en-US", () => {
      currentMockLocale = "en-US";

      render(
        <CalendarMonthView
          events={mockEvents}
          currentRange={mockRange}
          canManageMilestones={true}
          userRole="admin"
        />,
      );

      // In en-US, short weekdays include SUN, MON, TUE, WED, THU, FRI, SAT
      expect(screen.getByText("SUN")).toBeInTheDocument();
      expect(screen.getByText("MON")).toBeInTheDocument();

      cleanup();

      render(
        <CalendarListView
          events={mockEvents}
          currentRange={mockRange}
          canManageMilestones={true}
          userRole="admin"
        />,
      );

      // In en-US, month short name for August is "Aug"
      expect(screen.getAllByText(/Aug/i).length).toBeGreaterThan(0);

      // Reset mock locale
      currentMockLocale = "es-MX";
    });
  });
});
