import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getClientProjects,
  getClientProjectDetail,
  getClientRequestQueue,
  getClientRequestDetail,
  getClientProductionReviewQueue,
  getClientProductionReviewDetail,
  getClientRequestForTransition,
  getClientProductionReviewForDecision,
} from "@/lib/client/queries";

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
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
      expect(mockSupabase.from).toHaveBeenCalledWith("client_deliverable_view");
    });
  });

  describe("getClientRequestQueue", () => {
    it("returns sorted requests from client_task_view", async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockResolvedValue({
            data: [
              {
                id: validTaskId,
                project_id: validProjectId,
                project_name: "Project 1",
                title: "Task 1",
                description: "Desc",
                status: "pending",
                priority: "high",
                deadline_at: null,
                started_at: null,
                completed_at: null,
                child_submission_count: 1,
              },
            ],
            error: null,
          }),
        })),
      } as unknown as Parameters<typeof getClientRequestQueue>[0];

      const queue = await getClientRequestQueue(mockSupabase);
      expect(queue).toHaveLength(1);
      expect(queue[0].title).toBe("Task 1");
    });
  });

  describe("getClientProductionReviewQueue", () => {
    it("returns sorted reviews from client_deliverable_view", async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn().mockResolvedValue({
            data: [
              {
                id: validDeliverableId,
                project_id: validProjectId,
                project_name: "Project 1",
                title: "Review 1",
                specifications: "Specs",
                status: "awaiting_client_review",
                current_version_number: 1,
                current_submission_url: null,
                current_submission_provider: null,
                client_delivery_deadline_at: null,
                approved_at: null,
                delivered_at: null,
              },
            ],
            error: null,
          }),
        })),
      } as unknown as Parameters<typeof getClientProductionReviewQueue>[0];

      const queue = await getClientProductionReviewQueue(mockSupabase);
      expect(queue).toHaveLength(1);
      expect(queue[0].title).toBe("Review 1");
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
});
