import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const { mockSupabase, mockSession, mockInsert, mockRpc } =
  vi.hoisted(() => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    const mockDelete = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
        is: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "proj-123", name: "Updated Proj" },
              error: null,
            }),
          }),
        }),
      }),
    });
    const mockRpc = vi.fn().mockResolvedValue({ data: true, error: null });

    const mockSupabase = {
      rpc: mockRpc,
      from: vi.fn((table: string) => {
        if (table === "project_members") {
          return {
            insert: mockInsert,
            update: mockUpdate,
            delete: mockDelete,
          };
        }
        if (table === "projects") {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: "proj-123",
                    name: "Test Project",
                    project_type: "client",
                    status: "planning",
                  },
                  error: null,
                }),
              }),
            }),
            update: mockUpdate,
            delete: mockDelete,
          };
        }
        return {};
      }),
    };

    const mockSession = {
      user: { id: "user-pm-111", email: "pm@joya.test" },
      role: "pm",
      profile: {
        id: "user-pm-111",
        full_name: "PM User",
        role: "pm",
      },
    };

    return {
      mockSupabase,
      mockSession,
      mockInsert,
      mockUpdate,
      mockDelete,
      mockRpc,
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
  requireSession: vi.fn().mockImplementation(() => Promise.resolve(mockSession)),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockReturnValue(mockSupabase),
}));

import {
  createProjectAction,
  updateProjectAction,
  archiveProjectAction,
  restoreProjectAction,
  setPrimaryPmLeadAction,
} from "@/lib/projects/actions";

describe("Project Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession.role = "pm";
  });

  describe("createProjectAction", () => {
    it("creates project and automatically assigns current PM as primary lead", async () => {
      const result = await createProjectAction({
        name: "Q4 Marketing Camp",
        project_type: "client",
        internal_description: "Internal scope notes",
        deadline_at: "2026-11-30T12:00:00.000Z",
      });

      expect(result.ok).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith([
        expect.objectContaining({
          project_id: "proj-123",
          user_id: "user-pm-111",
          member_type: "pm_lead",
          is_primary: true,
        }),
      ]);
    });

    it("rejects unauthorized roles like operator or client", async () => {
      mockSession.role = "operator";
      const result = await createProjectAction({
        name: "Forbidden Project",
        project_type: "internal",
        internal_description: "Notes",
        deadline_at: "2026-11-30T12:00:00.000Z",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("UNAUTHORIZED");
      }
    });
  });

  describe("updateProjectAction", () => {
    it("updates project name and description", async () => {
      const result = await updateProjectAction("proj-123", {
        name: "Updated Name",
        internal_description: "Updated notes",
      });
      expect(result.ok).toBe(true);
    });
  });

  describe("archiveProjectAction", () => {
    it("archives project successfully", async () => {
      const result = await archiveProjectAction("proj-123", "Project finished");
      expect(result.ok).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith(
        "soft_delete_entity",
        expect.objectContaining({
          p_entity_id: "proj-123",
          p_entity_type: "project",
        }),
      );
    });
  });

  describe("restoreProjectAction", () => {
    it("allows admin to restore project", async () => {
      mockSession.role = "admin";
      const result = await restoreProjectAction("proj-123");
      expect(result.ok).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith(
        "restore_entity",
        expect.objectContaining({
          p_entity_id: "proj-123",
          p_entity_type: "project",
        }),
      );
    });

    it("rejects non-admin from restoring project", async () => {
      mockSession.role = "pm";
      const result = await restoreProjectAction("proj-123");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("UNAUTHORIZED");
      }
    });
  });

  describe("setPrimaryPmLeadAction", () => {
    it("demotes previous primary leads and designates new primary lead", async () => {
      const result = await setPrimaryPmLeadAction("proj-123", "member-456");
      expect(result.ok).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith("project_members");
    });
  });
});
