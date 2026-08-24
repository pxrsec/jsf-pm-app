import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  requireSession: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("../queries", () => ({
  fetchCalendarMilestoneForEdit: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/auth/routes";
import { fetchCalendarMilestoneForEdit } from "../queries";
import {
  createCalendarMilestoneAction,
  updateCalendarMilestoneAction,
  softDeleteCalendarMilestoneAction,
  getCalendarMilestoneForEditAction,
} from "../actions";

type AppSession = Awaited<ReturnType<typeof requireSession>>;

const createMockSession = (role: AppRole): AppSession =>
  ({
    user: { id: `user-${role}`, email: `${role}@example.com` },
    role,
    profile: {
      id: `user-${role}`,
      full_name: `${role} User`,
      role,
      is_active: true,
      avatar_url: null,
    },
  }) as unknown as AppSession;

const mockRpcMilestoneRow = {
  entity_id: "00000000-0000-0000-0000-000000000099",
  project_id: "00000000-0000-0000-0000-000000000001",
  project_name: "Test Project",
  task_id: null,
  title: "New Shoot Day",
  event_type: "milestone",
  starts_at: "2026-08-22T00:00:00-06:00",
  ends_at: null,
  is_all_day: true,
  color_override: null,
};

describe("Calendar Server Actions", () => {
  let mockSupabase: {
    rpc: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = {
      rpc: vi.fn(),
    };
    vi.mocked(createClient).mockReturnValue(
      mockSupabase as unknown as ReturnType<typeof createClient>,
    );
    vi.mocked(cookies).mockResolvedValue(
      {} as unknown as Awaited<ReturnType<typeof cookies>>,
    );
  });

  describe("Role Authorization", () => {
    it("rejects operator role with UNAUTHORIZED", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce(
        createMockSession("operator"),
      );

      const result = await createCalendarMilestoneAction({
        projectId: "00000000-0000-0000-0000-000000000001",
        title: "Test Milestone",
        startsAt: "2026-08-20T00:00:00-06:00",
        isAllDay: true,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("UNAUTHORIZED");
      }
    });

    it("rejects client role with UNAUTHORIZED", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce(
        createMockSession("client"),
      );

      const result = await updateCalendarMilestoneAction({
        eventId: "00000000-0000-0000-0000-000000000001",
        projectId: "00000000-0000-0000-0000-000000000002",
        title: "Updated Milestone",
        startsAt: "2026-08-20T00:00:00-06:00",
        isAllDay: true,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("UNAUTHORIZED");
      }
    });

    it("allows admin role and calls RPC", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce(
        createMockSession("admin"),
      );

      mockSupabase.rpc.mockResolvedValueOnce({
        data: [mockRpcMilestoneRow],
        error: null,
      });

      const result = await createCalendarMilestoneAction({
        projectId: "00000000-0000-0000-0000-000000000001",
        title: "New Shoot Day",
        startsAt: "2026-08-22T00:00:00-06:00",
        isAllDay: true,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.entity_id).toBe(
          "00000000-0000-0000-0000-000000000099",
        );
      }
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "create_calendar_milestone",
        expect.objectContaining({
          p_title: "New Shoot Day",
          p_project_id: "00000000-0000-0000-0000-000000000001",
        }),
      );
    });
  });

  describe("Validation & Revalidation", () => {
    it("fails validation when title is blank", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce(createMockSession("pm"));

      const result = await createCalendarMilestoneAction({
        projectId: "00000000-0000-0000-0000-000000000001",
        title: "",
        startsAt: "2026-08-22T00:00:00-06:00",
        isAllDay: true,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
      }
    });

    it("revalidates project routes and global calendar on successful create", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce(createMockSession("pm"));

      mockSupabase.rpc.mockResolvedValueOnce({
        data: [mockRpcMilestoneRow],
        error: null,
      });

      const result = await createCalendarMilestoneAction({
        projectId: "00000000-0000-0000-0000-000000000001",
        title: "Valid Title",
        startsAt: "2026-08-22T00:00:00-06:00",
        isAllDay: true,
      });

      expect(result.ok).toBe(true);
      expect(revalidatePath).toHaveBeenCalledWith(
        "/[locale]/(protected)/calendario",
        "page",
      );
      expect(revalidatePath).toHaveBeenCalledWith(
        "/[locale]/(protected)/admin/proyectos/00000000-0000-0000-0000-000000000001",
        "page",
      );
      expect(revalidatePath).toHaveBeenCalledWith(
        "/[locale]/(protected)/pm/proyectos/00000000-0000-0000-0000-000000000001",
        "page",
      );
    });

    it("revalidates paths on soft delete", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce(
        createMockSession("admin"),
      );

      mockSupabase.rpc.mockResolvedValueOnce({
        data: true,
        error: null,
      });

      const result = await softDeleteCalendarMilestoneAction({
        eventId: "00000000-0000-0000-0000-000000000088",
      });

      expect(result.ok).toBe(true);
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "soft_delete_calendar_milestone",
        {
          p_event_id: "00000000-0000-0000-0000-000000000088",
        },
      );
      expect(revalidatePath).toHaveBeenCalledWith(
        "/[locale]/(protected)/calendario",
        "page",
      );
    });
  });

  describe("getCalendarMilestoneForEditAction", () => {
    it("returns milestone edit detail for admin / pm", async () => {
      vi.mocked(requireSession).mockResolvedValueOnce(
        createMockSession("admin"),
      );

      vi.mocked(fetchCalendarMilestoneForEdit).mockResolvedValueOnce({
        entity_id: "00000000-0000-0000-0000-000000000088",
        project_id: "00000000-0000-0000-0000-000000000001",
        project_name: "Test Project",
        task_id: null,
        title: "Pre-production Meeting",
        description: "Confidential agenda",
        starts_at: "2026-08-20T00:00:00-06:00",
        ends_at: null,
        is_all_day: true,
        color_override: null,
      });

      const result = await getCalendarMilestoneForEditAction({
        eventId: "00000000-0000-0000-0000-000000000088",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.title).toBe("Pre-production Meeting");
        expect(result.data.description).toBe("Confidential agenda");
      }
    });
  });
});
