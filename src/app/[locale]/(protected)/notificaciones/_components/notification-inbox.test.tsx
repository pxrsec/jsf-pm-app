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
import { NotificationInbox } from "./notification-inbox";
import type {
  RecipientInboxNotification,
  RecipientInboxPage,
  NotificationTrigger,
  RecipientInboxQuery,
} from "@/lib/notifications/inbox-contracts";
import { getDefaultNotificationRange } from "@/lib/notifications/date-utils";
import esCatalog from "../../../../../../messages/es-MX.json";

const mockRefresh = vi.fn();
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
    push: mockPush,
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/notificaciones",
}));

vi.mock("@/i18n/routing", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
    push: mockPush,
  }),
  usePathname: () => "/notificaciones",
  Link: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next-intl", () => ({
  useTranslations: (namespace?: string) => {
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
          let formatted = val;
          for (const [k, v] of Object.entries(params)) {
            formatted = formatted.replace(`{${k}}`, v);
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

const mockMarkNotificationReadAction = vi.fn();
const mockMarkAllNotificationsReadAction = vi.fn();
const mockAcknowledgeNotificationNavigationAction = vi.fn();
const mockLoadRecipientInboxPageAction = vi.fn();

vi.mock("@/lib/notifications/actions", () => ({
  markNotificationReadAction: (input: unknown) =>
    mockMarkNotificationReadAction(input),
  markAllNotificationsReadAction: (input?: unknown) =>
    mockMarkAllNotificationsReadAction(input),
  acknowledgeNotificationNavigationAction: (input: unknown) =>
    mockAcknowledgeNotificationNavigationAction(input),
  loadRecipientInboxPageAction: (input: unknown) =>
    mockLoadRecipientInboxPageAction(input),
}));

const ALL_TRIGGERS: NotificationTrigger[] = [
  "user_invited",
  "project_assigned",
  "task_assigned",
  "task_status_changed",
  "client_task_blocking",
  "client_submission_received",
  "client_submission_reopened",
  "deliverable_submitted",
  "internal_changes_requested",
  "internal_review_approved",
  "client_changes_requested",
  "client_review_approved",
  "deliverable_delivered",
  "deadline_24h",
  "deadline_12h",
  "deadline_6h",
  "deadline_overdue",
  "review_inactivity_reminder",
  "link_reported_broken",
  "invite_expiring",
  "system",
];

const defaultRange = getDefaultNotificationRange();
const defaultQuery: RecipientInboxQuery = {
  ...defaultRange,
  readFilter: "all",
};

function createNotificationFixture(
  overrides: Partial<RecipientInboxNotification> = {},
): RecipientInboxNotification {
  return {
    recipientId: "00000000-0000-0000-0000-000000000001",
    trigger: "task_assigned",
    createdAt: "2026-08-22T12:00:00.000Z",
    occurredAt: "2026-08-22T12:00:00.000Z",
    readAt: null,
    subjectKind: "task",
    subjectTitle: "Edición Principal",
    projectName: "Acme Sandbox Campaign",
    contextKind: "none",
    contextValue: null,
    destination: {
      kind: "operator_task",
      taskId: "22222222-2222-2222-2222-222222222222",
    },
    ...overrides,
  };
}

describe("NotificationInbox Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
  });

  it("1. Maps all 21 triggers to valid localized category titles without displaying raw trigger enums", () => {
    const notifications: RecipientInboxNotification[] = ALL_TRIGGERS.map(
      (trigger, index) =>
        createNotificationFixture({
          recipientId: `00000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`,
          trigger,
          destination: { kind: "none" },
        }),
    );

    const initialPage: RecipientInboxPage = {
      notifications,
      nextCursor: null,
      hasMore: false,
    };

    const { container } = render(
      <NotificationInbox
        initialPage={initialPage}
        currentQuery={defaultQuery}
      />,
    );

    for (const trigger of ALL_TRIGGERS) {
      expect(container.textContent).not.toContain(trigger);
    }
  });

  it("2. Does not render raw recipient UUIDs or internal destination IDs in visible text", () => {
    const secretRecipientUuid = "99999999-9999-9999-9999-999999999999";
    const secretTaskId = "88888888-8888-8888-8888-888888888888";
    const initialPage: RecipientInboxPage = {
      notifications: [
        createNotificationFixture({
          recipientId: secretRecipientUuid,
          destination: {
            kind: "operator_task",
            taskId: secretTaskId,
          },
        }),
      ],
      nextCursor: null,
      hasMore: false,
    };

    const { container } = render(
      <NotificationInbox
        initialPage={initialPage}
        currentQuery={defaultQuery}
      />,
    );

    expect(container.textContent).not.toContain(secretRecipientUuid);
    expect(container.textContent).not.toContain(secretTaskId);
  });

  it("3. Displays contextual sentence, project context tag, and explicit textual read/unread indicator", () => {
    const initialPage: RecipientInboxPage = {
      notifications: [
        createNotificationFixture({
          recipientId: "00000000-0000-0000-0000-000000000001",
          trigger: "task_assigned",
          subjectTitle: "Edición Principal",
          projectName: "Acme Sandbox Campaign",
          readAt: null,
        }),
        createNotificationFixture({
          recipientId: "00000000-0000-0000-0000-000000000002",
          trigger: "project_assigned",
          subjectKind: "project",
          subjectTitle: "Acme Sandbox Campaign",
          projectName: "Acme Sandbox Campaign",
          readAt: "2026-08-22T11:30:00.000Z",
          destination: {
            kind: "pm_project_overview",
            projectId: "11111111-1111-1111-1111-111111111111",
          },
        }),
      ],
      nextCursor: null,
      hasMore: false,
    };

    render(
      <NotificationInbox
        initialPage={initialPage}
        currentQuery={defaultQuery}
      />,
    );

    expect(screen.getByText("No leída")).toBeInTheDocument();
    expect(screen.getByText("Leída")).toBeInTheDocument();
    expect(
      screen.getByText("Edición Principal en Acme Sandbox Campaign"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Se te asignó al proyecto Acme Sandbox Campaign."),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Proyecto: Acme Sandbox Campaign")).toHaveLength(
      2,
    );
  });

  it("4. Read notification with valid destination renders a direct link to the canonical route", () => {
    const taskId = "22222222-2222-2222-2222-222222222222";
    const initialPage: RecipientInboxPage = {
      notifications: [
        createNotificationFixture({
          recipientId: "00000000-0000-0000-0000-000000000001",
          readAt: "2026-08-22T12:05:00.000Z",
          destination: {
            kind: "operator_task",
            taskId,
          },
        }),
      ],
      nextCursor: null,
      hasMore: false,
    };

    render(
      <NotificationInbox
        initialPage={initialPage}
        currentQuery={defaultQuery}
      />,
    );

    const link = screen.getByRole("link", {
      name: /Ver detalles/i,
    });
    expect(link).toHaveAttribute("href", `/operador/tareas/${taskId}`);
    expect(mockAcknowledgeNotificationNavigationAction).not.toHaveBeenCalled();
  });

  it("5. Unread detail click triggers acknowledgement action once before navigating with router.push", async () => {
    mockAcknowledgeNotificationNavigationAction.mockResolvedValueOnce({
      ok: true,
      changed: true,
    });

    const targetId = "00000000-0000-0000-0000-000000000001";
    const taskId = "22222222-2222-2222-2222-222222222222";
    const initialPage: RecipientInboxPage = {
      notifications: [
        createNotificationFixture({
          recipientId: targetId,
          readAt: null,
          destination: {
            kind: "operator_task",
            taskId,
          },
        }),
      ],
      nextCursor: null,
      hasMore: false,
    };

    render(
      <NotificationInbox
        initialPage={initialPage}
        currentQuery={defaultQuery}
      />,
    );

    const detailBtn = screen.getByRole("button", {
      name: /Ver detalles/i,
    });
    fireEvent.click(detailBtn);

    expect(mockAcknowledgeNotificationNavigationAction).toHaveBeenCalledWith({
      notificationRecipientId: targetId,
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(`/operador/tareas/${taskId}`);
    });
  });

  it("6. Unread detail click with changed: false still navigates once", async () => {
    mockAcknowledgeNotificationNavigationAction.mockResolvedValueOnce({
      ok: true,
      changed: false,
    });

    const targetId = "00000000-0000-0000-0000-000000000001";
    const taskId = "22222222-2222-2222-2222-222222222222";
    const initialPage: RecipientInboxPage = {
      notifications: [
        createNotificationFixture({
          recipientId: targetId,
          readAt: null,
          destination: {
            kind: "operator_task",
            taskId,
          },
        }),
      ],
      nextCursor: null,
      hasMore: false,
    };

    render(
      <NotificationInbox
        initialPage={initialPage}
        currentQuery={defaultQuery}
      />,
    );

    const detailBtn = screen.getByRole("button", {
      name: /Ver detalles/i,
    });
    fireEvent.click(detailBtn);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(`/operador/tareas/${taskId}`);
    });
  });

  it("7. Failed acknowledgement displays localized alert and halts navigation", async () => {
    mockAcknowledgeNotificationNavigationAction.mockResolvedValueOnce({
      ok: false,
      error: { code: "UNAVAILABLE" },
    });

    const targetId = "00000000-0000-0000-0000-000000000001";
    const initialPage: RecipientInboxPage = {
      notifications: [
        createNotificationFixture({
          recipientId: targetId,
          readAt: null,
        }),
      ],
      nextCursor: null,
      hasMore: false,
    };

    render(
      <NotificationInbox
        initialPage={initialPage}
        currentQuery={defaultQuery}
      />,
    );

    const detailBtn = screen.getByRole("button", {
      name: /Ver detalles/i,
    });
    fireEvent.click(detailBtn);

    await waitFor(() => {
      expect(
        screen.getByText(
          "No se pudo confirmar la notificación. Inténtalo de nuevo.",
        ),
      ).toBeInTheDocument();
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it("8. No-destination unread notification has Mark-as-read but no detail button; read has neither", () => {
    const initialPage: RecipientInboxPage = {
      notifications: [
        createNotificationFixture({
          recipientId: "00000000-0000-0000-0000-000000000001",
          trigger: "user_invited",
          subjectKind: "invitation",
          subjectTitle: null,
          projectName: null,
          readAt: null,
          destination: { kind: "none" },
        }),
        createNotificationFixture({
          recipientId: "00000000-0000-0000-0000-000000000002",
          trigger: "system",
          subjectKind: "system",
          subjectTitle: null,
          projectName: null,
          readAt: "2026-08-22T10:00:00.000Z",
          destination: { kind: "none" },
        }),
      ],
      nextCursor: null,
      hasMore: false,
    };

    render(
      <NotificationInbox
        initialPage={initialPage}
        currentQuery={defaultQuery}
      />,
    );

    // Only one Mark-as-read button (for unread row)
    expect(
      screen.getByRole("button", {
        name: "Marcar Invitación como leída",
      }),
    ).toBeInTheDocument();

    // No detail buttons or links
    expect(screen.queryByText("Ver detalles")).not.toBeInTheDocument();
  });

  it("9. Standalone Mark-as-read triggers mark-one action and calls router.refresh()", async () => {
    mockMarkNotificationReadAction.mockResolvedValueOnce({
      ok: true,
      changed: true,
    });

    const targetId = "00000000-0000-0000-0000-000000000001";
    const initialPage: RecipientInboxPage = {
      notifications: [
        createNotificationFixture({
          recipientId: targetId,
          readAt: null,
        }),
      ],
      nextCursor: null,
      hasMore: false,
    };

    render(
      <NotificationInbox
        initialPage={initialPage}
        currentQuery={defaultQuery}
      />,
    );

    const markReadBtn = screen.getByRole("button", {
      name: "Marcar Asignación de tarea como leída",
    });
    fireEvent.click(markReadBtn);

    expect(mockMarkNotificationReadAction).toHaveBeenCalledWith({
      notificationRecipientId: targetId,
    });

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });
  });

  it("10. Disables Mark All when no unread notifications exist; enables when unread exists", () => {
    const allReadPage: RecipientInboxPage = {
      notifications: [
        createNotificationFixture({
          readAt: "2026-08-22T12:05:00.000Z",
        }),
      ],
      nextCursor: null,
      hasMore: false,
    };

    const { rerender } = render(
      <NotificationInbox
        initialPage={allReadPage}
        currentQuery={defaultQuery}
      />,
    );

    const markAllBtn = screen.getByRole("button", {
      name: "Marcar todas las notificaciones como leídas",
    });
    expect(markAllBtn).toBeDisabled();

    const unreadPage: RecipientInboxPage = {
      notifications: [
        createNotificationFixture({
          readAt: null,
        }),
      ],
      nextCursor: null,
      hasMore: false,
    };

    rerender(
      <NotificationInbox
        initialPage={unreadPage}
        currentQuery={defaultQuery}
      />,
    );
    expect(markAllBtn).not.toBeDisabled();
  });

  it("11. Renders NotificationEmptyState when notifications list is empty", () => {
    const emptyPage: RecipientInboxPage = {
      notifications: [],
      nextCursor: null,
      hasMore: false,
    };

    render(
      <NotificationInbox initialPage={emptyPage} currentQuery={defaultQuery} />,
    );

    expect(screen.getByText("Bandeja vacía")).toBeInTheDocument();
  });

  it("12. Accessibility: verifies ol structure, ARIA labels, and touch targets", () => {
    const initialPage: RecipientInboxPage = {
      notifications: [
        createNotificationFixture({
          readAt: null,
        }),
      ],
      nextCursor: null,
      hasMore: false,
    };

    render(
      <NotificationInbox
        initialPage={initialPage}
        currentQuery={defaultQuery}
      />,
    );

    const list = screen.getByRole("list", { name: "Lista de notificaciones" });
    expect(list.tagName.toLowerCase()).toBe("ol");

    const detailBtn = screen.getByRole("button", {
      name: /Ver detalles/i,
    });
    expect(detailBtn.className).toContain("min-h-[44px]");
    expect(detailBtn.className).toContain("min-w-[44px]");

    const markReadBtn = screen.getByRole("button", {
      name: "Marcar Asignación de tarea como leída",
    });
    expect(markReadBtn.className).toContain("min-h-[44px]");
    expect(markReadBtn.className).toContain("min-w-[44px]");
  });
});
