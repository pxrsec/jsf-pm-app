import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

import {
  fetchCalendarFeed,
  fetchCalendarMilestoneTargets,
  fetchCalendarMilestoneForEdit,
} from "../queries";

type MockSupabaseClient = Parameters<typeof fetchCalendarFeed>[0];

describe("Calendar Server Queries", () => {
  let mockSupabase: {
    rpc: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = {
      rpc: vi.fn(),
    };
  });

  describe("fetchCalendarFeed", () => {
    it("calls list_role_safe_calendar_events with validated ISO params", async () => {
      const mockRows = [
        {
          entity_id: "00000000-0000-0000-0000-000000000001",
          project_id: "00000000-0000-0000-0000-000000000002",
          project_name: "Documentary Film",
          task_id: null,
          title: "Production Wrap",
          event_type: "milestone",
          starts_at: "2026-08-15T00:00:00-06:00",
          ends_at: null,
          is_all_day: true,
          color_override: "chart-1",
        },
      ];

      mockSupabase.rpc.mockResolvedValueOnce({
        data: mockRows,
        error: null,
      });

      const result = await fetchCalendarFeed(
        mockSupabase as unknown as MockSupabaseClient,
        {
          from: "2026-08-01T00:00:00-06:00",
          to: "2026-09-01T00:00:00-06:00",
          projectId: "00000000-0000-0000-0000-000000000002",
        },
      );

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "list_role_safe_calendar_events",
        {
          p_from: "2026-08-01T00:00:00-06:00",
          p_to: "2026-09-01T00:00:00-06:00",
          p_project_id: "00000000-0000-0000-0000-000000000002",
        },
      );

      expect(result).toHaveLength(1);
      expect(result[0].entity_id).toBe("00000000-0000-0000-0000-000000000001");
      expect(result[0].color_override).toBe("chart-1");
    });

    it("verifies feed overlap boundary semantics: event starting at rangeEnd is absent", async () => {
      mockSupabase.rpc.mockImplementation(
        async (
          _name: string,
          args: { p_from: string; p_to: string; p_project_id?: string | null },
        ) => {
          const toTime = new Date(args.p_to).getTime();
          const mockDatabaseEvents = [
            {
              entity_id: "in-range",
              project_id: null,
              project_name: null,
              task_id: null,
              title: "Within Range",
              event_type: "milestone",
              starts_at: "2026-08-31T23:59:59-06:00",
              ends_at: null,
              is_all_day: true,
              color_override: null,
            },
            {
              entity_id: "boundary-excluded",
              project_id: null,
              project_name: null,
              task_id: null,
              title: "Exact Boundary End",
              event_type: "milestone",
              starts_at: "2026-09-01T00:00:00-06:00",
              ends_at: null,
              is_all_day: true,
              color_override: null,
            },
          ];

          return {
            data: mockDatabaseEvents.filter(
              (e) => new Date(e.starts_at).getTime() < toTime,
            ),
            error: null,
          };
        },
      );

      const result = await fetchCalendarFeed(
        mockSupabase as unknown as MockSupabaseClient,
        {
          from: "2026-08-01T00:00:00-06:00",
          to: "2026-09-01T00:00:00-06:00",
        },
      );

      expect(result.map((r) => r.entity_id)).toEqual(["in-range"]);
      expect(
        result.find((r) => r.entity_id === "boundary-excluded"),
      ).toBeUndefined();
    });

    it("throws when RPC errors", async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: "Database connection failed" },
      });

      await expect(
        fetchCalendarFeed(mockSupabase as unknown as MockSupabaseClient, {
          from: "2026-08-01T00:00:00-06:00",
          to: "2026-09-01T00:00:00-06:00",
        }),
      ).rejects.toThrow("Failed to fetch calendar feed");
    });

    it("throws when feed range parameters fail validation", async () => {
      await expect(
        fetchCalendarFeed(mockSupabase as unknown as MockSupabaseClient, {
          from: "invalid-date",
          to: "2026-09-01T00:00:00-06:00",
        }),
      ).rejects.toThrow();
    });
  });

  describe("fetchCalendarMilestoneTargets", () => {
    it("calls list_calendar_milestone_targets RPC and normalizes rows", async () => {
      const mockTargets = [
        {
          project_id: "00000000-0000-0000-0000-000000000001",
          project_name: "Documentary Film",
          task_id: "00000000-0000-0000-0000-000000000002",
          task_title: "Rough Cut Editing",
        },
        {
          project_id: "00000000-0000-0000-0000-000000000001",
          project_name: "Documentary Film",
          task_id: null,
          task_title: null,
        },
      ];

      mockSupabase.rpc.mockResolvedValueOnce({
        data: mockTargets,
        error: null,
      });

      const result = await fetchCalendarMilestoneTargets(
        mockSupabase as unknown as MockSupabaseClient,
      );

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "list_calendar_milestone_targets",
      );
      expect(result).toHaveLength(2);
      expect(result[0].task_id).toBe("00000000-0000-0000-0000-000000000002");
      expect(result[1].task_id).toBeNull();
    });

    it("returns empty array on RPC failure", async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: "RLS error" },
      });

      const result = await fetchCalendarMilestoneTargets(
        mockSupabase as unknown as MockSupabaseClient,
      );
      expect(result).toEqual([]);
    });
  });

  describe("fetchCalendarMilestoneForEdit", () => {
    it("fetches single milestone detail including description", async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [
          {
            entity_id: "00000000-0000-0000-0000-000000000010",
            project_id: "00000000-0000-0000-0000-000000000001",
            project_name: "Documentary Film",
            task_id: null,
            title: "Director Cut Final Approval",
            description: "Strictly confidential - executive review",
            starts_at: "2026-08-25T14:00:00-06:00",
            ends_at: null,
            is_all_day: false,
            color_override: "chart-2",
          },
        ],
        error: null,
      });

      const result = await fetchCalendarMilestoneForEdit(
        mockSupabase as unknown as MockSupabaseClient,
        "00000000-0000-0000-0000-000000000010",
      );

      expect(result).not.toBeNull();
      if (result) {
        expect(result.title).toBe("Director Cut Final Approval");
        expect(result.description).toBe(
          "Strictly confidential - executive review",
        );
        expect(result.color_override).toBe("chart-2");
      }
    });

    it("returns null when milestone row does not exist", async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const result = await fetchCalendarMilestoneForEdit(
        mockSupabase as unknown as MockSupabaseClient,
        "00000000-0000-0000-0000-000000000099",
      );

      expect(result).toBeNull();
    });

    it("returns null when RPC returns error (e.g. invalid UUID / not found)", async () => {
      mockSupabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: "invalid input syntax for type uuid" },
      });

      const result = await fetchCalendarMilestoneForEdit(
        mockSupabase as unknown as MockSupabaseClient,
        "invalid-uuid",
      );

      expect(result).toBeNull();
    });
  });
});
