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
const mockLoadRecipientInboxPageAction = vi.fn();

vi.mock("@/lib/notifications/actions", () => ({
  markNotificationReadAction: (input: unknown) =>
    mockMarkNotificationReadAction(input),
  markAllNotificationsReadAction: (input?: unknown) =>
    mockMarkAllNotificationsReadAction(input),
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
      (trigger, index) => ({
        recipientId: `00000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`,
        trigger,
        createdAt: "2026-08-22T12:00:00.000Z",
        occurredAt: "2026-08-22T12:00:00.000Z",
        readAt: null,
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

  it("2. Does not render raw UUIDs or payload text in visible content", () => {
    const secretUuid = "99999999-9999-9999-9999-999999999999";
    const initialPage: RecipientInboxPage = {
      notifications: [
        {
          recipientId: secretUuid,
          trigger: "task_assigned",
          createdAt: "2026-08-22T12:00:00.000Z",
          occurredAt: "2026-08-22T12:00:00.000Z",
          readAt: null,
        },
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

    expect(container.textContent).not.toContain(secretUuid);
  });

  it("3. Displays explicit textual read/unread indicator", () => {
    const initialPage: RecipientInboxPage = {
      notifications: [
        {
          recipientId: "00000000-0000-0000-0000-000000000001",
          trigger: "task_assigned",
          createdAt: "2026-08-22T12:00:00.000Z",
          occurredAt: "2026-08-22T12:00:00.000Z",
          readAt: null,
        },
        {
          recipientId: "00000000-0000-0000-0000-000000000002",
          trigger: "project_assigned",
          createdAt: "2026-08-22T11:00:00.000Z",
          occurredAt: "2026-08-22T11:00:00.000Z",
          readAt: "2026-08-22T11:30:00.000Z",
        },
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
  });

  it("4. Disables Mark All when no unread notifications exist; enables when unread exists", () => {
    const allReadPage: RecipientInboxPage = {
      notifications: [
        {
          recipientId: "00000000-0000-0000-0000-000000000001",
          trigger: "task_assigned",
          createdAt: "2026-08-22T12:00:00.000Z",
          occurredAt: "2026-08-22T12:00:00.000Z",
          readAt: "2026-08-22T12:05:00.000Z",
        },
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
    expect(
      screen.getByText("Todas las notificaciones están al día"),
    ).toBeInTheDocument();

    const unreadPage: RecipientInboxPage = {
      notifications: [
        {
          recipientId: "00000000-0000-0000-0000-000000000001",
          trigger: "task_assigned",
          createdAt: "2026-08-22T12:00:00.000Z",
          occurredAt: "2026-08-22T12:00:00.000Z",
          readAt: null,
        },
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

  it("5. Triggers mark-one action and calls router.refresh() without optimistic mutation", async () => {
    mockMarkNotificationReadAction.mockResolvedValueOnce({
      ok: true,
      changed: true,
    });

    const targetId = "00000000-0000-0000-0000-000000000001";
    const initialPage: RecipientInboxPage = {
      notifications: [
        {
          recipientId: targetId,
          trigger: "task_assigned",
          createdAt: "2026-08-22T12:00:00.000Z",
          occurredAt: "2026-08-22T12:00:00.000Z",
          readAt: null,
        },
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

  it("6. Renders NotificationEmptyState when notifications list is empty", () => {
    const emptyPage: RecipientInboxPage = {
      notifications: [],
      nextCursor: null,
      hasMore: false,
    };

    render(
      <NotificationInbox initialPage={emptyPage} currentQuery={defaultQuery} />,
    );

    expect(screen.getByText("Bandeja vacía")).toBeInTheDocument();
    expect(
      screen.getByText("No tienes notificaciones en la aplicación."),
    ).toBeInTheDocument();
  });

  it("7. Handles load-more pagination and retry behavior", async () => {
    mockLoadRecipientInboxPageAction.mockResolvedValueOnce({
      ok: false,
      error: { code: "UNAVAILABLE" },
    });

    const initialPage: RecipientInboxPage = {
      notifications: [
        {
          recipientId: "00000000-0000-0000-0000-000000000001",
          trigger: "task_assigned",
          createdAt: "2026-08-22T12:00:00.000Z",
          occurredAt: "2026-08-22T12:00:00.000Z",
          readAt: null,
        },
      ],
      nextCursor: {
        beforeCreatedAt: "2026-08-22T12:00:00.000Z",
        beforeRecipientId: "00000000-0000-0000-0000-000000000001",
      },
      hasMore: true,
    };

    render(
      <NotificationInbox
        initialPage={initialPage}
        currentQuery={defaultQuery}
      />,
    );

    const loadMoreBtn = screen.getByRole("button", {
      name: "Cargar más notificaciones",
    });
    fireEvent.click(loadMoreBtn);

    await waitFor(() => {
      expect(screen.getByText("Reintentar")).toBeInTheDocument();
    });

    // Existing rows remain preserved
    expect(screen.getByText("Asignación de tarea")).toBeInTheDocument();
  });

  it("8. Accessibility: verifies ol structure, ARIA labels, and touch targets", () => {
    const initialPage: RecipientInboxPage = {
      notifications: [
        {
          recipientId: "00000000-0000-0000-0000-000000000001",
          trigger: "task_assigned",
          createdAt: "2026-08-22T12:00:00.000Z",
          occurredAt: "2026-08-22T12:00:00.000Z",
          readAt: null,
        },
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

    const markReadBtn = screen.getByRole("button", {
      name: "Marcar Asignación de tarea como leída",
    });
    expect(markReadBtn.className).toContain("min-h-[44px]");
    expect(markReadBtn.className).toContain("min-w-[44px]");

    const markAllBtn = screen.getByRole("button", {
      name: "Marcar todas las notificaciones como leídas",
    });
    expect(markAllBtn.className).toContain("min-h-[44px]");
    expect(markAllBtn.className).toContain("min-w-[44px]");
  });
});
