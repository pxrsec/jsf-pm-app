import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getManagerTaskDetail,
  getProjectMembershipCapacity,
} from "../manager-task-queries";

type MockQueryBuilder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: (
    onfulfilled?: (value: unknown) => unknown,
    onrejected?: (reason: unknown) => unknown,
  ) => Promise<unknown>;
};

describe("manager-task-queries", () => {
  const validTaskId = "11111111-1111-4111-8111-111111111111";
  const validProjectId = "22222222-2222-4222-8222-222222222222";
  const validUserId = "33333333-3333-4333-8333-333333333333";

  let mockSupabase: { from: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockSupabase = {
      from: vi.fn(),
    };
  });

  function createMockBuilder(resolveValue: unknown): MockQueryBuilder {
    const builder: MockQueryBuilder = {
      select: vi.fn().mockImplementation(() => builder),
      eq: vi.fn().mockImplementation(() => builder),
      is: vi.fn().mockImplementation(() => builder),
      order: vi.fn().mockImplementation(() => builder),
      maybeSingle: vi.fn().mockResolvedValue(resolveValue),
      then: (resolve, reject) =>
        Promise.resolve(resolveValue).then(resolve, reject),
    };
    return builder;
  }

  describe("getManagerTaskDetail", () => {
    it("returns null immediately for invalid UUID syntax without querying database", async () => {
      const invalidTaskId = "invalid-uuid";
      const result = await getManagerTaskDetail(
        mockSupabase as never,
        invalidTaskId,
      );
      expect(result).toBeNull();
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it("enforces active ancestry and fail-closed behavior when task query fails", async () => {
      const taskQueryBuilder = createMockBuilder({
        data: null,
        error: { message: "DB Error" },
      });
      mockSupabase.from.mockReturnValue(taskQueryBuilder);

      const result = await getManagerTaskDetail(
        mockSupabase as never,
        validTaskId,
      );
      expect(result).toBeNull();
      expect(mockSupabase.from).toHaveBeenCalledWith("tasks");
      expect(taskQueryBuilder.eq).toHaveBeenCalledWith("id", validTaskId);
      expect(taskQueryBuilder.is).toHaveBeenCalledWith("deleted_at", null);
      expect(taskQueryBuilder.is).toHaveBeenCalledWith("archived_at", null);
      expect(taskQueryBuilder.is).toHaveBeenCalledWith(
        "projects.deleted_at",
        null,
      );
      expect(taskQueryBuilder.is).toHaveBeenCalledWith(
        "projects.archived_at",
        null,
      );
    });

    it("returns null (fail-closed) when task_resources query fails instead of fake empty array", async () => {
      const validTaskRow = {
        id: validTaskId,
        project_id: validProjectId,
        title: "Task 1",
        description: "Desc",
        task_type: "production",
        status: "in_progress",
        priority: "high",
        deadline_at: "2026-09-10T12:00:00Z",
        started_at: "2026-09-01T12:00:00Z",
        completed_at: null,
        assigned_at: "2026-09-01T10:00:00Z",
        projects: { id: validProjectId, name: "Project Alpha" },
        profiles: {
          id: validUserId,
          full_name: "John Doe",
          role: "operator",
          avatar_url: null,
        },
      };

      const taskBuilder = createMockBuilder({
        data: validTaskRow,
        error: null,
      });
      const resourcesBuilder = createMockBuilder({
        data: null,
        error: { message: "Resource Query Failed" },
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "tasks") return taskBuilder;
        if (table === "task_resources") return resourcesBuilder;
        return createMockBuilder({ data: [], error: null });
      });

      const result = await getManagerTaskDetail(
        mockSupabase as never,
        validTaskId,
      );
      expect(result).toBeNull();
    });

    it("returns null (fail-closed) when deliverables query fails instead of fake empty array", async () => {
      const validTaskRow = {
        id: validTaskId,
        project_id: validProjectId,
        title: "Task 1",
        description: "Desc",
        task_type: "production",
        status: "in_progress",
        priority: "high",
        deadline_at: "2026-09-10T12:00:00Z",
        started_at: null,
        completed_at: null,
        assigned_at: null,
        projects: { id: validProjectId, name: "Project Alpha" },
        profiles: null,
      };

      const taskBuilder = createMockBuilder({
        data: validTaskRow,
        error: null,
      });
      const resourcesBuilder = createMockBuilder({ data: [], error: null });
      const deliverablesBuilder = createMockBuilder({
        data: null,
        error: { message: "Deliverables Query Error" },
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "tasks") return taskBuilder;
        if (table === "task_resources") return resourcesBuilder;
        if (table === "deliverables") return deliverablesBuilder;
        return createMockBuilder({ data: [], error: null });
      });

      const result = await getManagerTaskDetail(
        mockSupabase as never,
        validTaskId,
      );
      expect(result).toBeNull();
    });

    it("returns truthful empty arrays when resources and deliverables genuine query returns 0 rows", async () => {
      const validTaskRow = {
        id: validTaskId,
        project_id: validProjectId,
        title: "Task 1",
        description: null,
        task_type: "production",
        status: "todo",
        priority: "medium",
        deadline_at: null,
        started_at: null,
        completed_at: null,
        assigned_at: null,
        projects: { id: validProjectId, name: "Project Alpha" },
        profiles: null,
      };

      const taskBuilder = createMockBuilder({
        data: validTaskRow,
        error: null,
      });
      const resourcesBuilder = createMockBuilder({ data: [], error: null });
      const deliverablesBuilder = createMockBuilder({ data: [], error: null });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "tasks") return taskBuilder;
        if (table === "task_resources") return resourcesBuilder;
        if (table === "deliverables") return deliverablesBuilder;
        return createMockBuilder({ data: [], error: null });
      });

      const result = await getManagerTaskDetail(
        mockSupabase as never,
        validTaskId,
      );
      expect(result).not.toBeNull();
      expect(result?.resources).toEqual([]);
      expect(result?.deliverables).toEqual([]);
      expect(result?.title).toBe("Task 1");
      expect(result?.projectName).toBe("Project Alpha");
    });
  });

  describe("getProjectMembershipCapacity", () => {
    it("returns pm_lead for active pm_lead membership", async () => {
      const builder = createMockBuilder({
        data: { member_type: "pm_lead" },
        error: null,
      });
      mockSupabase.from.mockReturnValue(builder);

      const capacity = await getProjectMembershipCapacity(
        mockSupabase as never,
        validProjectId,
        validUserId,
      );
      expect(capacity).toBe("pm_lead");
    });

    it("returns pm_watcher for active pm_watcher membership", async () => {
      const builder = createMockBuilder({
        data: { member_type: "pm_watcher" },
        error: null,
      });
      mockSupabase.from.mockReturnValue(builder);

      const capacity = await getProjectMembershipCapacity(
        mockSupabase as never,
        validProjectId,
        validUserId,
      );
      expect(capacity).toBe("pm_watcher");
    });

    it("defaults to pm_watcher (least privilege, NOT pm_lead) when no membership row exists", async () => {
      const builder = createMockBuilder({
        data: null,
        error: null,
      });
      mockSupabase.from.mockReturnValue(builder);

      const capacity = await getProjectMembershipCapacity(
        mockSupabase as never,
        validProjectId,
        validUserId,
      );
      expect(capacity).toBe("pm_watcher");
    });

    it("defaults to pm_watcher on query error or unexpected value", async () => {
      const builder = createMockBuilder({
        data: null,
        error: { message: "Connection lost" },
      });
      mockSupabase.from.mockReturnValue(builder);

      const capacity = await getProjectMembershipCapacity(
        mockSupabase as never,
        validProjectId,
        validUserId,
      );
      expect(capacity).toBe("pm_watcher");
    });
  });
});
