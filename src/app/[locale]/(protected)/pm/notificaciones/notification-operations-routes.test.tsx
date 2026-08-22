import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockCookies = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () => mockCookies(),
}));

const mockRedirect = vi.fn((url: string) => {
  const error = new Error(`NEXT_REDIRECT: ${url}`);
  (error as unknown as { digest: string }).digest = `NEXT_REDIRECT;${url}`;
  throw error;
});
vi.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
}));

const mockGetLocale = vi.fn();
vi.mock("next-intl/server", () => ({
  getLocale: () => mockGetLocale(),
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));

const mockRequireSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  requireSession: (cookieStore: unknown) => mockRequireSession(cookieStore),
}));

const mockCreateClient = vi.fn(() => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));

const mockHasActivePmLeadMembership = vi.fn();
vi.mock("@/lib/notifications/operations-authorization", () => ({
  hasActivePmLeadMembership: (supabase: unknown, userId: string) =>
    mockHasActivePmLeadMembership(supabase, userId),
}));

const mockListSuppressedNotificationOperationsPage = vi.fn();
vi.mock("@/lib/notifications/operations-queries", () => ({
  listSuppressedNotificationOperationsPage: (supabase: unknown) =>
    mockListSuppressedNotificationOperationsPage(supabase),
}));

vi.mock("./_components/notification-operations-screen", () => ({
  NotificationOperationsScreen: vi.fn(
    ({ initialPage }: { initialPage: unknown }) => (
      <div data-testid="screen">{JSON.stringify(initialPage)}</div>
    ),
  ),
}));

import PmNotificationOperationsPage from "./page";
import AdminNotificationOperationsPage from "@/app/[locale]/(protected)/admin/notificaciones/page";

describe("Notification Operations Route Server Entry Points", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockResolvedValue({} as never);
    mockGetLocale.mockResolvedValue("es-MX");
  });

  describe("PM Operations Route (pm/notificaciones/page.tsx)", () => {
    it("1. PM Lead: authorizes capacity, fetches first page, and renders screen", async () => {
      mockRequireSession.mockResolvedValueOnce({
        user: { id: "user-pm-lead" },
        profile: {
          id: "user-pm-lead",
          role: "pm",
          is_active: true,
          deleted_at: null,
        },
        role: "pm",
      });
      mockHasActivePmLeadMembership.mockResolvedValueOnce(true);

      const mockInitialPage = {
        operations: [],
        nextCursor: null,
        hasMore: false,
      };
      mockListSuppressedNotificationOperationsPage.mockResolvedValueOnce(
        mockInitialPage,
      );

      const element = await PmNotificationOperationsPage();

      expect(mockHasActivePmLeadMembership).toHaveBeenCalledWith(
        expect.anything(),
        "user-pm-lead",
      );
      expect(
        mockListSuppressedNotificationOperationsPage,
      ).toHaveBeenCalledTimes(1);
      expect(mockRedirect).not.toHaveBeenCalled();
      expect(element).toBeDefined();
    });

    it("2. PM Watcher (no PM lead capacity): redirects to localized /pm without querying queue", async () => {
      mockRequireSession.mockResolvedValueOnce({
        user: { id: "user-pm-watcher" },
        profile: {
          id: "user-pm-watcher",
          role: "pm",
          is_active: true,
          deleted_at: null,
        },
        role: "pm",
      });
      mockHasActivePmLeadMembership.mockResolvedValueOnce(false);

      await expect(PmNotificationOperationsPage()).rejects.toThrow(
        "NEXT_REDIRECT: /pm",
      );

      expect(mockRedirect).toHaveBeenCalledWith("/pm");
      expect(
        mockListSuppressedNotificationOperationsPage,
      ).not.toHaveBeenCalled();
    });

    it("3. English locale PM Watcher: redirects to /en/pm", async () => {
      mockGetLocale.mockResolvedValueOnce("en-US");
      mockRequireSession.mockResolvedValueOnce({
        user: { id: "user-pm-watcher-en" },
        profile: {
          id: "user-pm-watcher-en",
          role: "pm",
          is_active: true,
          deleted_at: null,
        },
        role: "pm",
      });
      mockHasActivePmLeadMembership.mockResolvedValueOnce(false);

      await expect(PmNotificationOperationsPage()).rejects.toThrow(
        "NEXT_REDIRECT: /en/pm",
      );

      expect(mockRedirect).toHaveBeenCalledWith("/en/pm");
      expect(
        mockListSuppressedNotificationOperationsPage,
      ).not.toHaveBeenCalled();
    });

    it("4. Non-PM user attempting PM operations route: redirects to role default path", async () => {
      mockRequireSession.mockResolvedValueOnce({
        user: { id: "user-op" },
        profile: {
          id: "user-op",
          role: "operator",
          is_active: true,
          deleted_at: null,
        },
        role: "operator",
      });

      await expect(PmNotificationOperationsPage()).rejects.toThrow(
        "NEXT_REDIRECT: /operador",
      );

      expect(mockRedirect).toHaveBeenCalledWith("/operador");
      expect(mockHasActivePmLeadMembership).not.toHaveBeenCalled();
      expect(
        mockListSuppressedNotificationOperationsPage,
      ).not.toHaveBeenCalled();
    });
  });

  describe("Admin Operations Route (admin/notificaciones/page.tsx)", () => {
    it("1. Admin user: fetches first page and renders screen without membership check", async () => {
      mockRequireSession.mockResolvedValueOnce({
        user: { id: "user-admin" },
        profile: {
          id: "user-admin",
          role: "admin",
          is_active: true,
          deleted_at: null,
        },
        role: "admin",
      });

      const mockInitialPage = {
        operations: [],
        nextCursor: null,
        hasMore: false,
      };
      mockListSuppressedNotificationOperationsPage.mockResolvedValueOnce(
        mockInitialPage,
      );

      const element = await AdminNotificationOperationsPage();

      expect(mockHasActivePmLeadMembership).not.toHaveBeenCalled();
      expect(
        mockListSuppressedNotificationOperationsPage,
      ).toHaveBeenCalledTimes(1);
      expect(mockRedirect).not.toHaveBeenCalled();
      expect(element).toBeDefined();
    });

    it("2. PM user attempting Admin route directly: redirects to /pm without querying queue", async () => {
      mockRequireSession.mockResolvedValueOnce({
        user: { id: "user-pm" },
        profile: {
          id: "user-pm",
          role: "pm",
          is_active: true,
          deleted_at: null,
        },
        role: "pm",
      });

      await expect(AdminNotificationOperationsPage()).rejects.toThrow(
        "NEXT_REDIRECT: /pm",
      );

      expect(mockRedirect).toHaveBeenCalledWith("/pm");
      expect(
        mockListSuppressedNotificationOperationsPage,
      ).not.toHaveBeenCalled();
    });
  });
});
