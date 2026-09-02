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
import { AdminPermanentDeleteDialog } from "@/components/shared/operational-lifecycle/admin-permanent-delete-dialog";
import {
  getOperationalDeletionPreviewAction,
  permanentlyDeleteOperationalEntityAction,
} from "@/lib/operational-lifecycle/actions";

const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: mockRefresh,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/operational-lifecycle/actions", () => ({
  getOperationalDeletionPreviewAction: vi.fn(),
  permanentlyDeleteOperationalEntityAction: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => {
    return (key: string) => {
      return `${namespace}.${key}`;
    };
  },
}));

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

describe("AdminPermanentDeleteDialog Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("does not render when target is null or isOpen is false", () => {
    const { container } = render(
      <AdminPermanentDeleteDialog
        target={null}
        isOpen={false}
        onClose={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("loads preview and disables confirm when canDelete is false", async () => {
    vi.mocked(getOperationalDeletionPreviewAction).mockResolvedValue({
      ok: true,
      data: {
        entityType: "project",
        entityId: VALID_UUID,
        title: "Project with Tasks",
        canDelete: false,
        blockerCode: "dependencies_present",
      },
    });

    render(
      <AdminPermanentDeleteDialog
        target={{
          entityType: "project",
          entityId: VALID_UUID,
          projectId: null,
          title: "Project with Tasks",
          archivedAt: "2026-09-01T10:00:00.000Z",
          archivedBy: null,
          archiveReason: null,
          parentIsArchived: false,
        }}
        isOpen={true}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          "operationalLifecycle.permanentDeleteDialog.blockerDependenciesPresent",
        ),
      ).toBeDefined();
    });

    const confirmBtn = screen
      .getByText("operationalLifecycle.permanentDeleteDialog.confirmAction")
      .closest("button");
    expect(confirmBtn?.disabled).toBe(true);
  });

  it("enables confirm and deletes on click when canDelete is true", async () => {
    vi.mocked(getOperationalDeletionPreviewAction).mockResolvedValue({
      ok: true,
      data: {
        entityType: "deliverable",
        entityId: VALID_UUID,
        title: "Clean Deliverable",
        canDelete: true,
        blockerCode: null,
      },
    });

    vi.mocked(permanentlyDeleteOperationalEntityAction).mockResolvedValue({
      ok: true,
      data: { code: "permanently_deleted" },
    });

    const mockClose = vi.fn();
    const mockSuccess = vi.fn();

    render(
      <AdminPermanentDeleteDialog
        target={{
          entityType: "deliverable",
          entityId: VALID_UUID,
          projectId: null,
          title: "Clean Deliverable",
          archivedAt: "2026-09-01T10:00:00.000Z",
          archivedBy: null,
          archiveReason: null,
          parentIsArchived: false,
        }}
        isOpen={true}
        onClose={mockClose}
        onSuccess={mockSuccess}
      />,
    );

    await waitFor(() => {
      const confirmBtn = screen
        .getByText("operationalLifecycle.permanentDeleteDialog.confirmAction")
        .closest("button");
      expect(confirmBtn?.disabled).toBe(false);
    });

    const confirmBtn = screen
      .getByText("operationalLifecycle.permanentDeleteDialog.confirmAction")
      .closest("button");
    fireEvent.click(confirmBtn!);

    await waitFor(() => {
      expect(permanentlyDeleteOperationalEntityAction).toHaveBeenCalledWith({
        entityType: "deliverable",
        entityId: VALID_UUID,
      });
      expect(mockClose).toHaveBeenCalled();
      expect(mockSuccess).toHaveBeenCalled();
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("displays error alert if deletion action fails", async () => {
    vi.mocked(getOperationalDeletionPreviewAction).mockResolvedValue({
      ok: true,
      data: {
        entityType: "deliverable",
        entityId: VALID_UUID,
        title: "Clean Deliverable",
        canDelete: true,
        blockerCode: null,
      },
    });

    vi.mocked(permanentlyDeleteOperationalEntityAction).mockResolvedValue({
      ok: false,
      error: { code: "dependencies_present" },
    });

    render(
      <AdminPermanentDeleteDialog
        target={{
          entityType: "deliverable",
          entityId: VALID_UUID,
          projectId: null,
          title: "Clean Deliverable",
          archivedAt: "2026-09-01T10:00:00.000Z",
          archivedBy: null,
          archiveReason: null,
          parentIsArchived: false,
        }}
        isOpen={true}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      const confirmBtn = screen
        .getByText("operationalLifecycle.permanentDeleteDialog.confirmAction")
        .closest("button");
      expect(confirmBtn?.disabled).toBe(false);
    });

    const confirmBtn = screen
      .getByText("operationalLifecycle.permanentDeleteDialog.confirmAction")
      .closest("button");
    fireEvent.click(confirmBtn!);

    await waitFor(() => {
      expect(
        screen.getByText("operationalLifecycle.errors.dependenciesPresent"),
      ).toBeDefined();
    });
  });
});
