// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { DeliverableDetailSheet } from "../deliverable-detail-sheet";
import type { DeliverableDetailView } from "@/lib/deliverables/queries";

vi.mock("@/config/app.config", () => ({
  appConfig: {
    appUrl: "http://localhost:3000",
    supabase: {
      url: "http://localhost:54321",
      publishableKey: "test-publishable-key",
    },
  },
}));

vi.mock("@/lib/deliverables/comment-actions", () => ({
  createDeliverableCommentAction: vi.fn(),
  listDeliverableCommentsAction: vi.fn().mockResolvedValue([]),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    if (key === "actions.submitVersion") return "Submit version";
    if (key.includes("reviewCta")) return "Review version";
    if (key.includes("deliverCta")) return "Deliver to client";
    return key;
  },
  useFormatter: () => ({
    dateTime: () => "Sep 10, 2026",
  }),
}));

describe("DeliverableDetailSheet - pm_watcher restrictions", () => {
  afterEach(() => {
    cleanup();
  });

  const baseDeliverable: DeliverableDetailView = {
    id: "deliv-1",
    project_id: "proj-1",
    task_id: "task-1",
    assignee_id: "user-assigned",
    title: "Key Visuals",
    specifications: "Deliverable specs",
    workflow_type: "production",
    status: "pending",
    current_version_number: 0,
    is_stalled: false,
    submission_deadline_at: "2026-09-15T00:00:00Z",
    internal_review_deadline_at: null,
    client_delivery_deadline_at: null,
    approved_at: null,
    delivered_at: null,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    assignee: {
      id: "user-assigned",
      full_name: "Assigned User",
      role: "pm",
      avatar_url: null,
    },
    versions: [],
    feedback: [],
  };

  it("pm_watcher CANNOT receive submit controls even when assigned to the deliverable", () => {
    render(
      <DeliverableDetailSheet
        deliverable={baseDeliverable}
        isOpen={true}
        onClose={vi.fn()}
        effectiveCapacity="pm_watcher"
        currentUserId="user-assigned"
        onSubmitClick={vi.fn()}
        onReportLink={vi.fn()}
      />,
    );

    expect(screen.queryByText("Submit version")).not.toBeInTheDocument();
  });

  it("pm_watcher CANNOT receive review or deliver controls", () => {
    const reviewDeliverable: DeliverableDetailView = {
      ...baseDeliverable,
      status: "awaiting_internal_review",
    };

    render(
      <DeliverableDetailSheet
        deliverable={reviewDeliverable}
        isOpen={true}
        onClose={vi.fn()}
        effectiveCapacity="pm_watcher"
        currentUserId="user-assigned"
        onSubmitClick={vi.fn()}
        onReportLink={vi.fn()}
      />,
    );

    expect(screen.queryByText("Review version")).not.toBeInTheDocument();
    expect(screen.queryByText("Deliver to client")).not.toBeInTheDocument();
  });

  it("pm_lead or admin CAN receive submit controls when assigned and pending", () => {
    render(
      <DeliverableDetailSheet
        deliverable={baseDeliverable}
        isOpen={true}
        onClose={vi.fn()}
        effectiveCapacity="pm_lead"
        currentUserId="user-assigned"
        onSubmitClick={vi.fn()}
        onReportLink={vi.fn()}
      />,
    );

    expect(screen.getByText("Submit version")).toBeInTheDocument();
  });
});
