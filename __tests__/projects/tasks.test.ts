import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const { mockSupabase, mockSession, mockRpc } = vi.hoisted(() => {
  const mockInsert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: {
          id: "task-123",
          project_id: "00000000-0000-0000-0000-000000000001",
          title: "Test Task",
          description: "Task description",
          task_type: "internal_work",
          priority: "medium",
          status: "pending",
          deadline_at: "2026-11-30T12:00:00.000Z",
          assignee_id: "00000000-0000-0000-0000-000000000002",
          created_by: "00000000-0000-0000-0000-000000000003",
        },
        error: null,
      }),
    }),
  });

  const mockUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      is: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "task-123",
              title: "Updated Task Title",
              priority: "high",
            },
            error: null,
          }),
        }),
      }),
    }),
  });

  const mockRpc = vi.fn((proc: string) => {
    if (proc === "transition_task_status") {
      return Promise.resolve({
        data: {
          task_id: "00000000-0000-0000-0000-000000000004",
          old_status: "pending",
          new_status: "in_progress",
        },
        error: null,
      });
    }
    if (proc === "soft_delete_entity") {
      return Promise.resolve({ data: true, error: null });
    }
    if (proc === "create_collaboration_comment") {
      return Promise.resolve({
        data: {
          comment_id: "comment-123",
          project_id: "00000000-0000-0000-0000-000000000001",
          author_capacity: "pm_lead",
        },
        error: null,
      });
    }
    if (proc === "create_task_with_deliverables") {
      return Promise.resolve({
        data: {
          task: {
            id: "00000000-0000-0000-0000-000000000004",
            project_id: "00000000-0000-0000-0000-000000000001",
            title: "Bundle Task",
            description: "Task with deliverables",
            task_type: "internal_work",
            priority: "medium",
            status: "pending",
            deadline_at: "2026-11-30T12:00:00.000Z",
            assignee_id: "00000000-0000-0000-0000-000000000002",
            created_by: "00000000-0000-0000-0000-000000000003",
            created_at: "2026-08-27T12:00:00.000Z",
            updated_at: "2026-08-27T12:00:00.000Z",
            started_at: null,
            completed_at: null,
            deleted_at: null,
            updated_by: null,
            assigned_at: null,
            has_deliverables: true,
          },
          deliverable_ids: ["00000000-0000-0000-0000-000000000005"],
        },
        error: null,
      });
    }
    return Promise.resolve({ data: null, error: null });
  });

  const mockSelect = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: "comment-123",
                body: "First comment",
                created_at: "2026-08-19T12:00:00Z",
                author_capacity_snapshot: "pm_lead",
                profiles: {
                  id: "00000000-0000-0000-0000-000000000003",
                  full_name: "PM Tester",
                  avatar_url: null,
                  role: "pm",
                },
              },
            ],
            error: null,
          }),
        }),
      }),
    }),
  });

  const mockSupabase = {
    rpc: mockRpc,
    from: vi.fn((table: string) => {
      if (table === "tasks") {
        return {
          insert: mockInsert,
          update: mockUpdate,
        };
      }
      if (table === "collaboration_comments") {
        return {
          select: mockSelect,
        };
      }
      if (table === "project_members") {
        const chain: {
          eq: ReturnType<typeof vi.fn>;
          is: ReturnType<typeof vi.fn>;
          maybeSingle: ReturnType<typeof vi.fn>;
        } = {
          eq: vi.fn(() => chain),
          is: vi.fn(() => chain),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { member_type: "pm_lead" },
          }),
        };
        return {
          select: vi.fn(() => chain),
        };
      }
      return {};
    }),
  };

  const mockSession = {
    user: { id: "00000000-0000-0000-0000-000000000003", email: "pm@joya.test" },
    role: "pm",
    profile: {
      id: "00000000-0000-0000-0000-000000000003",
      full_name: "PM User",
      role: "pm",
    },
  };

  return {
    mockSupabase,
    mockSession,
    mockInsert,
    mockUpdate,
    mockRpc,
    mockSelect,
  };
});

vi.mock("@/config/app.config", () => ({
  publicConfig: {
    appUrl: "http://localhost:3000",
    supabaseUrl: "https://example.supabase.co",
    supabasePublishableKey: "sb_publishable_test_key",
  },
  serverConfig: {
    supabaseServiceRoleKey: "sb_secret_test_key",
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: vi.fn().mockReturnValue([]),
    setAll: vi.fn(),
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi
    .fn()
    .mockImplementation(() => Promise.resolve(mockSession)),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockReturnValue(mockSupabase),
}));

import {
  createTaskAction,
  createTaskWithDeliverablesAction,
  updateTaskAction,
  transitionTaskStatusAction,
  archiveTaskAction,
  createTaskCommentAction,
  listTaskCommentsAction,
} from "@/lib/projects/task-actions";

describe("Task Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.role = "pm";
  });

  describe("createTaskAction", () => {
    it("accepts valid internal_work task with all required fields", async () => {
      const result = await createTaskAction({
        project_id: "00000000-0000-0000-0000-000000000001",
        title: "Test Task",
        description: "Detailed description",
        task_type: "internal_work",
        priority: "medium",
        deadline_at: "2026-11-30T12:00:00.000Z",
        assignee_id: "00000000-0000-0000-0000-000000000002",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.title).toBe("Test Task");
      }
    });

    it("rejects unauthorized role actor (e.g. operator)", async () => {
      mockSession.role = "operator";
      const result = await createTaskAction({
        project_id: "00000000-0000-0000-0000-000000000001",
        title: "Unauthorized Task",
        description: "Details",
        task_type: "internal_work",
        priority: "medium",
        deadline_at: "2026-11-30T12:00:00.000Z",
        assignee_id: "00000000-0000-0000-0000-000000000002",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("UNAUTHORIZED");
      }
    });

    it("returns VALIDATION_FAILED when required fields are missing", async () => {
      const result = await createTaskAction({
        project_id: "00000000-0000-0000-0000-000000000001",
        title: "",
        description: "Details",
        task_type: "internal_work",
        priority: "medium",
        deadline_at: "2026-11-30T12:00:00.000Z",
        assignee_id: "00000000-0000-0000-0000-000000000002",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
      }
    });
  });

  describe("updateTaskAction", () => {
    it("accepts partial updates", async () => {
      const result = await updateTaskAction(
        "task-123",
        "00000000-0000-0000-0000-000000000001",
        {
          priority: "high",
        },
      );

      expect(result.ok).toBe(true);
    });

    it("rejects unauthorized role", async () => {
      mockSession.role = "client";
      const result = await updateTaskAction(
        "task-123",
        "00000000-0000-0000-0000-000000000001",
        {
          priority: "high",
        },
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("UNAUTHORIZED");
      }
    });
  });

  describe("transitionTaskStatusAction", () => {
    it("calls transition RPC and returns result", async () => {
      const result = await transitionTaskStatusAction(
        "00000000-0000-0000-0000-000000000004",
        "00000000-0000-0000-0000-000000000001",
        {
          task_id: "00000000-0000-0000-0000-000000000004",
          next_status: "in_progress",
        },
      );

      expect(result.ok).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith("transition_task_status", {
        p_task_id: "00000000-0000-0000-0000-000000000004",
        p_next_status: "in_progress",
        p_reopen_reason: undefined,
      });
    });

    it("rejects unauthorized role", async () => {
      mockSession.role = "operator";
      const result = await transitionTaskStatusAction(
        "00000000-0000-0000-0000-000000000004",
        "00000000-0000-0000-0000-000000000001",
        {
          task_id: "00000000-0000-0000-0000-000000000004",
          next_status: "in_progress",
        },
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("UNAUTHORIZED");
      }
    });
  });

  describe("archiveTaskAction", () => {
    it("archives task with optional reason", async () => {
      const result = await archiveTaskAction(
        "task-123",
        "00000000-0000-0000-0000-000000000001",
        "No longer needed",
      );

      expect(result.ok).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith("soft_delete_entity", {
        p_entity_id: "task-123",
        p_entity_type: "task",
        p_reason: "No longer needed",
      });
    });
  });

  describe("createTaskCommentAction", () => {
    it("allows PM to create task collaboration comment", async () => {
      const result = await createTaskCommentAction(
        "00000000-0000-0000-0000-000000000001",
        "00000000-0000-0000-0000-000000000004",
        "Great progress on this component!",
      );

      expect(result.ok).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith("create_collaboration_comment", {
        p_project_id: "00000000-0000-0000-0000-000000000001",
        p_target_type: "task",
        p_target_id: "00000000-0000-0000-0000-000000000004",
        p_body: "Great progress on this component!",
      });
    });

    it("rejects empty comment body with validation error", async () => {
      const result = await createTaskCommentAction(
        "00000000-0000-0000-0000-000000000001",
        "00000000-0000-0000-0000-000000000004",
        "   ",
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
      }
    });

    it("rejects unauthorized client role", async () => {
      mockSession.role = "client";
      const result = await createTaskCommentAction(
        "00000000-0000-0000-0000-000000000001",
        "00000000-0000-0000-0000-000000000004",
        "Client comment",
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("UNAUTHORIZED");
      }
    });
  });

  describe("listTaskCommentsAction", () => {
    it("returns list of task comments", async () => {
      const comments = await listTaskCommentsAction(
        "00000000-0000-0000-0000-000000000004",
      );
      expect(comments).toHaveLength(1);
      expect(comments[0]?.body).toBe("First comment");
    });
  });

  describe("createTaskWithDeliverablesAction", () => {
    it("creates bundled task with deliverables via RPC adapter", async () => {
      const result = await createTaskWithDeliverablesAction({
        project_id: "00000000-0000-0000-0000-000000000001",
        title: "Bundle Task",
        description: "Task with deliverables",
        task_type: "internal_work",
        priority: "medium",
        deadline_at: "2026-11-30T12:00:00.000Z",
        assignee_id: "00000000-0000-0000-0000-000000000002",
        deliverables: [
          {
            title: "Draft 1",
            specifications: "Specs 1",
            assignee_id: "00000000-0000-0000-0000-000000000002",
            internal_review_deadline_at: "2026-11-30T12:00:00.000Z",
          },
        ],
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.task.id).toBe(
          "00000000-0000-0000-0000-000000000004",
        );
        expect(result.data.deliverable_ids).toHaveLength(1);
      }
    });

    it("rejects unauthorized role actor", async () => {
      mockSession.role = "operator";
      const result = await createTaskWithDeliverablesAction({
        project_id: "00000000-0000-0000-0000-000000000001",
        title: "Bundle Task",
        description: "Task with deliverables",
        task_type: "internal_work",
        priority: "medium",
        deadline_at: "2026-11-30T12:00:00.000Z",
        assignee_id: "00000000-0000-0000-0000-000000000002",
        deliverables: [
          {
            title: "Draft 1",
            specifications: "Specs 1",
            assignee_id: "00000000-0000-0000-0000-000000000002",
            internal_review_deadline_at: "2026-11-30T12:00:00.000Z",
          },
        ],
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("UNAUTHORIZED");
      }
    });
  });
});
