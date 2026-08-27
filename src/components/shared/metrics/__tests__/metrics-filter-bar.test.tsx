// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MetricsFilterBar } from "../metrics-filter-bar";

const mockPush = vi.fn();
const mockPathname = "/pm/metricas";
let mockSearchParams = new URLSearchParams();

vi.mock("@/i18n/routing", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      rangeLabel: "Range",
      preset30Days: "Last 30 days",
      preset90Days: "Last 90 days",
      projectLabel: "Project",
      projectSelectAria: "Select project",
      selectProjectPlaceholder: "Select project...",
      customRangeLabel: "Custom range",
      startDateAria: "Start date",
      endDateAria: "End date",
      applyCustomDates: "Apply",
      errorIncompleteDates: "Please select both dates",
      errorInvalidRange: "Invalid range",
      updating: "Updating...",
    };
    return map[key] ?? key;
  },
}));

describe("MetricsFilterBar (metrics-filter-bar.tsx)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams({
      from: "2026-05-26T00:00:00-06:00",
      to: "2026-08-24T00:00:00-06:00",
      projectId: "a0000000-0000-0000-0000-000000000001",
      userId: "b0000000-0000-0000-0000-000000000002",
    });
  });

  it("PM project change updates projectId, removes userId, and preserves date range", async () => {
    const projects = [
      { id: "a0000000-0000-0000-0000-000000000001", name: "Project Alpha" },
      { id: "a0000000-0000-0000-0000-000000000002", name: "Project Beta" },
    ];

    render(
      <MetricsFilterBar
        currentFrom="2026-05-26T00:00:00-06:00"
        currentTo="2026-08-24T00:00:00-06:00"
        currentProjectId="a0000000-0000-0000-0000-000000000001"
        projects={projects}
        role="pm"
      />,
    );

    const selectTrigger = screen.getByRole("combobox", {
      name: "Select project",
    });
    expect(selectTrigger).toBeInTheDocument();

    await userEvent.click(selectTrigger);
    const optionBeta = await screen.findByRole("option", {
      name: "Project Beta",
    });
    await userEvent.click(optionBeta);

    expect(mockPush).toHaveBeenCalledTimes(1);
    const pushedUrl = mockPush.mock.calls[0][0];
    expect(pushedUrl).toContain(
      "projectId=a0000000-0000-0000-0000-000000000002",
    );
    expect(pushedUrl).not.toContain("userId=");
    expect(pushedUrl).toContain("from=2026-05-26T00%3A00%3A00-06%3A00");
    expect(pushedUrl).toContain("to=2026-08-24T00%3A00%3A00-06%3A00");
  });
});
