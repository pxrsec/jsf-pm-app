// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import "@testing-library/jest-dom/vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { ManualAlertEvaluationDialog } from "./manual-alert-evaluation-dialog";
import type { ManualAlertEvaluationControl } from "@/lib/notifications/alert-evaluator-schemas";
import esCatalog from "../../../../../../../messages/es-MX.json";

const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => {
    return (key: string, params?: Record<string, string | number>) => {
      const fullPath = namespace ? `${namespace}.${key}` : key;
      const val = fullPath
        .split(".")
        .reduce<unknown>(
          (acc, part) => (acc as Record<string, unknown>)?.[part],
          esCatalog,
        );
      if (typeof val === "string") {
        if (params) {
          let formatted = val;
          for (const [k, v] of Object.entries(params)) {
            formatted = formatted.replace(`{${k}}`, String(v));
          }
          return formatted;
        }
        return val;
      }
      return fullPath;
    };
  },
}));

const mockEvaluateNotificationAlertsAction = vi.fn();
vi.mock("@/lib/notifications/alert-evaluator-actions", () => ({
  evaluateNotificationAlertsAction: (input: unknown) =>
    mockEvaluateNotificationAlertsAction(input),
}));

describe("ManualAlertEvaluationDialog Component", () => {
  const adminControl: ManualAlertEvaluationControl = {
    kind: "admin-global",
  };

  const pmControl: ManualAlertEvaluationControl = {
    kind: "pm-project",
    projects: [
      { id: "proj-1-uuid", name: "Alpha Feature Film" },
      { id: "proj-2-uuid", name: "Beta Commercial Spot" },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Trigger & Rendering", () => {
    it("1. Renders trigger button with localized copy and accessible aria-label", () => {
      render(<ManualAlertEvaluationDialog control={adminControl} />);

      const trigger = screen.getByRole("button", {
        name: "Abrir diálogo para evaluar alertas de notificación",
      });
      expect(trigger).toBeInTheDocument();
      expect(trigger).toHaveTextContent("Evaluar alertas ahora");
      expect(trigger).toHaveAttribute(
        "aria-label",
        "Abrir diálogo para evaluar alertas de notificación",
      );
    });

    it("2. Returns null when PM project list is empty", () => {
      const { container } = render(
        <ManualAlertEvaluationDialog
          control={{ kind: "pm-project", projects: [] }}
        />,
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe("Admin Global Evaluation Flow", () => {
    it("1. Opens dialog, shows truthful no-send explanation, and submits empty object on confirm", async () => {
      mockEvaluateNotificationAlertsAction.mockResolvedValueOnce({
        ok: true,
        data: {
          tasksEvaluated: 6,
          reviewsEvaluated: 3,
          eventsCreated: 2,
          inAppRecipientsCreated: 2,
          externalSuppressionsCreated: 1,
        },
      });

      render(<ManualAlertEvaluationDialog control={adminControl} />);

      const trigger = screen.getByRole("button", {
        name: "Abrir diálogo para evaluar alertas de notificación",
      });
      fireEvent.click(trigger);

      expect(
        screen.getByText("Evaluar alertas de notificación"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /Esta acción evalúa los recordatorios actuales.*No envía correos electrónicos ni mensajes de WhatsApp\./,
        ),
      ).toBeInTheDocument();

      const confirmBtn = screen.getByRole("button", { name: "Evaluar ahora" });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(mockEvaluateNotificationAlertsAction).toHaveBeenCalledWith({});
      });

      await waitFor(() => {
        expect(screen.getByText("Evaluación completada")).toBeInTheDocument();
        expect(screen.getByText("Tareas evaluadas: 6")).toBeInTheDocument();
        expect(screen.getByText("Revisiones evaluadas: 3")).toBeInTheDocument();
        expect(screen.getByText("Eventos creados: 2")).toBeInTheDocument();
        expect(
          screen.getByText("Destinatarios en la app: 2"),
        ).toBeInTheDocument();
        expect(screen.getByText("Supresiones externas: 1")).toBeInTheDocument();
        expect(mockRefresh).toHaveBeenCalledTimes(1);
      });
    });

    it("2. Renders zeroResult message when all counts are zero", async () => {
      mockEvaluateNotificationAlertsAction.mockResolvedValueOnce({
        ok: true,
        data: {
          tasksEvaluated: 0,
          reviewsEvaluated: 0,
          eventsCreated: 0,
          inAppRecipientsCreated: 0,
          externalSuppressionsCreated: 0,
        },
      });

      render(<ManualAlertEvaluationDialog control={adminControl} />);

      fireEvent.click(
        screen.getByRole("button", {
          name: "Abrir diálogo para evaluar alertas de notificación",
        }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Evaluar ahora" }));

      await waitFor(() => {
        expect(
          screen.getByText(
            "No se crearon nuevos registros de recordatorio en esta evaluación.",
          ),
        ).toBeInTheDocument();
      });
    });
  });

  describe("PM Project Selection Flow", () => {
    it("1. Renders project selector with project names and submits selected project UUID", async () => {
      mockEvaluateNotificationAlertsAction.mockResolvedValueOnce({
        ok: true,
        data: {
          tasksEvaluated: 2,
          reviewsEvaluated: 1,
          eventsCreated: 0,
          inAppRecipientsCreated: 0,
          externalSuppressionsCreated: 0,
        },
      });

      render(<ManualAlertEvaluationDialog control={pmControl} />);

      fireEvent.click(
        screen.getByRole("button", {
          name: "Abrir diálogo para evaluar alertas de notificación",
        }),
      );

      const label = screen.getByText("Proyecto a evaluar");
      expect(label).toBeInTheDocument();

      const select = screen.getByRole("combobox", {
        name: "Seleccionar proyecto para evaluar alertas",
      });
      expect(select).toBeInTheDocument();
      expect(screen.getByText("Alpha Feature Film")).toBeInTheDocument();
      expect(screen.getByText("Beta Commercial Spot")).toBeInTheDocument();

      // Ensure UUID is not exposed as visible text
      expect(screen.queryByText("proj-1-uuid")).not.toBeInTheDocument();
      expect(screen.queryByText("proj-2-uuid")).not.toBeInTheDocument();

      // Change project selection
      fireEvent.change(select, { target: { value: "proj-2-uuid" } });

      fireEvent.click(screen.getByRole("button", { name: "Evaluar ahora" }));

      await waitFor(() => {
        expect(mockEvaluateNotificationAlertsAction).toHaveBeenCalledWith({
          projectId: "proj-2-uuid",
        });
      });
    });
  });

  describe("Error Mapping & Controlled Safety", () => {
    it("1. Maps UNAUTHORIZED error to localized message in role=alert", async () => {
      mockEvaluateNotificationAlertsAction.mockResolvedValueOnce({
        ok: false,
        error: { code: "UNAUTHORIZED" },
      });

      render(<ManualAlertEvaluationDialog control={adminControl} />);

      fireEvent.click(
        screen.getByRole("button", {
          name: "Abrir diálogo para evaluar alertas de notificación",
        }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Evaluar ahora" }));

      await waitFor(() => {
        const alert = screen.getByRole("alert");
        expect(alert).toHaveTextContent(
          "No tienes autorización para ejecutar esta evaluación de alertas.",
        );
      });
    });

    it("2. Maps UNAVAILABLE error to localized message in role=alert", async () => {
      mockEvaluateNotificationAlertsAction.mockResolvedValueOnce({
        ok: false,
        error: { code: "UNAVAILABLE" },
      });

      render(<ManualAlertEvaluationDialog control={adminControl} />);

      fireEvent.click(
        screen.getByRole("button", {
          name: "Abrir diálogo para evaluar alertas de notificación",
        }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Evaluar ahora" }));

      await waitFor(() => {
        const alert = screen.getByRole("alert");
        expect(alert).toHaveTextContent(
          "El servicio de evaluación no está disponible en este momento.",
        );
      });
    });

    it("3. Maps VALIDATION_FAILED error to localized message in role=alert", async () => {
      mockEvaluateNotificationAlertsAction.mockResolvedValueOnce({
        ok: false,
        error: { code: "VALIDATION_FAILED" },
      });

      render(<ManualAlertEvaluationDialog control={adminControl} />);

      fireEvent.click(
        screen.getByRole("button", {
          name: "Abrir diálogo para evaluar alertas de notificación",
        }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Evaluar ahora" }));

      await waitFor(() => {
        const alert = screen.getByRole("alert");
        expect(alert).toHaveTextContent(
          "La solicitud de evaluación no es válida.",
        );
      });
    });
  });
});
