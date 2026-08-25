// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { render, screen, cleanup } from "@testing-library/react";
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
  usePathname: () => "/cliente",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: vi.fn(async (namespace?: string) => {
    return (key: string, params?: Record<string, unknown>) => {
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
            str = str.replace(`{${k}}`, String(v));
          }
          return str;
        }
        return val;
      }
      return fullPath;
    };
  }),
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => {
    return (key: string, params?: Record<string, unknown>) => {
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
            str = str.replace(`{${k}}`, String(v));
          }
          return str;
        }
        return val;
      }
      return fullPath;
    };
  },
}));

vi.mock("@/lib/client/actions", () => ({
  startClientRequestAction: vi.fn().mockResolvedValue({ ok: true, data: {} }),
  completeClientRequestAction: vi
    .fn()
    .mockResolvedValue({ ok: true, data: {} }),
  approveClientDeliverableAction: vi
    .fn()
    .mockResolvedValue({ ok: true, data: {} }),
  requestClientDeliverableChangesAction: vi
    .fn()
    .mockResolvedValue({ ok: true, data: {} }),
  submitClientSubmissionAction: vi
    .fn()
    .mockResolvedValue({ ok: true, data: {} }),
}));

import {
  parseClientFeedbackHistory,
  computeClientRequestReadiness,
  sortClientRequests,
  type ClientRequestQueueItem,
  type ClientSubmissionRequirementSummary,
  type ClientProjectDetail,
  type ClientProductionReviewDetail,
  type ClientProductionReviewQueueItem,
  type ClientRequestDetail,
} from "@/lib/client/types";
import { ClientProjectList } from "@/app/[locale]/(protected)/cliente/proyectos/_components/client-project-list";
import { ClientProjectDetailView } from "@/app/[locale]/(protected)/cliente/proyectos/_components/client-project-detail";
import { ClientSubmissionCard } from "@/app/[locale]/(protected)/cliente/proyectos/_components/client-submission-card";
import { ClientReviewSummaryCard } from "@/app/[locale]/(protected)/cliente/proyectos/_components/client-review-summary-card";
import { ClientReviewDetailView } from "@/app/[locale]/(protected)/cliente/entregables/_components/client-review-detail";
import { ClientRequestDetailView } from "@/app/[locale]/(protected)/cliente/tareas/_components/client-request-detail";

afterEach(() => {
  cleanup();
});

describe("Client Portal Domain Helpers & Parsers", () => {
  describe("parseClientFeedbackHistory", () => {
    it("returns ok: true with empty array for null, undefined, or empty array", () => {
      expect(parseClientFeedbackHistory(null)).toEqual({
        ok: true,
        items: [],
      });
      expect(parseClientFeedbackHistory(undefined)).toEqual({
        ok: true,
        items: [],
      });
      expect(parseClientFeedbackHistory([])).toEqual({
        ok: true,
        items: [],
      });
    });

    it("parses valid feedback array into narrow UI models without version_id or raw IDs", () => {
      const rawFeedback = [
        {
          id: "fb-1",
          version_id: "ver-1",
          decision: "changes_requested",
          comments: "Fix audio glitch",
          reviewed_at: "2026-08-20T10:00:00Z",
        },
        {
          id: "fb-2",
          version_id: "ver-2",
          decision: "approved",
          comments: null,
          reviewed_at: "2026-08-21T10:00:00Z",
        },
      ];

      const result = parseClientFeedbackHistory(rawFeedback);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.items).toHaveLength(2);
        expect(result.items[0]).toEqual({
          decision: "changes_requested",
          comments: "Fix audio glitch",
          reviewedAt: "2026-08-20T10:00:00Z",
        });
        expect(
          (result.items[0] as unknown as Record<string, unknown>).id,
        ).toBeUndefined();
        expect(
          (result.items[0] as unknown as Record<string, unknown>).version_id,
        ).toBeUndefined();
        expect(result.items[1]).toEqual({
          decision: "approved",
          comments: null,
          reviewedAt: "2026-08-21T10:00:00Z",
        });
      }
    });

    it("returns ok: false for malformed feedback JSON", () => {
      expect(parseClientFeedbackHistory("not-an-array")).toEqual({
        ok: false,
        reason: "malformed_json",
      });
      expect(
        parseClientFeedbackHistory([
          { decision: "invalid_decision", reviewed_at: "2026-08-20T10:00:00Z" },
        ]),
      ).toEqual({
        ok: false,
        reason: "malformed_json",
      });
      expect(
        parseClientFeedbackHistory([{ decision: "approved" }]), // missing reviewed_at
      ).toEqual({
        ok: false,
        reason: "malformed_json",
      });
    });
  });

  describe("computeClientRequestReadiness", () => {
    const baseSub: ClientSubmissionRequirementSummary = {
      id: "sub-1",
      task_id: "t-1",
      task_title: "Task 1",
      project_id: "p-1",
      project_name: "Project 1",
      title: "Raw footage",
      specifications: "4K format",
      submission_deadline_at: "2026-08-30T00:00:00Z",
      status: "pending",
      current_version_number: null,
      current_submission_provider: null,
      current_submission_url: null,
      current_submission_note: null,
      current_submitted_at: null,
      correctionHistory: [],
    };

    it("returns no_requirements when list is empty", () => {
      expect(computeClientRequestReadiness([])).toEqual({
        status: "no_requirements",
        pendingCount: 0,
        totalCount: 0,
      });
    });

    it("returns pending_submissions when active children are not submitted", () => {
      const subs = [{ ...baseSub, status: "pending" as const }];
      expect(computeClientRequestReadiness(subs)).toEqual({
        status: "pending_submissions",
        pendingCount: 1,
        totalCount: 1,
      });
    });

    it("returns all_submitted when every child is submitted", () => {
      const subs = [{ ...baseSub, status: "submitted" as const }];
      expect(computeClientRequestReadiness(subs)).toEqual({
        status: "all_submitted",
        pendingCount: 0,
        totalCount: 1,
      });
    });
  });

  describe("sortClientRequests", () => {
    it("sorts overdue requests first, then blocking priority, then deadline", () => {
      const now = new Date();
      const past = new Date(now.getTime() - 1000000).toISOString();
      const futureNear = new Date(now.getTime() + 1000000).toISOString();
      const futureFar = new Date(now.getTime() + 5000000).toISOString();

      const items: ClientRequestQueueItem[] = [
        {
          id: "req-low",
          project_id: "p-1",
          project_name: "P1",
          title: "Low future",
          description: null,
          status: "pending",
          priority: "low",
          deadline_at: futureNear,
          child_submission_count: 0,
          started_at: null,
          completed_at: null,
        },
        {
          id: "req-overdue",
          project_id: "p-1",
          project_name: "P1",
          title: "Overdue",
          description: null,
          status: "pending",
          priority: "low",
          deadline_at: past,
          child_submission_count: 0,
          started_at: null,
          completed_at: null,
        },
        {
          id: "req-blocking",
          project_id: "p-1",
          project_name: "P1",
          title: "Blocking future",
          description: null,
          status: "in_progress",
          priority: "blocking",
          deadline_at: futureFar,
          child_submission_count: 0,
          started_at: null,
          completed_at: null,
        },
        {
          id: "req-completed",
          project_id: "p-1",
          project_name: "P1",
          title: "Completed",
          description: null,
          status: "completed",
          priority: "high",
          deadline_at: null,
          child_submission_count: 0,
          started_at: null,
          completed_at: past,
        },
      ];

      const sorted = sortClientRequests(items);
      expect(sorted[0].id).toBe("req-overdue");
      expect(sorted[1].id).toBe("req-blocking");
      expect(sorted[2].id).toBe("req-low");
      expect(sorted[3].id).toBe("req-completed");
    });
  });
});

describe("Client Presentation & Review UI", () => {
  afterEach(() => {
    cleanup();
  });
  it("renders ClientProjectList with empty state when no projects are returned", async () => {
    render(await ClientProjectList({ projects: [] }));
    expect(screen.getByText("Sin proyectos activos")).toBeInTheDocument();
  });

  it("renders ClientProjectDetailView with 4 separated sections and no raw IDs", async () => {
    const detail: ClientProjectDetail = {
      project: {
        id: "p-1",
        name: "Spring Video Launch",
        status: "in_progress",
        client_scope: "Public social media video production",
        deadline_at: "2026-09-15T00:00:00Z",
        last_deliverable_activity_at: null,
      },
      directRequests: [
        {
          id: "t-1",
          project_id: "p-1",
          project_name: "Spring Video Launch",
          title: "Upload Brand Assets",
          description: "Provide logos and colors",
          status: "pending",
          priority: "high",
          deadline_at: "2026-09-01T00:00:00Z",
          child_submission_count: 1,
          started_at: null,
          completed_at: null,
        },
      ],
      directSubmissions: [
        {
          id: "s-1",
          task_id: "t-1",
          task_title: "Upload Brand Assets",
          project_id: "p-1",
          project_name: "Spring Video Launch",
          title: "Vector Logo",
          specifications: "SVG format",
          submission_deadline_at: "2026-09-01T00:00:00Z",
          status: "pending",
          current_version_number: null,
          current_submission_provider: null,
          current_submission_url: null,
          current_submission_note: null,
          current_submitted_at: null,
          correctionHistory: [],
        },
      ],
      releasedProductionReviews: [
        {
          id: "d-1",
          project_id: "p-1",
          project_name: "Spring Video Launch",
          title: "Teaser Cut 1",
          specifications: "15-second cut",
          status: "awaiting_client_review",
          current_version_number: 1,
          current_submission_url: "https://drive.google.com/file/d/abc",
          current_submission_provider: "google_drive",
          client_delivery_deadline_at: "2026-09-10T00:00:00Z",
          approved_at: null,
          delivered_at: null,
        },
      ],
    };

    const html = renderToStaticMarkup(
      await ClientProjectDetailView({ detail }),
    );

    expect(html).toContain("Spring Video Launch");
    expect(html).toContain("Tus Solicitudes");
    expect(html).toContain("Tus Entregas Solicitadas");
    expect(html).toContain("Revisiones de Producción");
    expect(html).toContain("Upload Brand Assets");
    expect(html).toContain("Vector Logo");
    expect(html).toContain("Teaser Cut 1");
  });

  it("renders ClientSubmissionCard as read-only with no dead submission links", async () => {
    const sub: ClientSubmissionRequirementSummary = {
      id: "s-1",
      task_id: "t-1",
      task_title: "Brand task",
      project_id: "p-1",
      project_name: "Project 1",
      title: "Audio Track",
      specifications: "WAV format",
      submission_deadline_at: "2026-09-05T00:00:00Z",
      status: "pending",
      current_version_number: null,
      current_submission_provider: null,
      current_submission_url: null,
      current_submission_note: null,
      current_submitted_at: null,
      correctionHistory: [],
    };

    render(await ClientSubmissionCard({ submission: sub }));
    expect(screen.getByText("Audio Track")).toBeInTheDocument();
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
    expect(screen.getByText("Solo lectura")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders ClientReviewDetailView with deliberate Google Drive link and action controls when eligible", async () => {
    const deliverable: ClientProductionReviewDetail = {
      id: "d-1",
      project_id: "p-1",
      project_name: "Commercial Spot",
      title: "Final Edit",
      specifications: "1080p color-graded video",
      status: "awaiting_client_review",
      current_version_number: 2,
      current_submission_url: "https://drive.google.com/file/d/xyz",
      current_submission_provider: "google_drive",
      current_submission_note: "Adjusted lighting",
      current_submitted_at: "2026-08-22T08:00:00Z",
      client_delivery_deadline_at: "2026-08-25T00:00:00Z",
      approved_at: null,
      delivered_at: null,
      feedbackResult: {
        ok: true,
        items: [
          {
            decision: "changes_requested",
            comments: "Colors were too dark",
            reviewedAt: "2026-08-21T14:00:00Z",
          },
        ],
      },
    };

    render(await ClientReviewDetailView({ deliverable }));

    expect(
      screen.getByRole("heading", { name: "Final Edit" }),
    ).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();

    const driveLink = screen.getByRole("link", {
      name: "Abrir material de Final Edit en Google Drive (abre en una nueva pestaña)",
    });
    expect(driveLink).toHaveAttribute(
      "href",
      "https://drive.google.com/file/d/xyz",
    );
    expect(driveLink).toHaveAttribute("target", "_blank");
    expect(driveLink).toHaveAttribute("rel", "noopener noreferrer");

    expect(
      screen.getByRole("button", { name: "Aprobar este entregable" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Solicitar cambios en este entregable",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Colors were too dark")).toBeInTheDocument();
  });

  it("suppresses review actions and renders safe recovery when version is null/invalid", async () => {
    const deliverable: ClientProductionReviewDetail = {
      id: "d-2",
      project_id: "p-1",
      project_name: "Commercial Spot",
      title: "Corrupted Version Video",
      specifications: "HD video",
      status: "awaiting_client_review",
      current_version_number: null, // invalid / null
      current_submission_url: "https://drive.google.com/file/d/xyz",
      current_submission_provider: "google_drive",
      current_submission_note: null,
      current_submitted_at: null,
      client_delivery_deadline_at: null,
      approved_at: null,
      delivered_at: null,
      feedbackResult: { ok: true, items: [] },
    };

    render(await ClientReviewDetailView({ deliverable }));

    expect(screen.getByText("Versión no disponible")).toBeInTheDocument();
    expect(screen.getByText("Revisión no disponible")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Aprobar este entregable" }),
    ).not.toBeInTheDocument();
  });

  it("suppresses review actions and renders safe recovery when feedback history is malformed", async () => {
    const deliverable: ClientProductionReviewDetail = {
      id: "d-3",
      project_id: "p-1",
      project_name: "Commercial Spot",
      title: "Broken Feedback Video",
      specifications: "HD video",
      status: "awaiting_client_review",
      current_version_number: 1,
      current_submission_url: "https://drive.google.com/file/d/xyz",
      current_submission_provider: "google_drive",
      current_submission_note: null,
      current_submitted_at: null,
      client_delivery_deadline_at: null,
      approved_at: null,
      delivered_at: null,
      feedbackResult: { ok: false, reason: "malformed_json" },
    };

    render(await ClientReviewDetailView({ deliverable }));

    expect(screen.getByText("Revisión no disponible")).toBeInTheDocument();
    expect(
      screen.getByText(
        "No fue posible cargar el historial de revisiones debido a una inconsistencia de datos.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Aprobar este entregable" }),
    ).not.toBeInTheDocument();
  });

  describe("ClientSubmissionCard Presentation Modes (S05-05)", () => {
    it("renders read-only summary card without action slot or external link in summary mode", () => {
      const submission: ClientSubmissionRequirementSummary = {
        id: "s-1",
        task_id: "t-1",
        task_title: "Task 1",
        project_id: "p-1",
        project_name: "Project 1",
        title: "Brand Logo Assets",
        specifications: "Vector SVG and PNG 300dpi",
        submission_deadline_at: "2026-09-01T00:00:00Z",
        status: "pending",
        current_version_number: null,
        current_submission_provider: null,
        current_submission_url: null,
        current_submission_note: null,
        current_submitted_at: null,
        correctionHistory: [],
      };

      render(
        <ClientSubmissionCard
          submission={submission}
          mode="summary"
          actionSlot={<button data-testid="dummy-action">Submit</button>}
        />,
      );

      expect(screen.getByText("Brand Logo Assets")).toBeInTheDocument();
      expect(screen.getByText("Solo lectura")).toBeInTheDocument();
      expect(screen.getByText("Pendiente")).toBeInTheDocument();
      // Action slot must NOT be rendered in summary mode
      expect(screen.queryByTestId("dummy-action")).not.toBeInTheDocument();
    });

    it("renders interactive action slot and detailed correction banners in detailed mode", () => {
      const submission: ClientSubmissionRequirementSummary = {
        id: "s-2",
        task_id: "t-1",
        task_title: "Task 1",
        project_id: "p-1",
        project_name: "Project 1",
        title: "Raw Footage Archive",
        specifications: "ProRes 422 files",
        submission_deadline_at: null,
        status: "pending",
        current_version_number: 1, // Has previous version -> correction loop
        current_submission_provider: "google_drive",
        current_submission_url: "https://drive.google.com/file/d/old",
        current_submission_note: "Initial version",
        current_submitted_at: "2026-08-20T10:00:00Z",
        correctionHistory: [
          {
            kind: "version",
            versionNumber: 1,
            submissionUrl: "https://drive.google.com/file/d/old",
            provider: "google_drive",
            note: "Initial version",
            submittedAt: "2026-08-20T10:00:00Z",
          },
          {
            kind: "reopened",
            reopenedAt: "2026-08-21T11:00:00Z",
            reason:
              "Audio channel 2 was corrupted, please upload clean version",
          },
        ],
      };

      render(
        <ClientSubmissionCard
          submission={submission}
          mode="detailed"
          actionSlot={
            <button data-testid="submit-action">
              Enviar enlace de reemplazo
            </button>
          }
        />,
      );

      expect(screen.getByText("Raw Footage Archive")).toBeInTheDocument();
      expect(screen.getByText("Reemplazo solicitado")).toBeInTheDocument();
      expect(
        screen.getAllByText(
          "Audio channel 2 was corrupted, please upload clean version",
        ).length,
      ).toBeGreaterThanOrEqual(1);
      expect(screen.getByTestId("submit-action")).toBeInTheDocument();
    });

    it("renders terminal submitted state with external link, rel attributes, and immutable history", () => {
      const submission: ClientSubmissionRequirementSummary = {
        id: "s-3",
        task_id: "t-1",
        task_title: "Task 1",
        project_id: "p-1",
        project_name: "Project 1",
        title: "Voiceover Audio Track",
        specifications: "WAV 24bit 48kHz",
        submission_deadline_at: null,
        status: "submitted",
        current_version_number: 1,
        current_submission_provider: "wetransfer",
        current_submission_url: "https://we.tl/t-voiceover123",
        current_submission_note: "Recorded in studio A",
        current_submitted_at: "2026-08-22T08:00:00Z",
        correctionHistory: [
          {
            kind: "version",
            versionNumber: 1,
            submissionUrl: "https://we.tl/t-voiceover123",
            provider: "wetransfer",
            note: "Recorded in studio A",
            submittedAt: "2026-08-22T08:00:00Z",
          },
        ],
      };

      render(<ClientSubmissionCard submission={submission} mode="detailed" />);

      expect(screen.getByText("Voiceover Audio Track")).toBeInTheDocument();
      expect(screen.getByText("Enviado")).toBeInTheDocument();

      const externalLink = screen.getByRole("link", {
        name: "Abrir enlace externo para Voiceover Audio Track (abre en nueva pestaña)",
      });
      expect(externalLink).toHaveAttribute(
        "href",
        "https://we.tl/t-voiceover123",
      );
      expect(externalLink).toHaveAttribute("target", "_blank");
      expect(externalLink).toHaveAttribute("rel", "noopener noreferrer");

      expect(
        screen.getAllByText("Recorded in studio A").length,
      ).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("WeTransfer")).toBeInTheDocument();
    });

    it("renders safe recovery alert when correctionHistoryError is true", () => {
      const submission: ClientSubmissionRequirementSummary = {
        id: "s-4",
        task_id: "t-1",
        task_title: "Task 1",
        project_id: "p-1",
        project_name: "Project 1",
        title: "Corrupted History Submission",
        specifications: null,
        submission_deadline_at: null,
        status: "pending",
        current_version_number: 1,
        current_submission_provider: null,
        current_submission_url: null,
        current_submission_note: null,
        current_submitted_at: null,
        correctionHistory: [],
        correctionHistoryError: true,
      };

      render(<ClientSubmissionCard submission={submission} mode="detailed" />);

      expect(
        screen.getByText("El historial no está disponible temporalmente."),
      ).toBeInTheDocument();
    });
  });

  describe("ClientRequestDetailView Integration (S05-05)", () => {
    it("renders ClientSubmissionActions for pending submissions and suppresses them on correctionHistoryError", async () => {
      const request: ClientRequestDetail = {
        id: "t-1",
        project_id: "p-1",
        project_name: "Campaign 2026",
        title: "Provide Assets Request",
        description: "Please provide requested assets",
        status: "pending",
        priority: "high",
        deadline_at: null,
        started_at: null,
        completed_at: null,
        resources: [],
        childSubmissions: [
          {
            id: "sub-valid",
            task_id: "t-1",
            task_title: "Provide Assets Request",
            project_id: "p-1",
            project_name: "Campaign 2026",
            title: "Valid Submission",
            specifications: null,
            submission_deadline_at: null,
            status: "pending",
            current_version_number: null,
            current_submission_provider: null,
            current_submission_url: null,
            current_submission_note: null,
            current_submitted_at: null,
            correctionHistory: [],
            correctionHistoryError: false,
          },
          {
            id: "sub-corrupt",
            task_id: "t-1",
            task_title: "Provide Assets Request",
            project_id: "p-1",
            project_name: "Campaign 2026",
            title: "Corrupt Submission",
            specifications: null,
            submission_deadline_at: null,
            status: "pending",
            current_version_number: 1,
            current_submission_provider: null,
            current_submission_url: null,
            current_submission_note: null,
            current_submitted_at: null,
            correctionHistory: [],
            correctionHistoryError: true,
          },
        ],
        readinessSummary: {
          status: "pending_submissions",
          pendingCount: 2,
          totalCount: 2,
        },
      };

      render(await ClientRequestDetailView({ request }));

      expect(screen.getByText("Valid Submission")).toBeInTheDocument();
      expect(screen.getByText("Corrupt Submission")).toBeInTheDocument();
      // Only 1 submit action should be rendered (for sub-valid)
      const submitButtons = screen.getAllByRole("button", {
        name: /^Enviar enlace$/,
      });
      expect(submitButtons).toHaveLength(1);
    });
  });

  describe("Localization Semantic Parity (S05-05)", () => {
    it("ensures exact key structure parity for projects.clientSubmissions between es-MX and en-US", () => {
      const getKeys = (obj: unknown, prefix = ""): string[] => {
        if (!obj || typeof obj !== "object") return [prefix];
        return Object.entries(obj as Record<string, unknown>).flatMap(
          ([k, v]) => getKeys(v, prefix ? `${prefix}.${k}` : k),
        );
      };

      const esKeys = getKeys(esCatalog.projects.clientSubmissions).sort();
      const enKeys = getKeys(enCatalog.projects.clientSubmissions).sort();

      expect(esKeys).toEqual(enKeys);
    });
  });

  describe("English Presentation Rendering & Negative Fallback Assertions", () => {
    it("renders ClientReviewSummaryCard in English without Spanish fallbacks", () => {
      const reviewItem: ClientProductionReviewQueueItem = {
        id: "rev-null-1",
        project_id: "proj-1",
        project_name: null,
        title: null,
        specifications: "Specs",
        status: "awaiting_client_review",
        current_version_number: 1,
        current_submission_url: "https://drive.google.com/test",
        current_submission_provider: "google_drive",
        client_delivery_deadline_at: null,
        approved_at: null,
        delivered_at: null,
      };

      const reviewTranslations = {
        versionLabel: enCatalog.projects.clientReviews.versionLabel,
        deadline: enCatalog.projects.clientReviews.deadline,
        noDeadline: enCatalog.projects.clientReviews.noDeadline,
        openReview: enCatalog.projects.clientReviews.openReview,
        untitledDeliverable:
          enCatalog.projects.clientReviews.untitledDeliverable,
        statusLabel:
          enCatalog.projects.clientReviews.status.awaitingClientReview,
      };

      const { container } = render(
        <ClientReviewSummaryCard
          review={reviewItem}
          translations={reviewTranslations}
        />,
      );

      expect(container.textContent).toContain("Untitled deliverable");
      expect(container.textContent).toContain("Awaiting Your Review");
      expect(container.textContent).not.toContain("Sin título");
      expect(container.textContent).not.toContain("Sin nombre");
      expect(container.textContent).not.toContain("Proyecto");
    });
  });
});
