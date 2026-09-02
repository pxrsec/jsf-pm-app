// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { RecycleBinView } from "@/components/shared/operational-lifecycle/recycle-bin-view";
import { restoreArchivedOperationalEntityAction } from "@/lib/operational-lifecycle/actions";

const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: mockRefresh,
  }),
}));

vi.mock("@/i18n/routing", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: mockRefresh,
  }),
  usePathname: () => "/pm/papelera",
  Link: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/operational-lifecycle/actions", () => ({
  restoreArchivedOperationalEntityAction: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => {
    return (key: string) => {
      return `${namespace}.${key}`;
    };
  },
  useFormatter: () => ({
    dateTime: (date: Date) => date.toISOString(),
  }),
}));

const VALID_UUID_1 = "11111111-1111-4111-8111-111111111111";
const VALID_UUID_2 = "22222222-2222-4222-8222-222222222222";

describe("RecycleBinView Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders empty state when data is empty", () => {
    render(
      <RecycleBinView
        initialResult={{
          status: "available",
          data: [],
        }}
      />,
    );

    expect(
      screen.getByText("operationalLifecycle.recycleBin.empty"),
    ).toBeDefined();
  });

  it("renders unavailable state with retry when status is unavailable", () => {
    render(
      <RecycleBinView
        initialResult={{
          status: "unavailable",
        }}
      />,
    );

    expect(
      screen.getByText("operationalLifecycle.recycleBin.unavailable"),
    ).toBeDefined();

    const retryBtn = screen.getByText(
      "operationalLifecycle.recycleBin.retryAction",
    );
    fireEvent.click(retryBtn);
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("renders rows and handles restore click", async () => {
    vi.mocked(restoreArchivedOperationalEntityAction).mockResolvedValue({
      ok: true,
      data: { code: "restored" },
    });

    render(
      <RecycleBinView
        initialResult={{
          status: "available",
          data: [
            {
              entityType: "project",
              entityId: VALID_UUID_1,
              projectId: null,
              title: "Project Alpha",
              archivedAt: "2026-09-01T10:00:00.000Z",
              archivedBy: null,
              archiveReason: "Completed",
              parentIsArchived: false,
            },
          ],
        }}
      />,
    );

    expect(screen.getAllByText("Project Alpha").length).toBeGreaterThan(0);

    const restoreButtons = screen.getAllByRole("button", {
      name: /operationalLifecycle\.recycleBin\.restoreAriaLabel/i,
    });
    expect(restoreButtons.length).toBeGreaterThan(0);

    fireEvent.click(restoreButtons[0]);

    await waitFor(() => {
      expect(restoreArchivedOperationalEntityAction).toHaveBeenCalledWith({
        entityType: "project",
        entityId: VALID_UUID_1,
      });
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("disables restore button when parentIsArchived is true", () => {
    render(
      <RecycleBinView
        initialResult={{
          status: "available",
          data: [
            {
              entityType: "task",
              entityId: VALID_UUID_2,
              projectId: null,
              title: "Task with Archived Parent",
              archivedAt: "2026-09-01T10:00:00.000Z",
              archivedBy: null,
              archiveReason: null,
              parentIsArchived: true,
            },
          ],
        }}
      />,
    );

    const restoreButtons = screen.getAllByRole("button", {
      name: /operationalLifecycle\.recycleBin\.restoreAriaLabel/i,
    });
    for (const btn of restoreButtons) {
      expect(
        btn.hasAttribute("data-disabled") ||
          btn.hasAttribute("disabled") ||
          (btn as HTMLButtonElement).disabled,
      ).toBe(true);
    }
  });

  it("renders custom row actions via slot", () => {
    render(
      <RecycleBinView
        initialResult={{
          status: "available",
          data: [
            {
              entityType: "project",
              entityId: VALID_UUID_1,
              projectId: null,
              title: "Project Alpha",
              archivedAt: "2026-09-01T10:00:00.000Z",
              archivedBy: null,
              archiveReason: null,
              parentIsArchived: false,
            },
          ],
        }}
        renderRowAction={(item) => (
          <button data-testid={`custom-action-${item.entityId}`}>Delete</button>
        )}
      />,
    );

    expect(
      screen.getAllByTestId(`custom-action-${VALID_UUID_1}`).length,
    ).toBeGreaterThan(0);
  });
});
