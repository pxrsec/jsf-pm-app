// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ProjectCalendarTab } from "../project-calendar-tab";
import type { CalendarRangeState } from "@/lib/calendar/types";

const mockPush = vi.fn();
let currentSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => currentSearchParams,
}));

vi.mock("@/i18n/routing", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => "/pm/proyectos/p1",
}));

// Mock CalendarCoordinator to expose onRangeChange trigger directly
vi.mock(
  "@/app/[locale]/(protected)/calendario/_components/calendar-coordinator",
  () => ({
    CalendarCoordinator: ({
      onRangeChange,
    }: {
      onRangeChange?: (range: CalendarRangeState) => void;
    }) => (
      <div data-testid="mock-coordinator">
        <button
          data-testid="trigger-range-change"
          onClick={() =>
            onRangeChange?.({
              view: "month",
              from: "2026-10-01T00:00:00.000Z",
              to: "2026-10-31T23:59:59.999Z",
            })
          }
        >
          Change Range
        </button>
      </div>
    ),
  }),
);

describe("ProjectCalendarTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentSearchParams = new URLSearchParams();
  });

  afterEach(() => {
    cleanup();
  });

  it("writes only tab=calendar and calendar* keys, purging global keys in a single navigation transition", () => {
    // Seed initial search params with tab=calendar, unrelated param, and stale global calendar keys
    currentSearchParams = new URLSearchParams(
      "tab=calendar&view=week&from=2026-08-01&to=2026-08-07&projectId=p-old&otherKey=preserved",
    );

    render(
      <ProjectCalendarTab
        initialEvents={[]}
        milestoneTargets={[]}
        projectId="p1"
        canManageMilestones={true}
        userRole="pm"
        initialRange={{
          view: "month",
          from: "2026-09-01T00:00:00.000Z",
          to: "2026-09-30T23:59:59.999Z",
        }}
      />,
    );

    const triggerBtn = screen.getByTestId("trigger-range-change");
    fireEvent.click(triggerBtn);

    expect(mockPush).toHaveBeenCalledTimes(1);
    const pushedUrl = mockPush.mock.calls[0][0];
    const [path, queryString] = pushedUrl.split("?");
    expect(path).toBe("/pm/proyectos/p1");

    const resultParams = new URLSearchParams(queryString);
    // Project calendar keys owned
    expect(resultParams.get("tab")).toBe("calendar");
    expect(resultParams.get("calendarView")).toBe("month");
    expect(resultParams.get("calendarFrom")).toBe("2026-10-01T00:00:00.000Z");
    expect(resultParams.get("calendarTo")).toBe("2026-10-31T23:59:59.999Z");

    // Unrelated param preserved
    expect(resultParams.get("otherKey")).toBe("preserved");

    // Stale global calendar keys purged
    expect(resultParams.has("view")).toBe(false);
    expect(resultParams.has("from")).toBe(false);
    expect(resultParams.has("to")).toBe(false);
    expect(resultParams.has("projectId")).toBe(false);
  });
});
