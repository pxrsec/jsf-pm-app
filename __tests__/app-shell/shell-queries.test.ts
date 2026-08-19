import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
import {
  getUnreadNotificationCount,
  getAdminShellData,
  getPmShellData,
  getOperatorShellData,
  getClientShellData,
} from "@/lib/shell-data/shell-queries";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type TypedSupabase = SupabaseClient<Database>;

describe("Shell Data Queries (src/lib/shell-data/shell-queries.ts)", () => {
  describe("getUnreadNotificationCount", () => {
    it("returns unread count when view returns a row", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { unread_count: 3 },
                error: null,
              }),
            }),
          }),
        }),
      } as unknown as TypedSupabase;

      const count = await getUnreadNotificationCount(mockSupabase, "user-1");
      expect(count).toBe(3);
    });

    it("returns 0 when view returns null", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        }),
      } as unknown as TypedSupabase;

      const count = await getUnreadNotificationCount(mockSupabase, "user-1");
      expect(count).toBe(0);
    });

    it("returns 0 gracefully on Supabase error", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: new Error("RLS denied or connection error"),
              }),
            }),
          }),
        }),
      } as unknown as TypedSupabase;

      const count = await getUnreadNotificationCount(mockSupabase, "user-1");
      expect(count).toBe(0);
    });
  });

  describe("getAdminShellData", () => {
    it("returns typed project rows from projects table", async () => {
      const mockProjects = [
        {
          id: "proj-1",
          name: "Project One",
          status: "in_progress" as const,
          deadline_at: "2026-09-01T00:00:00Z",
        },
      ];

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: mockProjects,
                error: null,
              }),
            }),
          }),
        }),
      } as unknown as TypedSupabase;

      const result = await getAdminShellData(mockSupabase);
      expect(result.projects).toEqual(mockProjects);
    });

    it("returns empty array on error", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: null,
                error: new Error("DB error"),
              }),
            }),
          }),
        }),
      } as unknown as TypedSupabase;

      const result = await getAdminShellData(mockSupabase);
      expect(result.projects).toEqual([]);
    });
  });

  describe("getPmShellData", () => {
    it("returns mapped project memberships for PM", async () => {
      const mockRows = [
        {
          member_type: "pm_lead" as const,
          is_primary: true,
          projects: {
            id: "proj-1",
            name: "Campaign Alpha",
            status: "in_progress" as const,
            deadline_at: "2026-10-01T00:00:00Z",
          },
        },
      ];

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: mockRows,
                error: null,
              }),
            }),
          }),
        }),
      } as unknown as TypedSupabase;

      const result = await getPmShellData(mockSupabase, "pm-user-1");
      expect(result.projects).toEqual([
        {
          id: "proj-1",
          name: "Campaign Alpha",
          status: "in_progress",
          deadline_at: "2026-10-01T00:00:00Z",
          member_type: "pm_lead",
          is_primary: true,
        },
      ]);
    });

    it("returns empty array when PM has no memberships or on error", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      } as unknown as TypedSupabase;

      const result = await getPmShellData(mockSupabase, "pm-user-1");
      expect(result.projects).toEqual([]);
    });
  });

  describe("getOperatorShellData", () => {
    it("returns agenda items from operator_agenda_view", async () => {
      const mockAgenda = [
        {
          task_id: "task-1",
          task_title: "Color Grading Scene 1",
          task_status: "in_progress" as const,
          task_priority: "high" as const,
          project_name: "Feature Film",
          task_deadline_at: "2026-08-25T18:00:00Z",
        },
      ];

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: mockAgenda,
                error: null,
              }),
            }),
          }),
        }),
      } as unknown as TypedSupabase;

      const result = await getOperatorShellData(mockSupabase);
      expect(result.agendaItems).toEqual(mockAgenda);
    });

    it("returns empty array on error", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: null,
                error: new Error("DB error"),
              }),
            }),
          }),
        }),
      } as unknown as TypedSupabase;

      const result = await getOperatorShellData(mockSupabase);
      expect(result.agendaItems).toEqual([]);
    });
  });

  describe("getClientShellData", () => {
    it("returns projects from client_project_view", async () => {
      const mockProjects = [
        {
          id: "proj-1",
          name: "Acme Commercial",
          status: "in_progress" as const,
          deadline_at: "2026-09-15T00:00:00Z",
          client_name: "Acme Corp",
        },
      ];

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: mockProjects,
                error: null,
              }),
            }),
          }),
        }),
      } as unknown as TypedSupabase;

      const result = await getClientShellData(mockSupabase);
      expect(result.projects).toEqual(mockProjects);
    });

    it("returns empty array on Supabase error", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: null,
                error: new Error("RLS error"),
              }),
            }),
          }),
        }),
      } as unknown as TypedSupabase;

      const result = await getClientShellData(mockSupabase);
      expect(result.projects).toEqual([]);
    });
  });
});
