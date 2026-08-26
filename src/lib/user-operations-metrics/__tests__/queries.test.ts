import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { fetchScopedUserOperationsMetrics } from "../queries";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function createMockSupabase(): {
  client: SupabaseClient<Database>;
  mockRpc: ReturnType<typeof vi.fn>;
} {
  const mockRpc = vi.fn();
  return {
    client: { rpc: mockRpc } as unknown as SupabaseClient<Database>,
    mockRpc,
  };
}

describe("User Operations Metrics Adapter (queries.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validFrom = "2026-05-26T00:00:00-06:00";
  const validTo = "2026-08-24T00:00:00-06:00";
  const validProjectId = "a0000000-0000-0000-0000-000000000001";
  const validUserId = "b0000000-0000-0000-0000-000000000002";

  const validRow = {
    user_id: validUserId,
    full_name: "Juan Perez",
    application_role: "operator",
    is_active: true,
    current_active_task_count: 3,
    task_assigned_count: 5,
    task_started_count: 4,
    task_completed_count: 3,
    average_assignment_to_start_hours: 12.5,
    unstarted_task_count_at_range_end: 1,
    production_deliverable_submission_count: 2,
    client_submission_count: 1,
    deliverable_review_count: 0,
    deliverable_delivered_count: 1,
    in_app_notification_received_count: 8,
    in_app_notification_read_count: 7,
    in_app_notification_unread_count_at_range_end: 1,
    in_app_notification_unread_over_24h_count_at_range_end: 0,
    average_in_app_notification_read_hours: 1.2,
    last_workflow_action_at: "2026-08-20T14:30:00-06:00",
    range_from: validFrom,
    range_to: validTo,
  };

  describe("1. Role Authorization Boundaries", () => {
    it("denies operator role with UNAVAILABLE and never invokes RPC", async () => {
      const { client, mockRpc } = createMockSupabase();
      const result = await fetchScopedUserOperationsMetrics(
        client,
        { from: validFrom, to: validTo },
        "operator",
      );
      expect(result).toEqual({ status: "unavailable", code: "UNAVAILABLE" });
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("denies client role with UNAVAILABLE and never invokes RPC", async () => {
      const { client, mockRpc } = createMockSupabase();
      const result = await fetchScopedUserOperationsMetrics(
        client,
        { from: validFrom, to: validTo },
        "client",
      );
      expect(result).toEqual({ status: "unavailable", code: "UNAVAILABLE" });
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("denies unknown or cast roles and never invokes RPC", async () => {
      const { client, mockRpc } = createMockSupabase();
      const result = await fetchScopedUserOperationsMetrics(
        client,
        { from: validFrom, to: validTo },
        "superadmin" as unknown as "admin",
      );
      expect(result).toEqual({ status: "unavailable", code: "UNAVAILABLE" });
      expect(mockRpc).not.toHaveBeenCalled();
    });
  });

  describe("2. RPC Argument Construction", () => {
    it("Admin global call passes p_project_id = undefined and p_user_id = undefined", async () => {
      const { client, mockRpc } = createMockSupabase();
      mockRpc.mockResolvedValue({ data: [validRow], error: null });

      const result = await fetchScopedUserOperationsMetrics(
        client,
        { from: validFrom, to: validTo },
        "admin",
      );

      expect(result.status).toBe("available");
      expect(mockRpc).toHaveBeenCalledWith(
        "list_scoped_user_operations_metrics",
        {
          p_project_id: undefined,
          p_user_id: undefined,
          p_from: validFrom,
          p_to: validTo,
        },
      );
    });

    it("Admin with project filter passes p_project_id and p_user_id = undefined", async () => {
      const { client, mockRpc } = createMockSupabase();
      mockRpc.mockResolvedValue({ data: [validRow], error: null });

      const result = await fetchScopedUserOperationsMetrics(
        client,
        { from: validFrom, to: validTo, projectId: validProjectId },
        "admin",
      );

      expect(result.status).toBe("available");
      expect(mockRpc).toHaveBeenCalledWith(
        "list_scoped_user_operations_metrics",
        {
          p_project_id: validProjectId,
          p_user_id: undefined,
          p_from: validFrom,
          p_to: validTo,
        },
      );
    });

    it("PM call requires and passes p_project_id", async () => {
      const { client, mockRpc } = createMockSupabase();
      mockRpc.mockResolvedValue({ data: [validRow], error: null });

      const result = await fetchScopedUserOperationsMetrics(
        client,
        { from: validFrom, to: validTo, projectId: validProjectId },
        "pm",
      );

      expect(result.status).toBe("available");
      expect(mockRpc).toHaveBeenCalledWith(
        "list_scoped_user_operations_metrics",
        {
          p_project_id: validProjectId,
          p_user_id: undefined,
          p_from: validFrom,
          p_to: validTo,
        },
      );
    });

    it("PM call without projectId fails closed before RPC", async () => {
      const { client, mockRpc } = createMockSupabase();

      const result = await fetchScopedUserOperationsMetrics(
        client,
        { from: validFrom, to: validTo },
        "pm",
      );

      expect(result).toEqual({ status: "unavailable", code: "UNAVAILABLE" });
      expect(mockRpc).not.toHaveBeenCalled();
    });
  });

  describe("3. Fail-Closed Runtime Row Validation", () => {
    it("maps valid returned row to safe DTO", async () => {
      const { client, mockRpc } = createMockSupabase();
      mockRpc.mockResolvedValue({ data: [validRow], error: null });

      const result = await fetchScopedUserOperationsMetrics(
        client,
        { from: validFrom, to: validTo },
        "admin",
      );

      expect(result.status).toBe("available");
      if (result.status === "available") {
        expect(result.data).toHaveLength(1);
        const dto = result.data[0];
        expect(dto.userId).toBe(validUserId);
        expect(dto.fullName).toBe("Juan Perez");
        expect(dto.applicationRole).toBe("operator");
        expect(dto.isActive).toBe(true);
        expect(dto.currentActiveTaskCount).toBe(3);
        expect(dto.averageAssignmentToStartHours).toBe(12.5);
        expect(dto.lastWorkflowActionAt).toBe("2026-08-20T14:30:00-06:00");
      }
    });

    it("preserves null averages and null lastWorkflowActionAt without coercing to zero", async () => {
      const { client, mockRpc } = createMockSupabase();
      const rowWithNulls = {
        ...validRow,
        average_assignment_to_start_hours: null,
        average_in_app_notification_read_hours: null,
        last_workflow_action_at: null,
      };
      mockRpc.mockResolvedValue({ data: [rowWithNulls], error: null });

      const result = await fetchScopedUserOperationsMetrics(
        client,
        { from: validFrom, to: validTo },
        "admin",
      );

      expect(result.status).toBe("available");
      if (result.status === "available") {
        expect(result.data[0].averageAssignmentToStartHours).toBeNull();
        expect(result.data[0].averageInAppNotificationReadHours).toBeNull();
        expect(result.data[0].lastWorkflowActionAt).toBeNull();
      }
    });

    it("fails closed when row has unknown role (e.g. pm_lead / pm_watcher)", async () => {
      const { client, mockRpc } = createMockSupabase();
      const invalidRow = { ...validRow, application_role: "pm_lead" };
      mockRpc.mockResolvedValue({ data: [invalidRow], error: null });

      const result = await fetchScopedUserOperationsMetrics(
        client,
        { from: validFrom, to: validTo },
        "admin",
      );
      expect(result).toEqual({ status: "unavailable", code: "UNAVAILABLE" });
    });

    it("fails closed when count is negative", async () => {
      const { client, mockRpc } = createMockSupabase();
      const invalidRow = { ...validRow, task_completed_count: -1 };
      mockRpc.mockResolvedValue({ data: [invalidRow], error: null });

      const result = await fetchScopedUserOperationsMetrics(
        client,
        { from: validFrom, to: validTo },
        "admin",
      );
      expect(result).toEqual({ status: "unavailable", code: "UNAVAILABLE" });
    });

    it("fails closed when average is not a finite number", async () => {
      const { client, mockRpc } = createMockSupabase();
      const invalidRow = {
        ...validRow,
        average_assignment_to_start_hours: "not-a-number",
      };
      mockRpc.mockResolvedValue({ data: [invalidRow], error: null });

      const result = await fetchScopedUserOperationsMetrics(
        client,
        { from: validFrom, to: validTo },
        "admin",
      );
      expect(result).toEqual({ status: "unavailable", code: "UNAVAILABLE" });
    });

    it("fails closed when returned range bounds mismatch requested query instants", async () => {
      const { client, mockRpc } = createMockSupabase();
      const invalidRow = {
        ...validRow,
        range_from: "2026-01-01T00:00:00-06:00",
      };
      mockRpc.mockResolvedValue({ data: [invalidRow], error: null });

      const result = await fetchScopedUserOperationsMetrics(
        client,
        { from: validFrom, to: validTo },
        "admin",
      );
      expect(result).toEqual({ status: "unavailable", code: "UNAVAILABLE" });
    });

    it("fails closed on RPC error without throwing", async () => {
      const { client, mockRpc } = createMockSupabase();
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: "connection timeout" },
      });

      const result = await fetchScopedUserOperationsMetrics(
        client,
        { from: validFrom, to: validTo },
        "admin",
      );
      expect(result).toEqual({ status: "unavailable", code: "UNAVAILABLE" });
    });
  });
});
