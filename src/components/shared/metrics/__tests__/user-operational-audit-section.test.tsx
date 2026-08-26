// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserOperationalAuditSection } from "../user-operational-audit-section";
import type { UserOperationsMetricDto } from "@/lib/user-operations-metrics/types";

const mockPush = vi.fn();
const mockPathname = "/admin/metricas";
let mockSearchParams = new URLSearchParams();

vi.mock("@/i18n/routing", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}));

vi.mock("next-intl", () => ({
  useLocale: () => "es-MX",
  useTranslations: () => (key: string, params?: Record<string, string>) => {
    if (params?.name) return `${key}: ${params.name}`;
    if (params?.column) return `Sort by ${params.column}`;
    return key;
  },
}));

describe("UserOperationalAuditSection Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams({
      from: "2026-05-26T00:00:00-06:00",
      to: "2026-08-24T00:00:00-06:00",
    });
  });

  afterEach(() => {
    cleanup();
  });

  const mockUser1: UserOperationsMetricDto = {
    userId: "00000000-0000-0000-0000-000000000001",
    fullName: "Elena Rostova",
    applicationRole: "operator",
    isActive: true,
    currentActiveTaskCount: 2,
    taskAssignedCount: 4,
    taskStartedCount: 3,
    taskCompletedCount: 2,
    averageAssignmentToStartHours: 14.2,
    unstartedTaskCountAtRangeEnd: 1,
    productionDeliverableSubmissionCount: 2,
    clientSubmissionCount: 1,
    deliverableReviewCount: 0,
    deliverableDeliveredCount: 1,
    inAppNotificationReceivedCount: 6,
    inAppNotificationReadCount: 5,
    inAppNotificationUnreadCountAtRangeEnd: 1,
    inAppNotificationUnreadOver24hCountAtRangeEnd: 0,
    averageInAppNotificationReadHours: 1.5,
    lastWorkflowActionAt: "2026-08-20T12:00:00-06:00",
    rangeFrom: "2026-05-26T00:00:00-06:00",
    rangeTo: "2026-08-24T00:00:00-06:00",
  };

  const mockUser2: UserOperationsMetricDto = {
    userId: "00000000-0000-0000-0000-000000000002",
    fullName: "Carlos Mendoza",
    applicationRole: "pm",
    isActive: false,
    currentActiveTaskCount: 0,
    taskAssignedCount: 0,
    taskStartedCount: 0,
    taskCompletedCount: 0,
    averageAssignmentToStartHours: null,
    unstartedTaskCountAtRangeEnd: 0,
    productionDeliverableSubmissionCount: 0,
    clientSubmissionCount: 0,
    deliverableReviewCount: 4,
    deliverableDeliveredCount: 2,
    inAppNotificationReceivedCount: 2,
    inAppNotificationReadCount: 1,
    inAppNotificationUnreadCountAtRangeEnd: 1,
    inAppNotificationUnreadOver24hCountAtRangeEnd: 1,
    averageInAppNotificationReadHours: 36.0,
    lastWorkflowActionAt: "2026-08-15T09:00:00-06:00",
    rangeFrom: "2026-05-26T00:00:00-06:00",
    rangeTo: "2026-08-24T00:00:00-06:00",
  };

  it("1. Renders unavailable error state when result status is unavailable", () => {
    render(
      <UserOperationalAuditSection
        role="admin"
        result={{ status: "unavailable", code: "UNAVAILABLE" }}
      />,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("unavailable")).toBeInTheDocument();
  });

  it("2. Renders empty scope state when available with zero rows", () => {
    render(
      <UserOperationalAuditSection
        role="admin"
        result={{ status: "available", data: [] }}
      />,
    );

    expect(screen.getByText("noOperationalRecords")).toBeInTheDocument();
  });

  it("3. Renders sortable table and mobile cards with data rows", () => {
    render(
      <UserOperationalAuditSection
        role="admin"
        result={{ status: "available", data: [mockUser1, mockUser2] }}
      />,
    );

    expect(screen.getAllByText("Elena Rostova").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Carlos Mendoza").length).toBeGreaterThan(0);

    const viewButtons = screen.getAllByRole("button", {
      name: /viewDetailsAria/i,
    });
    expect(viewButtons.length).toBeGreaterThan(0);
  });

  it("4. Table column headers expose aria-sort on active column only", async () => {
    render(
      <UserOperationalAuditSection
        role="admin"
        result={{ status: "available", data: [mockUser1, mockUser2] }}
      />,
    );

    const sortButtons = screen.getAllByRole("button", {
      name: /Sort by/i,
    });
    expect(sortButtons.length).toBeGreaterThan(0);

    const firstSortBtn = sortButtons[0];
    await userEvent.click(firstSortBtn);

    const userTh = firstSortBtn.closest("th");
    expect(userTh).toHaveAttribute("aria-sort", "ascending");
  });

  it("5. Clicking View Details button pushes userId to router", async () => {
    render(
      <UserOperationalAuditSection
        role="admin"
        result={{ status: "available", data: [mockUser1, mockUser2] }}
      />,
    );

    const firstViewBtn = screen.getAllByRole("button", {
      name: /viewDetailsAria/i,
    })[0];
    await userEvent.click(firstViewBtn);

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush.mock.calls[0][0]).toContain("userId=");
  });

  it("6. Renders labelled inline detail panel when selectedUserId matches a user", () => {
    render(
      <UserOperationalAuditSection
        role="admin"
        result={{ status: "available", data: [mockUser1, mockUser2] }}
        currentUserId={mockUser1.userId}
      />,
    );

    const detailRegion = screen.getByRole("region", {
      name: "Elena Rostova",
    });
    expect(detailRegion).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "closeDetailsAria" }),
    ).toBeInTheDocument();
  });

  it("7. Gracefully renders all rows when currentUserId is not in returned rows", () => {
    render(
      <UserOperationalAuditSection
        role="admin"
        result={{ status: "available", data: [mockUser1, mockUser2] }}
        currentUserId="non-existent-user-id"
      />,
    );

    expect(
      screen.queryByRole("region", { name: "Elena Rostova" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("Elena Rostova").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Carlos Mendoza").length).toBeGreaterThan(0);
  });
});
