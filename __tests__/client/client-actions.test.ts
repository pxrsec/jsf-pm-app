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
const mockSubmitClientDeliverable = vi.fn();
const mockReviewDeliverable = vi.fn();
vi.mock("@/lib/projects/commands", () => ({
  transitionTaskStatus: (supabase: unknown, input: unknown) =>
    mockTransitionTaskStatus(supabase, input),
}));

vi.mock("@/lib/deliverables/commands", () => ({
  reviewDeliverable: (supabase: unknown, input: unknown) =>
    mockReviewDeliverable(supabase, input),
  submitClientDeliverable: (supabase: unknown, input: unknown) =>
    mockSubmitClientDeliverable(supabase, input),
}));

const mockGetClientRequestForTransition = vi.fn();
const mockGetClientProductionReviewForDecision = vi.fn();
const mockGetClientSubmissionForSubmission = vi.fn();
vi.mock("@/lib/client/queries", () => ({
  getClientRequestForTransition: (supabase: unknown, id: string) =>
    mockGetClientRequestForTransition(supabase, id),
  getClientProductionReviewForDecision: (supabase: unknown, id: string) =>
    mockGetClientProductionReviewForDecision(supabase, id),
  getClientSubmissionForSubmission: (supabase: unknown, id: string) =>
    mockGetClientSubmissionForSubmission(supabase, id),
}));

import {
  startClientRequestAction,
  completeClientRequestAction,
  approveClientDeliverableAction,
  requestClientDeliverableChangesAction,
  submitClientSubmissionAction,
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

    it("returns NOT_FOUND if request does not exist or is not assigned to client", async () => {
      mockGetClientRequestForTransition.mockResolvedValueOnce(null);
      const result = await startClientRequestAction({ task_id: validTaskId });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });

    it("returns INVALID_TRANSITION if request is not pending", async () => {
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
    });

    it("transitions task to in_progress and revalidates routes on success", async () => {
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
      const result = await completeClientRequestAction({
        task_id: "not-a-uuid",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
      }
    });

    it("returns INVALID_TRANSITION if request is already completed", async () => {
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

    it("transitions task to completed and revalidates paths on success", async () => {
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
        `/cliente/tareas/${validTaskId}`,
      );
    });
  });

  describe("approveClientDeliverableAction", () => {
    it("rejects invalid input schema", async () => {
      const result = await approveClientDeliverableAction({
        deliverable_id: "not-a-uuid",
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
      }
    });

    it("returns NOT_FOUND if deliverable is not found in client view", async () => {
      mockGetClientProductionReviewForDecision.mockResolvedValueOnce(null);
      const result = await approveClientDeliverableAction({
        deliverable_id: validDeliverableId,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
    });

    it("returns INVALID_TRANSITION if deliverable is not awaiting client review", async () => {
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
    });
  });

  describe("requestClientDeliverableChangesAction", () => {
    it("rejects empty comments", async () => {
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

  describe("submitClientSubmissionAction", () => {
    it("enforces AuthError when session is missing", async () => {
      mockRequireSession.mockRejectedValueOnce(
        new AuthError("UNAUTHENTICATED", "Unauthenticated"),
      );
      await expect(
        submitClientSubmissionAction({
          deliverable_id: validDeliverableId,
          submission_url: "https://drive.google.com/file/d/123",
        }),
      ).rejects.toThrow(AuthError);
    });

    it("returns UNAUTHORIZED for non-client role without lookup or RPC invocation", async () => {
      mockRequireSession.mockResolvedValueOnce({
        userId: "user-operator-1",
        role: "operator",
      });

      const result = await submitClientSubmissionAction({
        deliverable_id: validDeliverableId,
        submission_url: "https://drive.google.com/file/d/123",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("UNAUTHORIZED");
      }
      expect(mockGetClientSubmissionForSubmission).not.toHaveBeenCalled();
      expect(mockSubmitClientDeliverable).not.toHaveBeenCalled();
    });

    it("rejects invalid input envelope (invalid UUID)", async () => {
      const result = await submitClientSubmissionAction({
        deliverable_id: "not-a-uuid",
        submission_url: "https://drive.google.com/file/d/123",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
      }
      expect(mockGetClientSubmissionForSubmission).not.toHaveBeenCalled();
    });

    it("rejects forged non-string note input (number, object, boolean, array)", async () => {
      const resultWithNumber = await submitClientSubmissionAction({
        deliverable_id: validDeliverableId,
        submission_url: "https://drive.google.com/file/d/123",
        submission_note: 12345,
      });
      expect(resultWithNumber.ok).toBe(false);
      if (!resultWithNumber.ok) {
        expect(resultWithNumber.error.code).toBe("VALIDATION_FAILED");
      }

      const resultWithObject = await submitClientSubmissionAction({
        deliverable_id: validDeliverableId,
        submission_url: "https://drive.google.com/file/d/123",
        submission_note: { forged: true },
      });
      expect(resultWithObject.ok).toBe(false);
      if (!resultWithObject.ok) {
        expect(resultWithObject.error.code).toBe("VALIDATION_FAILED");
      }
    });

    it("rejects invalid raw URL at the boundary before target lookup", async () => {
      const result = await submitClientSubmissionAction({
        deliverable_id: validDeliverableId,
        submission_url: "http://insecure-http.example.com",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
      }
      expect(mockGetClientSubmissionForSubmission).not.toHaveBeenCalled();
    });

    it("accepts a raw note with 1001 characters that trims to <= 1000 characters", async () => {
      mockGetClientSubmissionForSubmission.mockResolvedValueOnce({
        id: validDeliverableId,
        taskId: validTaskId,
        projectId: validProjectId,
        status: "pending",
        currentVersionNumber: 0,
      });

      mockSubmitClientDeliverable.mockResolvedValueOnce({
        ok: true,
        data: {
          deliverableId: validDeliverableId,
          versionId: "ver-1",
          versionNumber: 1,
          provider: "google_drive",
          status: "submitted",
        },
      });

      const noteWithSpaces = "   " + "a".repeat(998) + "   "; // length 1004 raw, 998 trimmed
      const result = await submitClientSubmissionAction({
        deliverable_id: validDeliverableId,
        submission_url: "https://drive.google.com/file/d/123",
        submission_note: noteWithSpaces,
      });

      expect(result.ok).toBe(true);
      expect(mockSubmitClientDeliverable).toHaveBeenCalledWith(
        expect.anything(),
        {
          deliverable_id: validDeliverableId,
          submission_url: "https://drive.google.com/file/d/123",
          submission_note: "a".repeat(998),
        },
      );
    });

    it("rejects a note with > 1000 characters after trimming", async () => {
      const noteTooLong = "a".repeat(1001);
      const result = await submitClientSubmissionAction({
        deliverable_id: validDeliverableId,
        submission_url: "https://drive.google.com/file/d/123",
        submission_note: noteTooLong,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
      }
      expect(mockGetClientSubmissionForSubmission).not.toHaveBeenCalled();
    });

    it("normalizes empty string and whitespace-only note to null", async () => {
      mockGetClientSubmissionForSubmission.mockResolvedValueOnce({
        id: validDeliverableId,
        taskId: validTaskId,
        projectId: validProjectId,
        status: "pending",
        currentVersionNumber: 0,
      });

      mockSubmitClientDeliverable.mockResolvedValueOnce({
        ok: true,
        data: {
          deliverableId: validDeliverableId,
          versionId: "ver-1",
          versionNumber: 1,
          provider: "google_drive",
          status: "submitted",
        },
      });

      const result = await submitClientSubmissionAction({
        deliverable_id: validDeliverableId,
        submission_url: "https://drive.google.com/file/d/123",
        submission_note: "     ",
      });

      expect(result.ok).toBe(true);
      expect(mockSubmitClientDeliverable).toHaveBeenCalledWith(
        expect.anything(),
        {
          deliverable_id: validDeliverableId,
          submission_url: "https://drive.google.com/file/d/123",
          submission_note: null,
        },
      );
    });

    it("returns NOT_FOUND when target deliverable is absent or foreign", async () => {
      mockGetClientSubmissionForSubmission.mockResolvedValueOnce(null);

      const result = await submitClientSubmissionAction({
        deliverable_id: validDeliverableId,
        submission_url: "https://drive.google.com/file/d/123",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("NOT_FOUND");
      }
      expect(mockSubmitClientDeliverable).not.toHaveBeenCalled();
    });

    it("returns INVALID_TRANSITION when target deliverable is not pending", async () => {
      mockGetClientSubmissionForSubmission.mockResolvedValueOnce({
        id: validDeliverableId,
        taskId: validTaskId,
        projectId: validProjectId,
        status: "submitted",
        currentVersionNumber: 1,
      });

      const result = await submitClientSubmissionAction({
        deliverable_id: validDeliverableId,
        submission_url: "https://drive.google.com/file/d/123",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("INVALID_TRANSITION");
      }
      expect(mockSubmitClientDeliverable).not.toHaveBeenCalled();
    });

    it("successfully submits client deliverable and revalidates 4 route families in es and en", async () => {
      mockGetClientSubmissionForSubmission.mockResolvedValueOnce({
        id: validDeliverableId,
        taskId: validTaskId,
        projectId: validProjectId,
        status: "pending",
        currentVersionNumber: 0,
      });

      mockSubmitClientDeliverable.mockResolvedValueOnce({
        ok: true,
        data: {
          deliverableId: validDeliverableId,
          versionId: "ver-1",
          versionNumber: 1,
          provider: "google_drive",
          status: "submitted",
        },
      });

      const result = await submitClientSubmissionAction({
        deliverable_id: validDeliverableId,
        submission_url: "https://drive.google.com/file/d/123",
        submission_note: "Logo asset in high resolution",
      });

      expect(result.ok).toBe(true);
      expect(mockSubmitClientDeliverable).toHaveBeenCalledWith(
        expect.anything(),
        {
          deliverable_id: validDeliverableId,
          submission_url: "https://drive.google.com/file/d/123",
          submission_note: "Logo asset in high resolution",
        },
      );

      // Route revalidation assertions
      expect(mockRevalidatePath).toHaveBeenCalledWith("/cliente/tareas");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/en/cliente/tareas");
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/cliente/tareas/${validTaskId}`,
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/en/cliente/tareas/${validTaskId}`,
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith("/cliente/proyectos");
      expect(mockRevalidatePath).toHaveBeenCalledWith("/en/cliente/proyectos");
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/cliente/proyectos/${validProjectId}`,
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith(
        `/en/cliente/proyectos/${validProjectId}`,
      );
    });

    it("propagates mapped safe errors on command failure", async () => {
      mockGetClientSubmissionForSubmission.mockResolvedValueOnce({
        id: validDeliverableId,
        taskId: validTaskId,
        projectId: validProjectId,
        status: "pending",
        currentVersionNumber: 0,
      });

      mockSubmitClientDeliverable.mockResolvedValueOnce({
        ok: false,
        error: {
          code: "UNAUTHORIZED",
          message: "You do not have permission to perform this action.",
        },
      });

      const result = await submitClientSubmissionAction({
        deliverable_id: validDeliverableId,
        submission_url: "https://drive.google.com/file/d/123",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("UNAUTHORIZED");
      }
    });
  });
});
