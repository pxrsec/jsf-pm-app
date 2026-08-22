// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import esCatalog from "../../messages/es-MX.json";

vi.mock("server-only", () => ({}));

const mockRefresh = vi.fn();
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
    refresh: () => mockRefresh(),
  }),
  usePathname: () => "/operador/tareas/00000000-0000-0000-0000-000000000001",
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

const mockSubmitAction = vi.fn();
vi.mock("@/lib/operator/actions", () => ({
  submitOperatorDeliverableVersionAction: (input: unknown) =>
    mockSubmitAction(input),
}));

import { OperatorTaskResources } from "@/app/[locale]/(protected)/operador/tareas/[task-id]/_components/operator-task-resources";
import { OperatorDeliverableCard } from "@/app/[locale]/(protected)/operador/tareas/[task-id]/_components/operator-deliverable-card";
import { OperatorTaskDetailView } from "@/app/[locale]/(protected)/operador/tareas/[task-id]/_components/operator-task-detail";
import type {
  OperatorTaskDetail,
  OperatorTaskDeliverableDetail,
} from "@/lib/operator/types";

describe("Operator Task Detail Components (__tests__/operator/operator-task-detail.test.tsx)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const mockDeliverablePending: OperatorTaskDeliverableDetail = {
    deliverableId: "00000000-0000-0000-0000-0000000000d1",
    deliverableTitle: "Main Video Edit",
    deliverableStatus: "pending",
    deliverableWorkflowType: "production",
    currentVersionNumber: null,
    deliverableSpecifications: "Full HD 1080p 60fps export with color grading.",
    submissionDeadlineAt: "2026-08-25T18:00:00Z",
    internalReviewDeadlineAt: "2026-08-26T18:00:00Z",
    clientDeliveryDeadlineAt: "2026-08-27T18:00:00Z",
  };

  const mockDeliverableChangesRequested: OperatorTaskDeliverableDetail = {
    deliverableId: "00000000-0000-0000-0000-0000000000d2",
    deliverableTitle: "Teaser Cut",
    deliverableStatus: "changes_requested",
    deliverableWorkflowType: "production",
    currentVersionNumber: 1,
    deliverableSpecifications: "15s vertical cut.",
    submissionDeadlineAt: "2026-08-24T12:00:00Z",
    internalReviewDeadlineAt: "2026-08-24T18:00:00Z",
    clientDeliveryDeadlineAt: "2026-08-25T12:00:00Z",
  };

  const mockDeliverableAwaitingReview: OperatorTaskDeliverableDetail = {
    deliverableId: "00000000-0000-0000-0000-0000000000d3",
    deliverableTitle: "Audio Mix",
    deliverableStatus: "awaiting_internal_review",
    deliverableWorkflowType: "production",
    currentVersionNumber: 1,
    deliverableSpecifications: "Stereo broadcast mix.",
    submissionDeadlineAt: "2026-08-23T12:00:00Z",
    internalReviewDeadlineAt: "2026-08-24T12:00:00Z",
    clientDeliveryDeadlineAt: "2026-08-25T12:00:00Z",
  };

  const mockTask: OperatorTaskDetail = {
    taskId: "00000000-0000-0000-0000-000000000001",
    taskTitle: "Color Grading and Sound Sync",
    taskDescription: "Match master color and sync multitrack audio.",
    taskStatus: "in_progress",
    taskPriority: "high",
    taskStartedAt: "2026-08-20T10:00:00Z",
    taskDeadlineAt: "2026-08-25T18:00:00Z",
    assignedAt: "2026-08-19T09:00:00Z",
    urgencyCategory: "urgent",
    projectId: "10000000-0000-0000-0000-000000000001",
    projectName: "Commercial Campaign 2026",
    resources: [
      {
        id: "r-1",
        name: "LUT Pack",
        url: "https://drive.google.com/drive/folders/luts",
        sortOrder: 1,
      },
      {
        id: "r-2",
        name: "Audio Stems",
        url: "https://drive.google.com/drive/folders/audio",
        sortOrder: 2,
      },
    ],
    deliverables: [mockDeliverablePending, mockDeliverableChangesRequested],
  };

  describe("OperatorTaskResources", () => {
    it("renders intentional outbound links with target=_blank, noopener noreferrer, and accessible aria-label", () => {
      render(
        <OperatorTaskResources
          resources={mockTask.resources}
          translations={{
            resourcesTitle: "Recursos de la tarea",
            noResources: "No hay recursos",
            externalResourceAria: (name) => `Abrir recurso externo: ${name}`,
          }}
        />,
      );

      const links = screen.getAllByRole("link");
      expect(links).toHaveLength(2);
      expect(links[0]).toHaveAttribute(
        "href",
        "https://drive.google.com/drive/folders/luts",
      );
      expect(links[0]).toHaveAttribute("target", "_blank");
      expect(links[0]).toHaveAttribute("rel", "noopener noreferrer");
      expect(links[0]).toHaveAttribute(
        "aria-label",
        "Abrir recurso externo: LUT Pack",
      );
    });

    it("renders empty state message when no resources are attached", () => {
      render(
        <OperatorTaskResources
          resources={[]}
          translations={{
            resourcesTitle: "Recursos de la tarea",
            noResources: "No hay recursos adjuntos a esta tarea.",
            externalResourceAria: (name) => name,
          }}
        />,
      );

      expect(
        screen.getByText("No hay recursos adjuntos a esta tarea."),
      ).toBeInTheDocument();
    });
  });

  describe("OperatorDeliverableCard & Submission Flow", () => {
    const cardTranslations = {
      statusLabel: "Pendiente",
      specificationsTitle: "Especificaciones",
      noSpecifications: "Sin especificaciones",
      submissionDeadline: (d: string) => `Límite: ${d}`,
      internalReviewDeadline: (d: string) => `Revisión interna: ${d}`,
      clientDeliveryDeadline: (d: string) => `Entrega al cliente: ${d}`,
      awaitingInternalReviewNotice: "En revisión interna por el equipo de PM",
      awaitingClientReviewNotice: "Enviado a revisión del cliente",
      approvedNotice: "Entregable aprobado",
      deliveredNotice: "Entregable finalizado y entregado",
      changesRequestedNotice:
        "Se solicitaron revisiones para este entregable. Al enviar una nueva versión, se registrará de forma inmutable y regresará a revisión interna.",
      submission: {
        dialogTitle: "Entregar versión de producción",
        dialogTitleRevision: "Entregar versión corregida",
        dialogDescription: "Proporciona el enlace de Google Drive",
        truthfulnessNotice:
          "La aplicación registra el enlace sin descargar ni inspeccionar.",
        revisionNotice: (v: string) =>
          `Esta entrega registrará la versión v${v} para revisión interna.`,
        urlLabel: "Enlace de Google Drive",
        urlPlaceholder: "https://drive.google.com/...",
        urlHelp: "Debe ser un enlace HTTPS válido.",
        urlError: "El enlace debe ser una URL HTTPS válida de Google Drive.",
        noteLabel: "Notas de entrega",
        notePlaceholder: "Detalles...",
        noteHelp: "Máximo 1,000 caracteres.",
        charCount: (c: string) => `${c}/1000`,
        cancelAction: "Cancelar",
        submitAction: "Registrar entrega",
        submitting: "Registrando entrega...",
        successToast: (v: string) =>
          `Versión v${v} registrada exitosamente para revisión interna.`,
        submitCta: "Entregar versión de producción",
        resubmitCta: "Entregar versión corregida",
        errors: {
          validationFailed: "Verifica que el enlace sea válido.",
          unauthorized: "No autorizado.",
          notFound: "No encontrado.",
          invalidTransition: "Transición inválida.",
          conflict: "Conflicto.",
          invariantViolation: "Invariante violada.",
          generic: "Error genérico.",
        },
      },
    };

    it("renders submit CTA button for pending production deliverable", () => {
      render(
        <OperatorDeliverableCard
          deliverable={mockDeliverablePending}
          locale="es-MX"
          translations={cardTranslations}
        />,
      );

      expect(screen.getByText("Main Video Edit")).toBeInTheDocument();
      expect(
        screen.getByText("Full HD 1080p 60fps export with color grading."),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("open-submission-dialog-btn"),
      ).toHaveTextContent("Entregar versión de producción");
    });

    it("renders revision notice and revised submit CTA for changes_requested deliverable", () => {
      render(
        <OperatorDeliverableCard
          deliverable={mockDeliverableChangesRequested}
          locale="es-MX"
          translations={cardTranslations}
        />,
      );

      expect(screen.getByText("Teaser Cut")).toBeInTheDocument();
      expect(
        screen.getByText(/Se solicitaron revisiones para este entregable/),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("open-submission-dialog-btn"),
      ).toHaveTextContent("Entregar versión corregida");
    });

    it("renders read-only waiting notice without submission CTA for awaiting_internal_review", () => {
      render(
        <OperatorDeliverableCard
          deliverable={mockDeliverableAwaitingReview}
          locale="es-MX"
          translations={cardTranslations}
        />,
      );

      expect(screen.getByText("Audio Mix")).toBeInTheDocument();
      expect(
        screen.getByText("En revisión interna por el equipo de PM"),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("open-submission-dialog-btn"),
      ).not.toBeInTheDocument();
    });

    it("performs lexical validation and submits valid Google Drive URL via action", async () => {
      mockSubmitAction.mockResolvedValue({
        ok: true,
        data: {
          deliverable_id: mockDeliverablePending.deliverableId,
          version_id: "v-1",
          version_number: 1,
        },
      });

      render(
        <OperatorDeliverableCard
          deliverable={mockDeliverablePending}
          locale="es-MX"
          translations={cardTranslations}
        />,
      );

      // Open dialog
      fireEvent.click(screen.getByTestId("open-submission-dialog-btn"));
      expect(
        screen.getByTestId("operator-submission-dialog"),
      ).toBeInTheDocument();

      const urlInput = screen.getByTestId("submission-url-input");
      const submitBtn = screen.getByTestId("submit-version-btn");

      // Enter invalid URL
      fireEvent.change(urlInput, {
        target: { value: "https://dropbox.com/file/123" },
      });
      fireEvent.blur(urlInput);
      expect(screen.getByTestId("submission-url-error")).toBeInTheDocument();
      expect(submitBtn).toBeDisabled();

      // Enter valid Google Drive URL
      fireEvent.change(urlInput, {
        target: { value: "https://drive.google.com/file/d/abc123xyz/view" },
      });
      expect(
        screen.queryByTestId("submission-url-error"),
      ).not.toBeInTheDocument();
      expect(submitBtn).toBeEnabled();

      // Submit form
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockSubmitAction).toHaveBeenCalledWith({
          deliverable_id: mockDeliverablePending.deliverableId,
          submission_url: "https://drive.google.com/file/d/abc123xyz/view",
          submission_note: null,
        });
        expect(mockRefresh).toHaveBeenCalled();
      });
    });

    it("displays server error alert on submission rejection", async () => {
      mockSubmitAction.mockResolvedValue({
        ok: false,
        error: { code: "INVALID_TRANSITION", message: "Not pending" },
      });

      render(
        <OperatorDeliverableCard
          deliverable={mockDeliverablePending}
          locale="es-MX"
          translations={cardTranslations}
        />,
      );

      fireEvent.click(screen.getByTestId("open-submission-dialog-btn"));
      const urlInput = screen.getByTestId("submission-url-input");
      fireEvent.change(urlInput, {
        target: { value: "https://drive.google.com/file/d/abc123xyz/view" },
      });
      fireEvent.click(screen.getByTestId("submit-version-btn"));

      await waitFor(() => {
        expect(
          screen.getByTestId("submission-server-error"),
        ).toBeInTheDocument();
        expect(screen.getByText("Transición inválida.")).toBeInTheDocument();
      });
    });
  });

  describe("OperatorTaskDetailView (Server Component Integration)", () => {
    it("renders task title, project link, badges, timeline, resources, and deliverables", async () => {
      const view = await OperatorTaskDetailView({
        task: mockTask,
        locale: "es-MX",
      });
      render(view);

      expect(screen.getByTestId("operator-task-title")).toHaveTextContent(
        "Color Grading and Sound Sync",
      );
      expect(screen.getByText("Commercial Campaign 2026")).toBeInTheDocument();
      expect(
        screen.getByText("Match master color and sync multitrack audio."),
      ).toBeInTheDocument();
      expect(screen.getByTestId("operator-task-resources")).toBeInTheDocument();
      expect(
        screen.getByTestId("operator-deliverables-section"),
      ).toBeInTheDocument();
    });
  });
});
