import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => mockRevalidatePath(path),
}));

const mockCookies = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () => mockCookies(),
}));

const mockRequireSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  requireSession: (cookieStore: unknown) => mockRequireSession(cookieStore),
  AuthError: class AuthError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = "AuthError";
      this.code = code;
    }
  },
}));

const mockCreateClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: (cookieStore: unknown) => mockCreateClient(cookieStore),
}));

const mockSubmitDeliverableVersion = vi.fn();
vi.mock("@/lib/deliverables/commands", () => ({
  submitDeliverableVersion: (supabase: unknown, input: unknown) =>
    mockSubmitDeliverableVersion(supabase, input),
}));

const mockGetOperatorDeliverableForSubmission = vi.fn();
vi.mock("@/lib/operator/queries", () => ({
  getOperatorDeliverableForSubmission: (supabase: unknown, id: string) =>
    mockGetOperatorDeliverableForSubmission(supabase, id),
}));

import { submitOperatorDeliverableVersionAction } from "@/lib/operator/actions";
import { AuthError } from "@/lib/auth/session";

describe("Operator Actions (src/lib/operator/actions.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockResolvedValue({});
    mockRequireSession.mockResolvedValue({
      userId: "user-op-1",
      role: "operator",
    });
    mockCreateClient.mockResolvedValue({});
  });

  const validPayload = {
    deliverable_id: "00000000-0000-0000-0000-000000000001",
    submission_url: "https://drive.google.com/file/d/12345/view",
    submission_note: "Initial version",
  };

  const validTarget = {
    taskId: "00000000-0000-0000-0000-000000000001",
    projectId: "10000000-0000-0000-0000-000000000001",
    deliverableId: "00000000-0000-0000-0000-000000000001",
    deliverableTitle: "Main Video Edit",
    deliverableWorkflowType: "production" as const,
    deliverableStatus: "pending" as const,
  };

  describe("Input Validation", () => {
    it("rejects malformed UUID", async () => {
      const result = await submitOperatorDeliverableVersionAction({
        ...validPayload,
        deliverable_id: "invalid-uuid",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
      }
    });

    it("rejects non-Google Drive URL", async () => {
      const result = await submitOperatorDeliverableVersionAction({
        ...validPayload,
        submission_url: "https://dropbox.com/file/123",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
      }
    });

    it("rejects submission note longer than 1000 characters", async () => {
      const result = await submitOperatorDeliverableVersionAction({
        ...validPayload,
        submission_note: "a".repeat(1001),
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
      }
    });
  });

  describe("Authentication & Role Authorization", () => {
    it("throws AuthError on missing or invalid session", async () => {
      mockRequireSession.mockRejectedValue(
        new AuthError("UNAUTHENTICATED", "No session"),
      );

      await expect(
        submitOperatorDeliverableVersionAction(validPayload),
      ).rejects.toThrow("No session");
    });

    it("returns UNAUTHORIZED result when session role is not operator", async () => {
      mockRequireSession.mockResolvedValue({
        userId: "user-client-1",
        role: "client",
      });

      const result = await submitOperatorDeliverableVersionAction(validPayload);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("UNAUTHORIZED");
      }
    });
  });

  describe("Preflight Safe Target Resolution & Transition Rules", () => {
    it("returns NOT_FOUND when deliverable is absent or not visible to operator", async () => {
      mockGetOperatorDeliverableForSubmission.mockResolvedValue(null);

      const result = await submitOperatorDeliverableVersionAction(validPayload);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
      expect(mockSubmitDeliverableVersion).not.toHaveBeenCalled();
    });

    it("returns INVALID_TRANSITION when deliverable workflow is not production", async () => {
      mockGetOperatorDeliverableForSubmission.mockResolvedValue({
        ...validTarget,
        deliverableWorkflowType: "client_submission",
      });

      const result = await submitOperatorDeliverableVersionAction(validPayload);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INVALID_TRANSITION");
      }
      expect(mockSubmitDeliverableVersion).not.toHaveBeenCalled();
    });

    it("returns INVALID_TRANSITION when deliverable is already awaiting review or approved", async () => {
      mockGetOperatorDeliverableForSubmission.mockResolvedValue({
        ...validTarget,
        deliverableStatus: "awaiting_internal_review",
      });

      const result = await submitOperatorDeliverableVersionAction(validPayload);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INVALID_TRANSITION");
      }
      expect(mockSubmitDeliverableVersion).not.toHaveBeenCalled();
    });
  });

  describe("Command Execution & Revalidation", () => {
    it("submits version and revalidates concrete operator paths on success", async () => {
      mockGetOperatorDeliverableForSubmission.mockResolvedValue(validTarget);
      mockSubmitDeliverableVersion.mockResolvedValue({
        ok: true,
        data: {
          deliverable_id: validTarget.deliverableId,
          version_id: "v-new-1",
          version_number: 1,
        },
      });

      const result = await submitOperatorDeliverableVersionAction(validPayload);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.version_number).toBe(1);
      }

      expect(mockSubmitDeliverableVersion).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          deliverable_id: validPayload.deliverable_id,
          submission_url: validPayload.submission_url,
          submission_note: validPayload.submission_note,
        }),
      );

      expect(mockRevalidatePath).toHaveBeenCalledWith("/operador/agenda");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/en/operador/agenda");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/operador/proyectos");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/en/operador/proyectos");
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/operador/proyectos/${validTarget.projectId}`,
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/en/operador/proyectos/${validTarget.projectId}`,
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/operador/tareas/${validTarget.taskId}`,
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/en/operador/tareas/${validTarget.taskId}`,
      );
    });

    it("allows submission when status is changes_requested", async () => {
      mockGetOperatorDeliverableForSubmission.mockResolvedValue({
        ...validTarget,
        deliverableStatus: "changes_requested",
      });
      mockSubmitDeliverableVersion.mockResolvedValue({
        ok: true,
        data: {
          deliverable_id: validTarget.deliverableId,
          version_id: "v-new-2",
          version_number: 2,
        },
      });

      const result = await submitOperatorDeliverableVersionAction(validPayload);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.version_number).toBe(2);
      }
    });

    it("returns command error on conflict or invariant violation without revalidating", async () => {
      mockGetOperatorDeliverableForSubmission.mockResolvedValue(validTarget);
      mockSubmitDeliverableVersion.mockResolvedValue({
        ok: false,
        error: {
          code: "CONFLICT",
          message: "State changed concurrently",
        },
      });

      const result = await submitOperatorDeliverableVersionAction(validPayload);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("CONFLICT");
      }
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });
  });
});
