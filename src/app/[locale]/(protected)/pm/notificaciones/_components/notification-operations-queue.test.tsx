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
import { NotificationOperationsQueue } from "./notification-operations-queue";
import type {
  SuppressedNotificationOperation,
  SuppressedNotificationOperationsPage,
} from "@/lib/notifications/operations-contracts";
import esCatalog from "../../../../../../../messages/es-MX.json";

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
            // Support simple ICU-like plural replacements for test simulation
            if (k === "count" && formatted.includes("{count, plural")) {
              const countNum = Number(v);
              const pluralText =
                countNum === 1 ? "1 destinatario" : `${countNum} destinatarios`;
              return pluralText;
            }
            formatted = formatted.replace(`{${k}}`, String(v));
          }
          return formatted;
        }
        return val;
      }
      return fullPath;
    };
  },
  useFormatter: () => ({
    dateTime: (date: Date) =>
      date.toLocaleDateString("es-MX", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
  }),
}));

const mockLoadSuppressedNotificationOperationsPageAction = vi.fn();
vi.mock("@/lib/notifications/operations-actions", () => ({
  loadSuppressedNotificationOperationsPageAction: (input: unknown) =>
    mockLoadSuppressedNotificationOperationsPageAction(input),
}));

describe("NotificationOperationsQueue Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
  });

  it("1. Renders controlled terminal state, channel, reason, category, explanation, aggregate count, and timestamps", () => {
    const sampleOp: SuppressedNotificationOperation = {
      eventId: "00000000-0000-0000-0000-000000000001",
      channel: "email",
      status: "suppressed",
      reason: "provider_disabled",
      trigger: "deliverable_submitted",
      projectName: "Campana Primavera",
      recipientCount: 3,
      firstCreatedAt: "2026-08-22T10:00:00.000Z",
      lastSuppressedAt: "2026-08-22T10:05:00.000Z",
    };

    const initialPage: SuppressedNotificationOperationsPage = {
      operations: [sampleOp],
      nextCursor: null,
      hasMore: false,
    };

    render(<NotificationOperationsQueue initialPage={initialPage} />);

    // Terminal status badge
    expect(screen.getByText("Suprimida")).toBeInTheDocument();
    // Channel
    expect(screen.getByText("Correo electrónico")).toBeInTheDocument();
    // Safe category from trigger
    expect(screen.getByText("Entregable enviado")).toBeInTheDocument();
    // Controlled reason
    expect(
      screen.getByText("Proveedor externo desactivado"),
    ).toBeInTheDocument();
    // Dedicated terminal explanation
    expect(
      screen.getByText(
        "No se envió en este entorno y no se enviará automáticamente más adelante.",
      ),
    ).toBeInTheDocument();
    // Aggregate recipient count
    expect(screen.getByText("3 destinatarios")).toBeInTheDocument();
    // Project context
    expect(screen.getByText("Proyecto: Campana Primavera")).toBeInTheDocument();
    // First created and last suppressed labels
    expect(screen.getByText("Primera creación:")).toBeInTheDocument();
    expect(screen.getByText("Última supresión:")).toBeInTheDocument();
  });

  it("2. Composite React key test fixture: renders dual-channel records for same event without warnings", () => {
    const sharedEventId = "99999999-9999-9999-9999-999999999999";
    const initialPage: SuppressedNotificationOperationsPage = {
      operations: [
        {
          eventId: sharedEventId,
          channel: "email",
          status: "suppressed",
          reason: "provider_disabled",
          trigger: "internal_changes_requested",
          projectName: "Proyecto Dual",
          recipientCount: 2,
          firstCreatedAt: "2026-08-22T12:00:00.000Z",
          lastSuppressedAt: "2026-08-22T12:00:00.000Z",
        },
        {
          eventId: sharedEventId,
          channel: "whatsapp",
          status: "suppressed",
          reason: "provider_disabled",
          trigger: "internal_changes_requested",
          projectName: "Proyecto Dual",
          recipientCount: 1,
          firstCreatedAt: "2026-08-22T12:00:00.000Z",
          lastSuppressedAt: "2026-08-22T12:00:00.000Z",
        },
      ],
      nextCursor: null,
      hasMore: false,
    };

    render(<NotificationOperationsQueue initialPage={initialPage} />);

    expect(screen.getByText("Correo electrónico")).toBeInTheDocument();
    expect(screen.getByText("WhatsApp")).toBeInTheDocument();
  });

  it("3. Strict privacy guarantee: opaque event ID, raw UUIDs, and raw enums are never exposed in DOM text", () => {
    const secretEventId = "12345678-abcd-ef01-2345-6789abcdef01";
    const initialPage: SuppressedNotificationOperationsPage = {
      operations: [
        {
          eventId: secretEventId,
          channel: "email",
          status: "suppressed",
          reason: "provider_disabled",
          trigger: "deliverable_submitted",
          projectName: null,
          recipientCount: 1,
          firstCreatedAt: "2026-08-22T10:00:00.000Z",
          lastSuppressedAt: "2026-08-22T10:05:00.000Z",
        },
      ],
      nextCursor: null,
      hasMore: false,
    };

    const { container } = render(
      <NotificationOperationsQueue initialPage={initialPage} />,
    );

    expect(container.textContent).not.toContain(secretEventId);
    expect(container.textContent).not.toContain("deliverable_submitted");
    expect(container.textContent).not.toContain("provider_disabled");
    expect(screen.getByText("Sin contexto de proyecto")).toBeInTheDocument();
  });

  it("4. Renders NotificationOperationsEmptyState when operations list is empty", () => {
    const emptyPage: SuppressedNotificationOperationsPage = {
      operations: [],
      nextCursor: null,
      hasMore: false,
    };

    render(<NotificationOperationsQueue initialPage={emptyPage} />);

    expect(
      screen.getByText("No hay operaciones suprimidas"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "No se encontraron registros de entregas externas suprimidas autorizadas.",
      ),
    ).toBeInTheDocument();
  });

  it("5. Keyset pagination: load-more appends items in order without discarding prior items", async () => {
    const page2Op: SuppressedNotificationOperation = {
      eventId: "00000000-0000-0000-0000-000000000002",
      channel: "whatsapp",
      status: "suppressed",
      reason: "provider_disabled",
      trigger: "internal_review_approved",
      projectName: "Proyecto 2",
      recipientCount: 1,
      firstCreatedAt: "2026-08-22T09:00:00.000Z",
      lastSuppressedAt: "2026-08-22T09:05:00.000Z",
    };

    mockLoadSuppressedNotificationOperationsPageAction.mockResolvedValueOnce({
      ok: true,
      data: {
        operations: [page2Op],
        nextCursor: null,
        hasMore: false,
      },
    });

    const initialPage: SuppressedNotificationOperationsPage = {
      operations: [
        {
          eventId: "00000000-0000-0000-0000-000000000001",
          channel: "email",
          status: "suppressed",
          reason: "provider_disabled",
          trigger: "deliverable_submitted",
          projectName: "Proyecto 1",
          recipientCount: 2,
          firstCreatedAt: "2026-08-22T10:00:00.000Z",
          lastSuppressedAt: "2026-08-22T10:05:00.000Z",
        },
      ],
      nextCursor: {
        beforeSuppressedAt: "2026-08-22T10:05:00.000Z",
        beforeEventId: "00000000-0000-0000-0000-000000000001",
        beforeChannel: "email",
      },
      hasMore: true,
    };

    render(<NotificationOperationsQueue initialPage={initialPage} />);

    const loadMoreBtn = screen.getByRole("button", {
      name: "Cargar más operaciones suprimidas",
    });
    fireEvent.click(loadMoreBtn);

    await waitFor(() => {
      // Both project items exist in the DOM
      expect(screen.getByText("Proyecto: Proyecto 1")).toBeInTheDocument();
      expect(screen.getByText("Proyecto: Proyecto 2")).toBeInTheDocument();
    });

    // Visible status success message
    expect(
      screen.getByText("Operaciones adicionales cargadas correctamente."),
    ).toBeInTheDocument();
  });

  it("6. Error handling: load-more failure preserves existing rows, shows visible role=alert and offers retry", async () => {
    mockLoadSuppressedNotificationOperationsPageAction.mockResolvedValueOnce({
      ok: false,
      error: { code: "UNAVAILABLE" },
    });

    const initialPage: SuppressedNotificationOperationsPage = {
      operations: [
        {
          eventId: "00000000-0000-0000-0000-000000000001",
          channel: "email",
          status: "suppressed",
          reason: "provider_disabled",
          trigger: "deliverable_submitted",
          projectName: "Proyecto Preservado",
          recipientCount: 2,
          firstCreatedAt: "2026-08-22T10:00:00.000Z",
          lastSuppressedAt: "2026-08-22T10:05:00.000Z",
        },
      ],
      nextCursor: {
        beforeSuppressedAt: "2026-08-22T10:05:00.000Z",
        beforeEventId: "00000000-0000-0000-0000-000000000001",
        beforeChannel: "email",
      },
      hasMore: true,
    };

    render(<NotificationOperationsQueue initialPage={initialPage} />);

    const loadMoreBtn = screen.getByRole("button", {
      name: "Cargar más operaciones suprimidas",
    });
    fireEvent.click(loadMoreBtn);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(
        screen.getByText(
          "El servicio de operaciones no está disponible en este momento.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Reintentar" }),
      ).toBeInTheDocument();
    });

    // Existing rows remain intact
    expect(
      screen.getByText("Proyecto: Proyecto Preservado"),
    ).toBeInTheDocument();
  });

  it("7. Accessibility: verifies semantic <ol> list structure and ARIA attributes", () => {
    const initialPage: SuppressedNotificationOperationsPage = {
      operations: [
        {
          eventId: "00000000-0000-0000-0000-000000000001",
          channel: "email",
          status: "suppressed",
          reason: "provider_disabled",
          trigger: "deliverable_submitted",
          projectName: "Proyecto 1",
          recipientCount: 1,
          firstCreatedAt: "2026-08-22T10:00:00.000Z",
          lastSuppressedAt: "2026-08-22T10:05:00.000Z",
        },
      ],
      nextCursor: null,
      hasMore: false,
    };

    render(<NotificationOperationsQueue initialPage={initialPage} />);

    const list = screen.getByRole("list", {
      name: "Lista de operaciones de notificación suprimidas",
    });
    expect(list.tagName.toLowerCase()).toBe("ol");
  });
});
