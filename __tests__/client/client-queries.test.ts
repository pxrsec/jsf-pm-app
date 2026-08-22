import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getClientProjects,
  getClientProjectDetail,
  getClientRequestDetail,
  getClientProductionReviewDetail,
  getClientRequestForTransition,
  getClientProductionReviewForDecision,
  getClientSubmissionForSubmission,
} from "@/lib/client/queries";
import { sortClientProjects } from "@/lib/client/sort-helpers";

describe("Client Queries (src/lib/client/queries.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validProjectId = "00000000-0000-0000-0000-000000000001";
  const validTaskId = "00000000-0000-0000-0000-000000000010";
  const validDeliverableId = "00000000-0000-0000-0000-000000000100";

  describe("getClientProjects", () => {
    it("queries client_project_view with explicit projection and returns sorted list", async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockResolvedValue({
            data: [
              {
                id: validProjectId,
                name: "Brand Video",
                status: "in_progress",
                client_scope: "Public scope",
                deadline_at: "2026-09-01T00:00:00Z",
                last_deliverable_activity_at: "2026-08-20T10:00:00Z",
              },
            ],
            error: null,
          }),
        })),
      } as unknown as Parameters<typeof getClientProjects>[0];

      const result = await getClientProjects(mockSupabase);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(validProjectId);
      expect(mockSupabase.from).toHaveBeenCalledWith("client_project_view");
    });
  });

  describe("getClientProjectDetail", () => {
    it("returns null on non-UUID project ID", async () => {
      const mockSupabase = {} as unknown as Parameters<
        typeof getClientProjectDetail
      >[0];
      const result = await getClientProjectDetail(mockSupabase, "invalid-uuid");
      expect(result).toBeNull();
    });

    it("isolates child submissions to only direct tasks assigned to client", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "client_project_view") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: validProjectId,
                  name: "Brand Campaign",
                  status: "in_progress",
                  client_scope: "Public scope",
                  deadline_at: "2026-09-01T00:00:00Z",
                  last_deliverable_activity_at: null,
                },
                error: null,
              }),
            };
          }
          if (table === "client_task_view") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: validTaskId,
                    project_id: validProjectId,
                    title: "Client Request",
                    status: "pending",
                    priority: "medium",
                    child_submission_count: 1,
                  },
                ],
                error: null,
              }),
            };
          }
          if (table === "client_submission_view") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "00000000-0000-0000-0000-000000000101",
                    task_id: validTaskId, // Direct task
                    project_id: validProjectId,
                    title: "Client Asset",
                    status: "pending",
                  },
                  {
                    id: "00000000-0000-0000-0000-000000000102",
                    task_id: "00000000-0000-0000-0000-000000000099", // Foreign task
                    project_id: validProjectId,
                    title: "Foreign Asset",
                    status: "pending",
                  },
                ],
                error: null,
              }),
            };
          }
          if (table === "client_deliverable_view") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: validDeliverableId,
                    project_id: validProjectId,
                    title: "Released Video",
                    status: "awaiting_client_review",
                    current_version_number: 1,
                  },
                ],
                error: null,
              }),
            };
          }
          return { select: vi.fn().mockReturnThis() };
        }),
      } as unknown as Parameters<typeof getClientProjectDetail>[0];

      const detail = await getClientProjectDetail(mockSupabase, validProjectId);
      expect(detail).not.toBeNull();
      expect(detail?.directRequests).toHaveLength(1);
      expect(detail?.directSubmissions).toHaveLength(1);
      expect(detail?.directSubmissions[0].id).toBe(
        "00000000-0000-0000-0000-000000000101",
      );
      expect(detail?.releasedProductionReviews).toHaveLength(1);
    });
  });

  describe("getClientRequestDetail", () => {
    it("returns null on non-UUID task ID", async () => {
      const mockSupabase = {} as unknown as Parameters<
        typeof getClientRequestDetail
      >[0];
      const result = await getClientRequestDetail(mockSupabase, "not-a-uuid");
      expect(result).toBeNull();
    });

    it("evaluates readiness summary and parses resources safely", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "client_task_view") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: validTaskId,
                  project_id: validProjectId,
                  project_name: "Project 1",
                  title: "Task with resources",
                  description: "Desc",
                  status: "pending",
                  priority: "high",
                  resources: [
                    {
                      name: "Guidelines",
                      url: "https://example.com/doc",
                      type: "document",
                    },
                  ],
                },
                error: null,
              }),
            };
          }
          if (table === "client_submission_view") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "00000000-0000-0000-0000-000000000101",
                    task_id: validTaskId,
                    project_id: validProjectId,
                    title: "Required Image",
                    status: "pending",
                    correction_history: [],
                  },
                ],
                error: null,
              }),
            };
          }
          return { select: vi.fn().mockReturnThis() };
        }),
      } as unknown as Parameters<typeof getClientRequestDetail>[0];

      const detail = await getClientRequestDetail(mockSupabase, validTaskId);
      expect(detail).not.toBeNull();
      expect(detail?.resources).toHaveLength(1);
      expect(detail?.resources[0].name).toBe("Guidelines");
      expect(detail?.readinessSummary.status).toBe("pending_submissions");
      expect(detail?.readinessSummary.pendingCount).toBe(1);
      expect(detail?.childSubmissions[0].correctionHistory).toEqual([]);
      expect(detail?.childSubmissions[0].correctionHistoryError).toBe(false);
    });

    it("parses valid correction history entries with versions and reopen events", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "client_task_view") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: validTaskId,
                  project_id: validProjectId,
                  project_name: "Project 1",
                  title: "Task with correction history",
                  status: "pending",
                  priority: "medium",
                },
                error: null,
              }),
            };
          }
          if (table === "client_submission_view") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "00000000-0000-0000-0000-000000000101",
                    task_id: validTaskId,
                    project_id: validProjectId,
                    title: "Logo asset",
                    status: "pending",
                    current_version_number: 1,
                    correction_history: [
                      {
                        kind: "version",
                        version_number: 1,
                        submission_url: "https://drive.google.com/file/d/123",
                        submission_provider: "google_drive",
                        submission_note: "First version",
                        submitted_at: "2026-08-20T10:00:00Z",
                      },
                      {
                        kind: "reopened",
                        reopened_at: "2026-08-21T12:00:00Z",
                        reason: "Need higher resolution SVG",
                      },
                    ],
                  },
                ],
                error: null,
              }),
            };
          }
          return { select: vi.fn().mockReturnThis() };
        }),
      } as unknown as Parameters<typeof getClientRequestDetail>[0];

      const detail = await getClientRequestDetail(mockSupabase, validTaskId);
      expect(detail).not.toBeNull();
      const sub = detail?.childSubmissions[0];
      expect(sub?.correctionHistory).toHaveLength(2);
      expect(sub?.correctionHistory[0]).toEqual({
        kind: "version",
        versionNumber: 1,
        submissionUrl: "https://drive.google.com/file/d/123",
        provider: "google_drive",
        note: "First version",
        submittedAt: "2026-08-20T10:00:00Z",
      });
      expect(sub?.correctionHistory[1]).toEqual({
        kind: "reopened",
        reopenedAt: "2026-08-21T12:00:00Z",
        reason: "Need higher resolution SVG",
      });
      expect(sub?.correctionHistoryError).toBe(false);
    });

    it("safely handles malformed correction history with correctionHistoryError = true and no base table queries", async () => {
      const mockSupabase = {
        from: vi.fn((table: string) => {
          if (table === "client_task_view") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: validTaskId,
                  project_id: validProjectId,
                  title: "Task with malformed history",
                  status: "pending",
                },
                error: null,
              }),
            };
          }
          if (table === "client_submission_view") {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "00000000-0000-0000-0000-000000000101",
                    task_id: validTaskId,
                    project_id: validProjectId,
                    title: "Asset",
                    status: "pending",
                    correction_history: {
                      unexpected: "object_instead_of_array",
                    },
                  },
                ],
                error: null,
              }),
            };
          }
          return { select: vi.fn().mockReturnThis() };
        }),
      } as unknown as Parameters<typeof getClientRequestDetail>[0];

      const detail = await getClientRequestDetail(mockSupabase, validTaskId);
      expect(detail).not.toBeNull();
      const sub = detail?.childSubmissions[0];
      expect(sub?.correctionHistory).toEqual([]);
      expect(sub?.correctionHistoryError).toBe(true);
      // Ensure only client_task_view and client_submission_view were queried
      expect(mockSupabase.from).toHaveBeenCalledWith("client_task_view");
      expect(mockSupabase.from).toHaveBeenCalledWith("client_submission_view");
      expect(mockSupabase.from).not.toHaveBeenCalledWith(
        "deliverable_versions",
      );
      expect(mockSupabase.from).not.toHaveBeenCalledWith("audit_logs");
    });
  });

  describe("getClientProductionReviewDetail", () => {
    it("returns null on non-UUID deliverable ID", async () => {
      const mockSupabase = {} as unknown as Parameters<
        typeof getClientProductionReviewDetail
      >[0];
      const result = await getClientProductionReviewDetail(
        mockSupabase,
        "not-uuid",
      );
      expect(result).toBeNull();
    });

    it("parses client feedback history without querying base tables", async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: validDeliverableId,
              project_id: validProjectId,
              project_name: "Project 1",
              title: "Review Cut",
              specifications: "Specs",
              status: "awaiting_client_review",
              current_version_number: 1,
              current_submission_url: "https://drive.google.com/file/d/123",
              current_submission_provider: "google_drive",
              client_feedback_history: [
                {
                  id: "fb-1",
                  version_id: "ver-1",
                  decision: "changes_requested",
                  comments: "Fix lighting",
                  reviewed_at: "2026-08-20T10:00:00Z",
                },
              ],
            },
            error: null,
          }),
        })),
      } as unknown as Parameters<typeof getClientProductionReviewDetail>[0];

      const detail = await getClientProductionReviewDetail(
        mockSupabase,
        validDeliverableId,
      );
      expect(detail).not.toBeNull();
      expect(detail?.feedbackResult.ok).toBe(true);
      if (detail?.feedbackResult.ok) {
        expect(detail.feedbackResult.items).toHaveLength(1);
        expect(detail.feedbackResult.items[0].decision).toBe(
          "changes_requested",
        );
      }
    });
  });

  describe("getClientRequestForTransition", () => {
    it("returns transition target for valid task", async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: validTaskId,
              project_id: validProjectId,
              status: "pending",
              child_submission_count: 0,
            },
            error: null,
          }),
        })),
      } as unknown as Parameters<typeof getClientRequestForTransition>[0];

      const target = await getClientRequestForTransition(
        mockSupabase,
        validTaskId,
      );
      expect(target).not.toBeNull();
      expect(target?.status).toBe("pending");
    });
  });

  describe("getClientSubmissionForSubmission", () => {
    it("returns null on invalid UUID", async () => {
      const mockSupabase = {} as unknown as Parameters<
        typeof getClientSubmissionForSubmission
      >[0];
      const result = await getClientSubmissionForSubmission(
        mockSupabase,
        "invalid-uuid",
      );
      expect(result).toBeNull();
    });

    it("returns null when deliverable is absent or not visible", async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        })),
      } as unknown as Parameters<typeof getClientSubmissionForSubmission>[0];

      const result = await getClientSubmissionForSubmission(
        mockSupabase,
        validDeliverableId,
      );
      expect(result).toBeNull();
    });

    it("returns ClientSubmissionTarget for valid visible direct submission", async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: validDeliverableId,
              task_id: validTaskId,
              project_id: validProjectId,
              status: "pending",
              current_version_number: 0,
            },
            error: null,
          }),
        })),
      } as unknown as Parameters<typeof getClientSubmissionForSubmission>[0];

      const target = await getClientSubmissionForSubmission(
        mockSupabase,
        validDeliverableId,
      );
      expect(target).toEqual({
        id: validDeliverableId,
        taskId: validTaskId,
        projectId: validProjectId,
        status: "pending",
        currentVersionNumber: 0,
      });
      expect(mockSupabase.from).toHaveBeenCalledWith("client_submission_view");
    });
  });

  describe("getClientProductionReviewForDecision", () => {
    it("returns decision target for valid deliverable", async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: validDeliverableId,
              project_id: validProjectId,
              status: "awaiting_client_review",
              current_version_number: 1,
            },
            error: null,
          }),
        })),
      } as unknown as Parameters<
        typeof getClientProductionReviewForDecision
      >[0];

      const target = await getClientProductionReviewForDecision(
        mockSupabase,
        validDeliverableId,
      );
      expect(target).not.toBeNull();
      expect(target?.currentVersionNumber).toBe(1);
    });
  });

  describe("Sort Helpers (src/lib/client/sort-helpers.ts)", () => {
    it("sorts projects by status priority, deadline, and name", () => {
      const sorted = sortClientProjects([
        {
          id: "p2",
          name: "B Project",
          status: "planning",
          client_scope: null,
          deadline_at: "2026-09-01T00:00:00Z",
          last_deliverable_activity_at: null,
        },
        {
          id: "p1",
          name: "A Project",
          status: "in_progress",
          client_scope: null,
          deadline_at: "2026-09-01T00:00:00Z",
          last_deliverable_activity_at: null,
        },
      ]);
      expect(sorted[0].id).toBe("p1");
      expect(sorted[1].id).toBe("p2");
    });
  });
});
