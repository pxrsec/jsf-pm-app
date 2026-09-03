import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockCookies = vi.fn();
vi.mock("next/headers", () => ({
  cookies: () => mockCookies(),
}));

const mockRequireSession = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  requireSession: (cookieStore: unknown) => mockRequireSession(cookieStore),
}));

const mockSupabase = {
  from: vi.fn(),
};
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockSupabase,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { getManagerTaskDeliverableDetailAction } from "../actions";
import { getManagerTaskDeliverableDetail } from "../queries";

type MockQueryBuilder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};

function createMockBuilder(resolveValue: unknown): MockQueryBuilder {
  const builder: MockQueryBuilder = {
    select: vi.fn().mockImplementation(() => builder),
    eq: vi.fn().mockImplementation(() => builder),
    is: vi.fn().mockImplementation(() => builder),
    order: vi.fn().mockImplementation(() => builder),
    maybeSingle: vi.fn().mockResolvedValue(resolveValue),
  };
  return builder;
}

describe("getManagerTaskDeliverableDetailAction & scoped query security", () => {
  const validTaskId = "11111111-1111-4111-8111-111111111111";
  const validProjectId = "22222222-2222-4222-8222-222222222222";
  const validDeliverableId = "33333333-3333-4333-8333-333333333333";

  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockResolvedValue({});
    mockRequireSession.mockResolvedValue({
      user: { id: "user-pm-1" },
      role: "pm",
    });
  });

  describe("Input validation", () => {
    it("returns null before session or database check when taskId is not a UUID", async () => {
      const result = await getManagerTaskDeliverableDetailAction({
        taskId: "invalid-task-id",
        projectId: validProjectId,
        deliverableId: validDeliverableId,
      });
      expect(result).toBeNull();
      expect(mockRequireSession).not.toHaveBeenCalled();
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it("returns null before session or database check when projectId is not a UUID", async () => {
      const result = await getManagerTaskDeliverableDetailAction({
        taskId: validTaskId,
        projectId: "invalid-proj-id",
        deliverableId: validDeliverableId,
      });
      expect(result).toBeNull();
      expect(mockRequireSession).not.toHaveBeenCalled();
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it("returns null before session or database check when deliverableId is not a UUID", async () => {
      const result = await getManagerTaskDeliverableDetailAction({
        taskId: validTaskId,
        projectId: validProjectId,
        deliverableId: "invalid-deliv-id",
      });
      expect(result).toBeNull();
      expect(mockRequireSession).not.toHaveBeenCalled();
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });
  });

  describe("Role authorization", () => {
    it("returns null if session role is operator", async () => {
      mockRequireSession.mockResolvedValue({
        user: { id: "user-op-1" },
        role: "operator",
      });

      const result = await getManagerTaskDeliverableDetailAction({
        taskId: validTaskId,
        projectId: validProjectId,
        deliverableId: validDeliverableId,
      });
      expect(result).toBeNull();
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it("returns null if session role is client", async () => {
      mockRequireSession.mockResolvedValue({
        user: { id: "user-client-1" },
        role: "client",
      });

      const result = await getManagerTaskDeliverableDetailAction({
        taskId: validTaskId,
        projectId: validProjectId,
        deliverableId: validDeliverableId,
      });
      expect(result).toBeNull();
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });
  });

  describe("Scoped Query Boundary & Predicates (getManagerTaskDeliverableDetail)", () => {
    it("enforces exact id, task_id, project_id and active ancestry predicates on the root query", async () => {
      const delivBuilder = createMockBuilder({
        data: null,
        error: null,
      });
      mockSupabase.from.mockReturnValue(delivBuilder);

      const result = await getManagerTaskDeliverableDetail(
        mockSupabase as never,
        validDeliverableId,
        { taskId: validTaskId, projectId: validProjectId },
      );

      expect(result).toBeNull();
      expect(mockSupabase.from).toHaveBeenCalledWith("deliverables");
      expect(delivBuilder.eq).toHaveBeenCalledWith("id", validDeliverableId);
      expect(delivBuilder.eq).toHaveBeenCalledWith("task_id", validTaskId);
      expect(delivBuilder.eq).toHaveBeenCalledWith(
        "project_id",
        validProjectId,
      );
      expect(delivBuilder.is).toHaveBeenCalledWith("deleted_at", null);
      expect(delivBuilder.is).toHaveBeenCalledWith("archived_at", null);
      expect(delivBuilder.is).toHaveBeenCalledWith("tasks.deleted_at", null);
      expect(delivBuilder.is).toHaveBeenCalledWith("tasks.archived_at", null);
      expect(delivBuilder.is).toHaveBeenCalledWith(
        "tasks.projects.deleted_at",
        null,
      );
      expect(delivBuilder.is).toHaveBeenCalledWith(
        "tasks.projects.archived_at",
        null,
      );
    });

    it("returns null (fail-closed) when deliverable_versions query fails", async () => {
      const validDelivRow = {
        id: validDeliverableId,
        project_id: validProjectId,
        task_id: validTaskId,
        assignee_id: null,
        title: "Logo Pack",
        specifications: "Specs",
        workflow_type: "production",
        status: "pending",
        current_version_number: 1,
        is_stalled: false,
        submission_deadline_at: null,
        internal_review_deadline_at: null,
        client_delivery_deadline_at: null,
        approved_at: null,
        delivered_at: null,
        created_at: "2026-09-01T00:00:00Z",
        updated_at: "2026-09-01T00:00:00Z",
        profiles: null,
      };

      const delivBuilder = createMockBuilder({
        data: validDelivRow,
        error: null,
      });

      const verBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Version Query Failed" },
        }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "deliverables") return delivBuilder;
        if (table === "deliverable_versions") return verBuilder;
        return createMockBuilder({ data: [], error: null });
      });

      const result = await getManagerTaskDeliverableDetail(
        mockSupabase as never,
        validDeliverableId,
        { taskId: validTaskId, projectId: validProjectId },
      );

      // Must fail closed: return null, never fake empty versions
      expect(result).toBeNull();
    });

    it("returns null (fail-closed) when deliverable_feedback query fails", async () => {
      const validDelivRow = {
        id: validDeliverableId,
        project_id: validProjectId,
        task_id: validTaskId,
        assignee_id: null,
        title: "Logo Pack",
        specifications: "Specs",
        workflow_type: "production",
        status: "pending",
        current_version_number: 0,
        is_stalled: false,
        submission_deadline_at: null,
        internal_review_deadline_at: null,
        client_delivery_deadline_at: null,
        approved_at: null,
        delivered_at: null,
        created_at: "2026-09-01T00:00:00Z",
        updated_at: "2026-09-01T00:00:00Z",
        profiles: null,
      };

      const delivBuilder = createMockBuilder({
        data: validDelivRow,
        error: null,
      });

      const verBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      const fbBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Feedback Query Failed" },
        }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "deliverables") return delivBuilder;
        if (table === "deliverable_versions") return verBuilder;
        if (table === "deliverable_feedback") return fbBuilder;
        return createMockBuilder({ data: [], error: null });
      });

      const result = await getManagerTaskDeliverableDetail(
        mockSupabase as never,
        validDeliverableId,
        { taskId: validTaskId, projectId: validProjectId },
      );

      // Must fail closed: return null, never fake empty feedback
      expect(result).toBeNull();
    });

    it("returns valid detail with empty version and feedback arrays when queries genuinely return 0 rows", async () => {
      const validDelivRow = {
        id: validDeliverableId,
        project_id: validProjectId,
        task_id: validTaskId,
        assignee_id: null,
        title: "Logo Pack",
        specifications: "Specs",
        workflow_type: "production",
        status: "pending",
        current_version_number: 0,
        is_stalled: false,
        submission_deadline_at: null,
        internal_review_deadline_at: null,
        client_delivery_deadline_at: null,
        approved_at: null,
        delivered_at: null,
        created_at: "2026-09-01T00:00:00Z",
        updated_at: "2026-09-01T00:00:00Z",
        profiles: null,
      };

      const delivBuilder = createMockBuilder({
        data: validDelivRow,
        error: null,
      });

      const verBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      const fbBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "deliverables") return delivBuilder;
        if (table === "deliverable_versions") return verBuilder;
        if (table === "deliverable_feedback") return fbBuilder;
        return createMockBuilder({ data: [], error: null });
      });

      const result = await getManagerTaskDeliverableDetail(
        mockSupabase as never,
        validDeliverableId,
        { taskId: validTaskId, projectId: validProjectId },
      );

      expect(result).not.toBeNull();
      expect(result?.id).toBe(validDeliverableId);
      expect(result?.versions).toEqual([]);
      expect(result?.feedback).toEqual([]);
    });
  });
});
