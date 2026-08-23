import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

const mockCookies = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () => mockCookies(),
}));

const mockRequireSession = vi.fn();
vi.mock("@/lib/auth/session", () => {
  class AuthError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = "AuthError";
      this.code = code;
    }
  }

  return {
    AuthError,
    requireSession: (cookieStore: unknown) => mockRequireSession(cookieStore),
  };
});

const mockUserClient = { kind: "user-client" };
const mockAdminClient = { kind: "admin-client" };

const mockCreateClient = vi.fn(() => mockUserClient);
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));

const mockCreateAdminClient = vi.fn(() => mockAdminClient);
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

const mockIsNotificationDemoAlertEvaluationEnabled = vi.fn();
vi.mock("../config", () => ({
  isNotificationDemoAlertEvaluationEnabled: () =>
    mockIsNotificationDemoAlertEvaluationEnabled(),
}));

const mockIsLocalNotificationDemoPosture = vi.fn();
const mockEvaluateNotificationAlerts = vi.fn();
const mockAssertPmLeadForProject = vi.fn();

vi.mock("../alert-evaluator", () => ({
  isLocalNotificationDemoPosture: () => mockIsLocalNotificationDemoPosture(),
  evaluateNotificationAlerts: (supabase: unknown, projectId: string | null) =>
    mockEvaluateNotificationAlerts(supabase, projectId),
  assertPmLeadForProject: (
    supabase: unknown,
    userId: string,
    projectId: string,
  ) => mockAssertPmLeadForProject(supabase, userId, projectId),
}));

import { evaluateNotificationAlertsAction } from "../alert-evaluator-actions";
import { AuthError } from "@/lib/auth/session";

describe("evaluateNotificationAlertsAction", () => {
  const validProjectId = "11111111-1111-1111-1111-111111111111";
  const safeSummary = {
    tasksEvaluated: 10,
    reviewsEvaluated: 5,
    eventsCreated: 3,
    inAppRecipientsCreated: 3,
    externalSuppressionsCreated: 2,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockResolvedValue({} as never);
    mockIsNotificationDemoAlertEvaluationEnabled.mockReturnValue(true);
    mockIsLocalNotificationDemoPosture.mockReturnValue(true);
  });

  describe("Authentication and Environment Posture Gates", () => {
    it("1. Returns UNAUTHORIZED on AuthError without invoking admin client or evaluator", async () => {
      mockRequireSession.mockRejectedValueOnce(
        new AuthError("UNAUTHENTICATED", "Session missing"),
      );

      const result = await evaluateNotificationAlertsAction({});

      expect(result).toEqual({
        ok: false,
        error: { code: "UNAUTHORIZED" },
      });
      expect(mockCreateAdminClient).not.toHaveBeenCalled();
      expect(mockEvaluateNotificationAlerts).not.toHaveBeenCalled();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });

    it("2. Re-throws unexpected non-AuthError to route boundary without invoking admin client", async () => {
      mockRequireSession.mockRejectedValueOnce(
        new Error("Fatal connection crash"),
      );

      await expect(evaluateNotificationAlertsAction({})).rejects.toThrow(
        "Fatal connection crash",
      );
      expect(mockCreateAdminClient).not.toHaveBeenCalled();
      expect(mockEvaluateNotificationAlerts).not.toHaveBeenCalled();
    });

    it("3. Returns UNAVAILABLE when demo flag is disabled without invoking admin client", async () => {
      mockRequireSession.mockResolvedValueOnce({
        user: { id: "admin-1" },
        role: "admin",
      });
      mockIsNotificationDemoAlertEvaluationEnabled.mockReturnValue(false);

      const result = await evaluateNotificationAlertsAction({});

      expect(result).toEqual({
        ok: false,
        error: { code: "UNAVAILABLE" },
      });
      expect(mockCreateAdminClient).not.toHaveBeenCalled();
      expect(mockEvaluateNotificationAlerts).not.toHaveBeenCalled();
      expect(mockAssertPmLeadForProject).not.toHaveBeenCalled();
    });

    it("4. Returns UNAVAILABLE when local demonstration posture is false without invoking admin client", async () => {
      mockRequireSession.mockResolvedValueOnce({
        user: { id: "admin-1" },
        role: "admin",
      });
      mockIsLocalNotificationDemoPosture.mockReturnValue(false);

      const result = await evaluateNotificationAlertsAction({});

      expect(result).toEqual({
        ok: false,
        error: { code: "UNAVAILABLE" },
      });
      expect(mockCreateAdminClient).not.toHaveBeenCalled();
      expect(mockEvaluateNotificationAlerts).not.toHaveBeenCalled();
    });
  });

  describe("Admin Global Evaluation", () => {
    it("1. Accepts empty object, calls evaluator with privileged admin client and exact null, revalidates paths, and returns summary", async () => {
      mockRequireSession.mockResolvedValueOnce({
        user: { id: "admin-1" },
        role: "admin",
      });
      mockEvaluateNotificationAlerts.mockResolvedValueOnce(safeSummary);

      const result = await evaluateNotificationAlertsAction({});

      expect(mockCreateAdminClient).toHaveBeenCalledTimes(1);
      expect(mockEvaluateNotificationAlerts).toHaveBeenCalledTimes(1);
      expect(mockEvaluateNotificationAlerts).toHaveBeenCalledWith(
        mockAdminClient,
        null,
      );
      expect(result).toEqual({
        ok: true,
        data: safeSummary,
      });

      expect(mockRevalidatePath).toHaveBeenCalledWith("/admin/notificaciones");
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        "/en/admin/notificaciones",
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith("/pm/notificaciones");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/en/pm/notificaciones");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/notificaciones");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/en/notificaciones");
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        "/[locale]/(protected)",
        "layout",
      );
    });

    it("2. Rejects extra input with VALIDATION_FAILED without invoking admin client", async () => {
      mockRequireSession.mockResolvedValueOnce({
        user: { id: "admin-1" },
        role: "admin",
      });

      const result = await evaluateNotificationAlertsAction({
        unexpectedKey: "some-value",
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "VALIDATION_FAILED" },
      });
      expect(mockCreateAdminClient).not.toHaveBeenCalled();
      expect(mockEvaluateNotificationAlerts).not.toHaveBeenCalled();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("PM Selected Project Evaluation", () => {
    it("1. Validates PM Lead capacity with cookie client, calls evaluator with privileged admin client and project UUID, and revalidates paths", async () => {
      mockRequireSession.mockResolvedValueOnce({
        user: { id: "pm-1" },
        role: "pm",
      });
      mockAssertPmLeadForProject.mockResolvedValueOnce(true);
      mockEvaluateNotificationAlerts.mockResolvedValueOnce(safeSummary);

      const result = await evaluateNotificationAlertsAction({
        projectId: validProjectId,
      });

      expect(mockAssertPmLeadForProject).toHaveBeenCalledWith(
        mockUserClient,
        "pm-1",
        validProjectId,
      );
      expect(mockCreateAdminClient).toHaveBeenCalledTimes(1);
      expect(mockEvaluateNotificationAlerts).toHaveBeenCalledWith(
        mockAdminClient,
        validProjectId,
      );
      expect(result).toEqual({
        ok: true,
        data: safeSummary,
      });
      expect(mockRevalidatePath).toHaveBeenCalledTimes(7);
    });

    it("2. Fails closed with UNAUTHORIZED if PM user is not an active PM Lead for that project without invoking admin client", async () => {
      mockRequireSession.mockResolvedValueOnce({
        user: { id: "pm-1" },
        role: "pm",
      });
      mockAssertPmLeadForProject.mockResolvedValueOnce(false);

      const result = await evaluateNotificationAlertsAction({
        projectId: validProjectId,
      });

      expect(mockAssertPmLeadForProject).toHaveBeenCalledWith(
        mockUserClient,
        "pm-1",
        validProjectId,
      );
      expect(result).toEqual({
        ok: false,
        error: { code: "UNAUTHORIZED" },
      });
      expect(mockCreateAdminClient).not.toHaveBeenCalled();
      expect(mockEvaluateNotificationAlerts).not.toHaveBeenCalled();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });

    it("3. Rejects invalid input (non-UUID, missing projectId, extra keys) with VALIDATION_FAILED without invoking admin client", async () => {
      mockRequireSession.mockResolvedValue({
        user: { id: "pm-1" },
        role: "pm",
      });

      // Missing projectId
      let result = await evaluateNotificationAlertsAction({});
      expect(result).toEqual({
        ok: false,
        error: { code: "VALIDATION_FAILED" },
      });

      // Invalid UUID
      result = await evaluateNotificationAlertsAction({
        projectId: "invalid-uuid",
      });
      expect(result).toEqual({
        ok: false,
        error: { code: "VALIDATION_FAILED" },
      });

      // Extra keys
      result = await evaluateNotificationAlertsAction({
        projectId: validProjectId,
        extra: true,
      });
      expect(result).toEqual({
        ok: false,
        error: { code: "VALIDATION_FAILED" },
      });

      expect(mockAssertPmLeadForProject).not.toHaveBeenCalled();
      expect(mockCreateAdminClient).not.toHaveBeenCalled();
      expect(mockEvaluateNotificationAlerts).not.toHaveBeenCalled();
    });
  });

  describe("Other Roles and Error Mapping", () => {
    it("1. Returns UNAUTHORIZED for Operator and Client roles without invoking admin client", async () => {
      mockRequireSession.mockResolvedValueOnce({
        user: { id: "op-1" },
        role: "operator",
      });

      let result = await evaluateNotificationAlertsAction({});
      expect(result).toEqual({
        ok: false,
        error: { code: "UNAUTHORIZED" },
      });

      mockRequireSession.mockResolvedValueOnce({
        user: { id: "client-1" },
        role: "client",
      });

      result = await evaluateNotificationAlertsAction({});
      expect(result).toEqual({
        ok: false,
        error: { code: "UNAUTHORIZED" },
      });

      expect(mockCreateAdminClient).not.toHaveBeenCalled();
      expect(mockEvaluateNotificationAlerts).not.toHaveBeenCalled();
    });

    it("2. Maps evaluator failure to UNAVAILABLE and skips revalidation", async () => {
      mockRequireSession.mockResolvedValueOnce({
        user: { id: "admin-1" },
        role: "admin",
      });
      mockEvaluateNotificationAlerts.mockRejectedValueOnce(
        new Error("RPC failed"),
      );

      const result = await evaluateNotificationAlertsAction({});

      expect(result).toEqual({
        ok: false,
        error: { code: "UNAVAILABLE" },
      });
      expect(mockCreateAdminClient).toHaveBeenCalledTimes(1);
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });

    it("3. Maps admin client instantiation failure to UNAVAILABLE and skips revalidation", async () => {
      mockRequireSession.mockResolvedValueOnce({
        user: { id: "admin-1" },
        role: "admin",
      });
      mockCreateAdminClient.mockImplementationOnce(() => {
        throw new Error("Missing secret key");
      });

      const result = await evaluateNotificationAlertsAction({});

      expect(result).toEqual({
        ok: false,
        error: { code: "UNAVAILABLE" },
      });
      expect(mockCreateAdminClient).toHaveBeenCalledTimes(1);
      expect(mockEvaluateNotificationAlerts).not.toHaveBeenCalled();
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });
  });
});
