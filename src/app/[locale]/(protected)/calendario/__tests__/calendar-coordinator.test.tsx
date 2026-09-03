// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { CalendarCoordinator } from "../_components/calendar-coordinator";
import { getDefaultMonthRange, getWeekRange } from "@/lib/calendar/date-utils";
import type { CalendarRangeState } from "@/lib/calendar/types";

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("@/lib/calendar/actions", () => ({
  createMilestoneAction: vi.fn(),
  updateMilestoneAction: vi.fn(),
  getMilestoneDetailAction: vi.fn(),
}));

vi.mock("@/lib/operational-lifecycle/actions", () => ({
  archiveOperationalEntityAction: vi.fn(),
  restoreArchivedOperationalEntityAction: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/i18n/routing", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  usePathname: () => "/calendario",
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

vi.mock("next-intl", () => ({
  useLocale: () => "es-MX",
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      "views.month": "Mes",
      "views.week": "Semana",
      "views.agenda": "Agenda",
      "views.list": "Lista",
      "nav.today": "Hoy",
      "aria.viewToggle": "Selector de vista",
      "aria.prevPeriod": "Periodo anterior",
      "aria.nextPeriod": "Periodo siguiente",
      "aria.todayButton": "Ir a hoy",
      "aria.grid": "Cuadrícula del mes",
      "aria.list": "Lista de eventos",
      "states.empty": "No hay eventos",
      "states.emptyFiltered": "No hay eventos filtrados",
    };
    return map[key] ?? key;
  },
}));

describe("CalendarCoordinator view switching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const baseRange: CalendarRangeState = {
    view: "month",
    from: "2026-08-01T00:00:00-06:00",
    to: "2026-09-01T00:00:00-06:00",
  };

  it("switches to week view using current week range without time drift", () => {
    const onRangeChange = vi.fn();
    const today = new Date();
    const expectedWeek = getWeekRange(today);

    render(
      <CalendarCoordinator
        initialEvents={[]}
        initialRange={baseRange}
        milestoneTargets={[]}
        canManageMilestones={false}
        userRole="operator"
        onRangeChange={onRangeChange}
      />,
    );

    const weekBtn = screen.getByRole("button", { name: "Semana" });
    fireEvent.click(weekBtn);

    expect(onRangeChange).toHaveBeenCalledTimes(1);
    expect(onRangeChange).toHaveBeenCalledWith({
      view: "week",
      from: expectedWeek.from,
      to: expectedWeek.to,
      projectId: undefined,
    });
  });

  it("switches from week to month/agenda/list view using current month range", () => {
    const onRangeChange = vi.fn();
    const today = new Date();
    const expectedMonth = getDefaultMonthRange(today);

    const weekInitialRange: CalendarRangeState = {
      view: "week",
      from: "2026-07-26T00:00:00-06:00",
      to: "2026-08-02T00:00:00-06:00",
    };

    render(
      <CalendarCoordinator
        initialEvents={[]}
        initialRange={weekInitialRange}
        milestoneTargets={[]}
        canManageMilestones={false}
        userRole="operator"
        onRangeChange={onRangeChange}
      />,
    );

    // Switch to Agenda
    const agendaBtn = screen.getByRole("button", { name: "Agenda" });
    fireEvent.click(agendaBtn);

    expect(onRangeChange).toHaveBeenLastCalledWith({
      view: "agenda",
      from: expectedMonth.from,
      to: expectedMonth.to,
      projectId: undefined,
    });

    // Switch to List
    const listBtn = screen.getByRole("button", { name: "Lista" });
    fireEvent.click(listBtn);

    expect(onRangeChange).toHaveBeenLastCalledWith({
      view: "list",
      from: expectedMonth.from,
      to: expectedMonth.to,
      projectId: undefined,
    });

    // Switch to Month
    const monthBtn = screen.getByRole("button", { name: "Mes" });
    fireEvent.click(monthBtn);

    expect(onRangeChange).toHaveBeenLastCalledWith({
      view: "month",
      from: expectedMonth.from,
      to: expectedMonth.to,
      projectId: undefined,
    });
  });

  it("updates URL query parameters when onRangeChange is not provided", () => {
    const today = new Date();
    const expectedWeek = getWeekRange(today);

    render(
      <CalendarCoordinator
        initialEvents={[]}
        initialRange={baseRange}
        milestoneTargets={[]}
        canManageMilestones={false}
        userRole="operator"
      />,
    );

    const weekBtn = screen.getByRole("button", { name: "Semana" });
    fireEvent.click(weekBtn);

    expect(mockPush).toHaveBeenCalledTimes(1);
    const pushedUrl = mockPush.mock.calls[0][0] as string;
    expect(pushedUrl).toContain("view=week");
    expect(pushedUrl).toContain(
      `from=${encodeURIComponent(expectedWeek.from)}`,
    );
    expect(pushedUrl).toContain(`to=${encodeURIComponent(expectedWeek.to)}`);
  });
});
