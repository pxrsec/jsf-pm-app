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

const mockTransitionTaskStatus = vi.fn();
vi.mock("@/lib/projects/commands", () => ({
  transitionTaskStatus: (supabase: unknown, input: unknown) =>
    mockTransitionTaskStatus(supabase, input),
}));

const mockReviewDeliverable = vi.fn();
vi.mock("@/lib/deliverables/commands", () => ({
  reviewDeliverable: (supabase: unknown, input: unknown) =>
    mockReviewDeliverable(supabase, input),
}));

const mockGetClientRequestForTransition = vi.fn();
const mockGetClientProductionReviewForDecision = vi.fn();
vi.mock("@/lib/client/queries", () => ({
  getClientRequestForTransition: (supabase: unknown, id: string) =>
    mockGetClientRequestForTransition(supabase, id),
  getClientProductionReviewForDecision: (supabase: unknown, id: string) =>
    mockGetClientProductionReviewForDecision(supabase, id),
}));

import {
  startClientRequestAction,
  completeClientRequestAction,
  approveClientDeliverableAction,
  requestClientDeliverableChangesAction,
} from "@/lib/client/actions";
import { AuthError } from "@/lib/auth/session";

describe("Client Actions (src/lib/client/actions.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockResolvedValue({});
    mockRequireSession.mockResolvedValue({
      userId: "user-client-1",
      role: "client",
    });
    mockCreateClient.mockReturnValue({});
  });

  const validTaskId = "00000000-0000-0000-0000-000000000001";
  const validProjectId = "10000000-0000-0000-0000-000000000001";
  const validDeliverableId = "20000000-0000-0000-0000-000000000001";

  describe("startClientRequestAction", () => {
    it("rejects invalid input schema", async () => {
      const result = await startClientRequestAction({ task_id: "not-a-uuid" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
      }
    });

    it("enforces AuthError when session is missing", async () => {
      mockRequireSession.mockRejectedValueOnce(
        new AuthError("UNAUTHENTICATED", "Unauthenticated"),
      );
      await expect(
        startClientRequestAction({ task_id: validTaskId }),
      ).rejects.toThrow(AuthError);
    });

    it("returns UNAUTHORIZED for non-client role", async () => {
      mockRequireSession.mockResolvedValueOnce({
        userId: "user-pm-1",
        role: "pm",
      });
      const result = await startClientRequestAction({ task_id: validTaskId });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("UNAUTHORIZED");
      }
    });

    it("returns NOT_FOUND when target request does not exist or is not assigned to client", async () => {
      mockGetClientRequestForTransition.mockResolvedValueOnce(null);
      const result = await startClientRequestAction({ task_id: validTaskId });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });

    it("returns INVALID_TRANSITION if request is not in pending status", async () => {
      mockGetClientRequestForTransition.mockResolvedValueOnce({
        id: validTaskId,
        projectId: validProjectId,
        status: "in_progress",
        childSubmissionCount: 0,
      });

      const result = await startClientRequestAction({ task_id: validTaskId });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INVALID_TRANSITION");
      }
      expect(mockTransitionTaskStatus).not.toHaveBeenCalled();
    });

    it("invokes transitionTaskStatus with fixed next_status = in_progress and revalidates paths on success", async () => {
      mockGetClientRequestForTransition.mockResolvedValueOnce({
        id: validTaskId,
        projectId: validProjectId,
        status: "pending",
        childSubmissionCount: 0,
      });

      mockTransitionTaskStatus.mockResolvedValueOnce({
        ok: true,
        data: {
          task_id: validTaskId,
          old_status: "pending",
          new_status: "in_progress",
        },
      });

      const result = await startClientRequestAction({ task_id: validTaskId });
      expect(result.ok).toBe(true);
      expect(mockTransitionTaskStatus).toHaveBeenCalledWith(expect.anything(), {
        task_id: validTaskId,
        next_status: "in_progress",
      });

      expect(mockRevalidatePath).toHaveBeenCalledWith("/cliente/tareas");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/en/cliente/tareas");
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/cliente/tareas/${validTaskId}`,
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/cliente/proyectos/${validProjectId}`,
      );
    });
  });

  describe("completeClientRequestAction", () => {
    it("rejects invalid input schema", async () => {
      const result = await completeClientRequestAction({ task_id: "invalid" });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
      }
    });

    it("returns NOT_FOUND if target is missing", async () => {
      mockGetClientRequestForTransition.mockResolvedValueOnce(null);
      const result = await completeClientRequestAction({
        task_id: validTaskId,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });

    it("returns INVALID_TRANSITION if status is already completed or blocked", async () => {
      mockGetClientRequestForTransition.mockResolvedValueOnce({
        id: validTaskId,
        projectId: validProjectId,
        status: "completed",
        childSubmissionCount: 0,
      });

      const result = await completeClientRequestAction({
        task_id: validTaskId,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INVALID_TRANSITION");
      }
    });

    it("invokes transitionTaskStatus with fixed next_status = completed for in_progress request", async () => {
      mockGetClientRequestForTransition.mockResolvedValueOnce({
        id: validTaskId,
        projectId: validProjectId,
        status: "in_progress",
        childSubmissionCount: 0,
      });

      mockTransitionTaskStatus.mockResolvedValueOnce({
        ok: true,
        data: {
          task_id: validTaskId,
          old_status: "in_progress",
          new_status: "completed",
        },
      });

      const result = await completeClientRequestAction({
        task_id: validTaskId,
      });
      expect(result.ok).toBe(true);
      expect(mockTransitionTaskStatus).toHaveBeenCalledWith(expect.anything(), {
        task_id: validTaskId,
        next_status: "completed",
      });

      expect(mockRevalidatePath).toHaveBeenCalledWith("/cliente/tareas");
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/cliente/proyectos/${validProjectId}`,
      );
    });

    it("propagates INVARIANT_VIOLATION if command rejects completion due to pending child submissions", async () => {
      mockGetClientRequestForTransition.mockResolvedValueOnce({
        id: validTaskId,
        projectId: validProjectId,
        status: "in_progress",
        childSubmissionCount: 1,
      });

      mockTransitionTaskStatus.mockResolvedValueOnce({
        ok: false,
        error: {
          code: "INVARIANT_VIOLATION",
          message: "Active child submissions are not submitted",
        },
      });

      const result = await completeClientRequestAction({
        task_id: validTaskId,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INVARIANT_VIOLATION");
      }
    });
  });

  describe("approveClientDeliverableAction", () => {
    it("rejects invalid input schema", async () => {
      const result = await approveClientDeliverableAction({
        deliverable_id: "not-uuid",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
      }
    });

    it("returns NOT_FOUND if deliverable is not visible to client", async () => {
      mockGetClientProductionReviewForDecision.mockResolvedValueOnce(null);
      const result = await approveClientDeliverableAction({
        deliverable_id: validDeliverableId,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });

    it("returns INVALID_TRANSITION if deliverable is not in awaiting_client_review", async () => {
      mockGetClientProductionReviewForDecision.mockResolvedValueOnce({
        id: validDeliverableId,
        projectId: validProjectId,
        status: "approved",
        currentVersionNumber: 1,
      });

      const result = await approveClientDeliverableAction({
        deliverable_id: validDeliverableId,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INVALID_TRANSITION");
      }
    });

    it("invokes reviewDeliverable with stage = client and decision = approved", async () => {
      mockGetClientProductionReviewForDecision.mockResolvedValueOnce({
        id: validDeliverableId,
        projectId: validProjectId,
        status: "awaiting_client_review",
        currentVersionNumber: 1,
      });

      mockReviewDeliverable.mockResolvedValueOnce({
        ok: true,
        data: {
          deliverable_id: validDeliverableId,
          feedback_id: "fb-1",
          decision: "approved",
        },
      });

      const result = await approveClientDeliverableAction({
        deliverable_id: validDeliverableId,
      });
      expect(result.ok).toBe(true);
      expect(mockReviewDeliverable).toHaveBeenCalledWith(expect.anything(), {
        deliverable_id: validDeliverableId,
        stage: "client",
        decision: "approved",
      });

      expect(mockRevalidatePath).toHaveBeenCalledWith("/cliente/entregables");
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/cliente/entregables/${validDeliverableId}`,
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/cliente/proyectos/${validProjectId}`,
      );
    });
  });

  describe("requestClientDeliverableChangesAction", () => {
    it("rejects empty comment", async () => {
      const result = await requestClientDeliverableChangesAction({
        deliverable_id: validDeliverableId,
        comments: "   ",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
      }
    });

    it("rejects comment longer than 5000 characters", async () => {
      const result = await requestClientDeliverableChangesAction({
        deliverable_id: validDeliverableId,
        comments: "a".repeat(5001),
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
      }
    });

    it("invokes reviewDeliverable with stage = client and decision = changes_requested and comments", async () => {
      mockGetClientProductionReviewForDecision.mockResolvedValueOnce({
        id: validDeliverableId,
        projectId: validProjectId,
        status: "awaiting_client_review",
        currentVersionNumber: 1,
      });

      mockReviewDeliverable.mockResolvedValueOnce({
        ok: true,
        data: {
          deliverable_id: validDeliverableId,
          feedback_id: "fb-2",
          decision: "changes_requested",
        },
      });

      const result = await requestClientDeliverableChangesAction({
        deliverable_id: validDeliverableId,
        comments: "Please adjust audio levels at 1:30",
      });

      expect(result.ok).toBe(true);
      expect(mockReviewDeliverable).toHaveBeenCalledWith(expect.anything(), {
        deliverable_id: validDeliverableId,
        stage: "client",
        decision: "changes_requested",
        comments: "Please adjust audio levels at 1:30",
      });

      expect(mockRevalidatePath).toHaveBeenCalledWith("/cliente/entregables");
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/cliente/entregables/${validDeliverableId}`,
      );
    });
  });
});
