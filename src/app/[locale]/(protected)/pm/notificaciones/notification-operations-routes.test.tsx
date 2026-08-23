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

const mockIsNotificationDemoAlertEvaluationEnabled = vi.fn();
const mockIsLocalNotificationDemoPosture = vi.fn();
const mockListActivePmLeadEvaluationProjects = vi.fn();
vi.mock("@/lib/notifications/alert-evaluator", () => ({
  isNotificationDemoAlertEvaluationEnabled: () =>
    mockIsNotificationDemoAlertEvaluationEnabled(),
  isLocalNotificationDemoPosture: () => mockIsLocalNotificationDemoPosture(),
  listActivePmLeadEvaluationProjects: (supabase: unknown, userId: string) =>
    mockListActivePmLeadEvaluationProjects(supabase, userId),
}));

const mockScreen = vi.fn();
vi.mock("./_components/notification-operations-screen", () => ({
  NotificationOperationsScreen: (props: unknown) => {
    mockScreen(props);
    return <div data-testid="screen">{JSON.stringify(props)}</div>;
  },
}));

import PmNotificationOperationsPage from "./page";
import AdminNotificationOperationsPage from "@/app/[locale]/(protected)/admin/notificaciones/page";

describe("Notification Operations Route Server Entry Points", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockResolvedValue({} as never);
    mockGetLocale.mockResolvedValue("es-MX");
    mockIsNotificationDemoAlertEvaluationEnabled.mockReturnValue(true);
    mockIsLocalNotificationDemoPosture.mockReturnValue(true);
    mockListActivePmLeadEvaluationProjects.mockResolvedValue([
      { id: "proj-1", name: "Alpha Project" },
    ]);
  });

  describe("PM Operations Route (pm/notificaciones/page.tsx)", () => {
    it("1. PM Lead with demo flag & posture enabled: passes pm-project manual control with lead projects", async () => {
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
      expect(mockListActivePmLeadEvaluationProjects).toHaveBeenCalledWith(
        expect.anything(),
        "user-pm-lead",
      );
      expect(element.props).toEqual({
        initialPage: mockInitialPage,
        manualAlertEvaluation: {
          kind: "pm-project",
          projects: [{ id: "proj-1", name: "Alpha Project" }],
        },
      });
      expect(mockRedirect).not.toHaveBeenCalled();
    });

    it("2. PM Lead with demo flag disabled: omits manual control prop", async () => {
      mockRequireSession.mockResolvedValueOnce({
        user: { id: "user-pm-lead" },
        role: "pm",
      });
      mockHasActivePmLeadMembership.mockResolvedValueOnce(true);
      mockIsNotificationDemoAlertEvaluationEnabled.mockReturnValueOnce(false);

      const mockInitialPage = {
        operations: [],
        nextCursor: null,
        hasMore: false,
      };
      mockListSuppressedNotificationOperationsPage.mockResolvedValueOnce(
        mockInitialPage,
      );

      const element = await PmNotificationOperationsPage();

      expect(mockListActivePmLeadEvaluationProjects).not.toHaveBeenCalled();
      expect(element.props).toEqual({
        initialPage: mockInitialPage,
        manualAlertEvaluation: undefined,
      });
    });

    it("3. PM Lead with non-local posture: omits manual control prop", async () => {
      mockRequireSession.mockResolvedValueOnce({
        user: { id: "user-pm-lead" },
        role: "pm",
      });
      mockHasActivePmLeadMembership.mockResolvedValueOnce(true);
      mockIsLocalNotificationDemoPosture.mockReturnValueOnce(false);

      const mockInitialPage = {
        operations: [],
        nextCursor: null,
        hasMore: false,
      };
      mockListSuppressedNotificationOperationsPage.mockResolvedValueOnce(
        mockInitialPage,
      );

      const element = await PmNotificationOperationsPage();

      expect(mockListActivePmLeadEvaluationProjects).not.toHaveBeenCalled();
      expect(element.props).toEqual({
        initialPage: mockInitialPage,
        manualAlertEvaluation: undefined,
      });
    });

    it("4. PM Lead with empty projects list: omits manual control prop and preserves queue rendering", async () => {
      mockRequireSession.mockResolvedValueOnce({
        user: { id: "user-pm-lead" },
        role: "pm",
      });
      mockHasActivePmLeadMembership.mockResolvedValueOnce(true);
      mockListActivePmLeadEvaluationProjects.mockResolvedValueOnce([]);

      const mockInitialPage = {
        operations: [],
        nextCursor: null,
        hasMore: false,
      };
      mockListSuppressedNotificationOperationsPage.mockResolvedValueOnce(
        mockInitialPage,
      );

      const element = await PmNotificationOperationsPage();

      expect(element.props).toEqual({
        initialPage: mockInitialPage,
        manualAlertEvaluation: undefined,
      });
    });

    it("5. PM Watcher (no PM lead capacity): redirects to localized /pm without querying queue or evaluator", async () => {
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
      expect(mockListActivePmLeadEvaluationProjects).not.toHaveBeenCalled();
    });

    it("6. English locale PM Watcher: redirects to /en/pm", async () => {
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

    it("7. Non-PM user attempting PM operations route: redirects to role default path", async () => {
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
    it("1. Admin user with demo flag & posture enabled: passes admin-global manual control", async () => {
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
      expect(element.props).toEqual({
        initialPage: mockInitialPage,
        manualAlertEvaluation: { kind: "admin-global" },
      });
      expect(mockRedirect).not.toHaveBeenCalled();
      expect(element).toBeDefined();
    });

    it("2. Admin user with demo flag disabled: omits manual control prop", async () => {
      mockRequireSession.mockResolvedValueOnce({
        user: { id: "user-admin" },
        role: "admin",
      });
      mockIsNotificationDemoAlertEvaluationEnabled.mockReturnValueOnce(false);

      const mockInitialPage = {
        operations: [],
        nextCursor: null,
        hasMore: false,
      };
      mockListSuppressedNotificationOperationsPage.mockResolvedValueOnce(
        mockInitialPage,
      );

      const element = await AdminNotificationOperationsPage();

      expect(element.props).toEqual({
        initialPage: mockInitialPage,
        manualAlertEvaluation: undefined,
      });
    });

    it("3. Admin user with non-local posture: omits manual control prop", async () => {
      mockRequireSession.mockResolvedValueOnce({
        user: { id: "user-admin" },
        role: "admin",
      });
      mockIsLocalNotificationDemoPosture.mockReturnValueOnce(false);

      const mockInitialPage = {
        operations: [],
        nextCursor: null,
        hasMore: false,
      };
      mockListSuppressedNotificationOperationsPage.mockResolvedValueOnce(
        mockInitialPage,
      );

      const element = await AdminNotificationOperationsPage();

      expect(element.props).toEqual({
        initialPage: mockInitialPage,
        manualAlertEvaluation: undefined,
      });
    });

    it("4. PM user attempting Admin route directly: redirects to /pm without querying queue", async () => {
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
