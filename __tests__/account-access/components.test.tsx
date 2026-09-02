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

vi.mock("@/i18n/routing", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/cuenta",
  Link: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => React.createElement("a", { href, ...props }, children),
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

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/account-access/actions", () => ({
  updateOwnAccountSettingsAction: vi.fn(),
  setUserAccessStateAction: vi.fn(),
  recordStaleAccessReminderAction: vi.fn(),
  submitBugReportAction: vi.fn(),
  setBugReportStatusAction: vi.fn(),
  loadMoreUserAccessDirectoryAction: vi.fn(),
  loadMoreBugReportsAction: vi.fn(),
}));

import { AccountSettingsForm } from "@/components/shared/account-access/account-settings-form";
import { BugReportForm } from "@/components/shared/account-access/bug-report-form";
import { AccountView } from "@/components/shared/account-access/account-view";
import { UserDeactivationDialog } from "@/components/shared/account-access/user-deactivation-dialog";
import { UserReactivationDialog } from "@/components/shared/account-access/user-reactivation-dialog";
import { UserAccessDirectoryPanel } from "@/components/shared/account-access/user-access-directory-panel";
import { BugReportsPanel } from "@/components/shared/account-access/bug-reports-panel";
import { ManagerAccessConsole } from "@/components/shared/account-access/manager-access-console";
import {
  updateOwnAccountSettingsAction,
  submitBugReportAction,
  setUserAccessStateAction,
} from "@/lib/account-access/actions";
import type {
  DateTimePresentationContext,
  OwnAccountSettingsDto,
} from "@/lib/account-access/types";

const mockPresentation: DateTimePresentationContext = {
  locale: "es-MX",
  timeZone: "America/Mexico_City",
};

describe("Account Access UI Components", () => {
  const validUuid = "11111111-1111-4111-8111-111111111111";
  const validIso = "2026-09-02T12:00:00.000Z";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("AccountSettingsForm", () => {
    const defaultSettings: OwnAccountSettingsDto = {
      userId: validUuid,
      fullName: "Original Name",
      preferredLocale: "es-MX",
      timezone: "Asia/Tokyo", // arbitrary valid IANA timezone
      emailNotificationsEnabled: true,
      role: "operator",
    };

    it("renders role badge and does not provide an input to change the role", () => {
      render(<AccountSettingsForm initialSettings={defaultSettings} />);
      expect(screen.getByText("Operador")).toBeInTheDocument();
      expect(
        screen.queryByRole("combobox", { name: /rol/i }),
      ).not.toBeInTheDocument();
    });

    it("preserves arbitrary valid IANA timezone string rather than limiting to 5", () => {
      render(<AccountSettingsForm initialSettings={defaultSettings} />);
      const tzInput = screen.getByLabelText(
        /zona horaria/i,
      ) as HTMLInputElement;
      expect(tzInput.value).toBe("Asia/Tokyo");
    });

    it("updates state only from server-validated action result", async () => {
      vi.mocked(updateOwnAccountSettingsAction).mockResolvedValue({
        ok: true,
        data: {
          fullName: "Server Validated Name",
          preferredLocale: "en-US",
          timezone: "America/Chicago",
          emailNotificationsEnabled: false,
        },
      });

      render(<AccountSettingsForm initialSettings={defaultSettings} />);

      const nameInput = screen.getByLabelText(/nombre completo/i);
      fireEvent.change(nameInput, { target: { value: "New Typed Name" } });

      const saveBtn = screen.getByRole("button", { name: /guardar cambios/i });
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(updateOwnAccountSettingsAction).toHaveBeenCalled();
        expect(
          (screen.getByLabelText(/nombre completo/i) as HTMLInputElement).value,
        ).toBe("Server Validated Name");
        expect(
          (screen.getByLabelText(/zona horaria/i) as HTMLInputElement).value,
        ).toBe("America/Chicago");
      });
    });
  });

  describe("BugReportForm", () => {
    it("renders sensitive data warning banner and enforces limits", () => {
      render(<BugReportForm />);
      expect(screen.getByRole("note")).toHaveTextContent(
        /nunca incluyas contraseñas/i,
      );
      expect(screen.getByText("0 / 160")).toBeInTheDocument();
      expect(screen.getByText("0 / 5000")).toBeInTheDocument();
    });

    it("renders acknowledgement panel upon successful submission", async () => {
      vi.mocked(submitBugReportAction).mockResolvedValue({
        ok: true,
        data: {
          reportId: "rep-12345",
          status: "open",
        },
      });

      render(<BugReportForm />);

      fireEvent.change(screen.getByLabelText(/título del reporte/i), {
        target: { value: "Something broke" },
      });
      fireEvent.change(screen.getByLabelText(/descripción detallada/i), {
        target: { value: "Here are the steps to reproduce..." },
      });

      fireEvent.click(screen.getByRole("button", { name: /enviar reporte/i }));

      await waitFor(() => {
        expect(
          screen.getByTestId("bug-report-success-panel"),
        ).toBeInTheDocument();
        expect(screen.getByText(/ID: rep-12345/)).toBeInTheDocument();
        expect(screen.getByText("Abierto")).toBeInTheDocument();
      });
    });
  });

  describe("AccountView", () => {
    it("when initial settings are unavailable, renders settings retry card but leaves bug intake form available", () => {
      render(
        <AccountView
          initialSettings={{ status: "unavailable" }}
          presentation={mockPresentation}
        />,
      );

      expect(
        screen.getByTestId("account-settings-unavailable"),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /reintentar/i }),
      ).toBeInTheDocument();
      // Bug intake form must STILL be rendered!
      expect(screen.getByTestId("bug-report-form")).toBeInTheDocument();
    });
  });

  describe("UserAccessDirectoryPanel", () => {
    const mockItem = {
      userId: validUuid,
      createdAt: "2026-09-02T09:44:33.123Z", // carrier timestamp
      fullName: "Ana Garcia",
      applicationRole: "operator" as const,
      isActive: true,
      lastSuccessfulAuthAt: validIso,
      activeProjectMembershipCount: 3,
      activeTaskAssignmentCount: 5,
      activeDeliverableAssignmentCount: 1,
      pendingInvitationCount: 0,
      lastAccessAction: "reactivated" as const,
      lastAccessActionAt: validIso,
    };

    it("never renders createdAt in the DOM", () => {
      const { container } = render(
        <UserAccessDirectoryPanel
          initialResult={{
            status: "available",
            data: {
              items: [mockItem],
              nextCursor: null,
              hasMore: false,
            },
          }}
          presentation={mockPresentation}
        />,
      );

      // Verify createdAt string is nowhere in the container text
      expect(container.textContent).not.toContain("09:44:33");
      expect(container.textContent).not.toContain("2026-09-02T09:44:33.123Z");
      expect(screen.getAllByText("Ana Garcia").length).toBeGreaterThan(0);
    });

    it("renders load more button when hasMore is true", () => {
      render(
        <UserAccessDirectoryPanel
          initialResult={{
            status: "available",
            data: {
              items: [mockItem],
              nextCursor: {
                beforeCreatedAt: validIso,
                beforeUserId: validUuid,
              },
              hasMore: true,
            },
          }}
          presentation={mockPresentation}
        />,
      );

      expect(
        screen.getByRole("button", { name: /cargar más/i }),
      ).toBeInTheDocument();
    });
  });

  describe("UserDeactivationDialog", () => {
    const target = { userId: validUuid, fullName: "Carlos Mendoza" };

    it("keeps confirm button disabled until exact displayed full name is typed", () => {
      render(
        <UserDeactivationDialog
          open={true}
          onOpenChange={vi.fn()}
          targetUser={target}
        />,
      );

      const confirmBtn = screen.getByRole("button", {
        name: /confirmar desactivación/i,
      });
      expect(confirmBtn).toBeDisabled();

      const input = screen.getByPlaceholderText(
        /escribe el nombre completo exacto/i,
      );
      fireEvent.change(input, { target: { value: "Carlos" } });
      expect(confirmBtn).toBeDisabled();

      fireEvent.change(input, { target: { value: "  Carlos Mendoza  " } });
      expect(confirmBtn).not.toBeDisabled();
    });

    it("displays error with role='alert' and keeps dialog open on self-lockout", async () => {
      vi.mocked(setUserAccessStateAction).mockResolvedValue({
        ok: false,
        error: { code: "self_lockout_forbidden" },
      });

      render(
        <UserDeactivationDialog
          open={true}
          onOpenChange={vi.fn()}
          targetUser={target}
        />,
      );

      const input = screen.getByPlaceholderText(
        /escribe el nombre completo exacto/i,
      );
      fireEvent.change(input, { target: { value: "Carlos Mendoza" } });

      const confirmBtn = screen.getByRole("button", {
        name: /confirmar desactivación/i,
      });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        const alert = screen.getByRole("alert");
        expect(alert).toHaveTextContent(
          /no puedes desactivar tu propia cuenta/i,
        );
      });
    });
  });

  describe("UserReactivationDialog", () => {
    it("requires no typed phrase and states invitations are not restored", () => {
      render(
        <UserReactivationDialog
          open={true}
          onOpenChange={vi.fn()}
          targetUser={{ userId: validUuid, fullName: "Maria Lopez" }}
        />,
      );

      expect(
        screen.getByText(
          /las invitaciones previamente revocadas no serán restauradas/i,
        ),
      ).toBeInTheDocument();
      const confirmBtn = screen.getByRole("button", {
        name: /confirmar reactivación/i,
      });
      expect(confirmBtn).not.toBeDisabled();
      expect(
        screen.queryByPlaceholderText(/escribe el nombre/i),
      ).not.toBeInTheDocument();
    });
  });

  describe("BugReportsPanel (Reporter Privacy)", () => {
    it("strictly does not render seeded sentinel reporter name, email, or UUID", () => {
      // Seed a report with arbitrary sentinel data
      const sentinelName = "SECRET_SENTINEL_NAME";
      const sentinelEmail = "sentinel_email@confidential.com";
      const sentinelUserId = "99999999-9999-4999-8999-999999999999";

      const reportWithSentinels = {
        reportId: validUuid,
        title: "Public Bug Title",
        description: "Public Bug Description",
        status: "open" as const,
        reporterRole: "operator" as const,
        createdAt: validIso,
        statusChangedAt: null,
        // Sentinels:
        reporterName: sentinelName,
        reporterEmail: sentinelEmail,
        reporterId: sentinelUserId,
      };

      const { container } = render(
        <BugReportsPanel
          initialResult={{
            status: "available",
            data: {
              items: [
                reportWithSentinels as unknown as typeof reportWithSentinels,
              ],
              nextCursor: null,
              hasMore: false,
            },
          }}
          presentation={mockPresentation}
        />,
      );

      expect(screen.getByText("Public Bug Title")).toBeInTheDocument();
      expect(screen.getByText(/operador/i)).toBeInTheDocument();

      // Ensure none of the sentinel data leaked into the DOM
      expect(container.textContent).not.toContain(sentinelName);
      expect(container.textContent).not.toContain(sentinelEmail);
      expect(container.textContent).not.toContain(sentinelUserId);
    });
  });

  describe("ManagerAccessConsole", () => {
    it("renders 3 accessible tabs with proper labels", () => {
      render(
        <ManagerAccessConsole
          initialDirectory={{
            status: "available",
            data: { items: [], nextCursor: null, hasMore: false },
          }}
          initialStale={{ status: "available", data: [] }}
          initialBugReports={{
            status: "available",
            data: { items: [], nextCursor: null, hasMore: false },
          }}
          presentation={mockPresentation}
        />,
      );

      expect(screen.getByRole("tab", { name: "Usuarios" })).toBeInTheDocument();
      expect(
        screen.getByRole("tab", { name: "Acceso inactivo" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("tab", { name: "Reportes de error" }),
      ).toBeInTheDocument();
    });
  });
});
