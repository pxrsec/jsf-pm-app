import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

import {
  isLocalNotificationDemoPosture,
  evaluateNotificationAlerts,
  listActivePmLeadEvaluationProjects,
  assertPmLeadForProject,
} from "../alert-evaluator";

describe("alert-evaluator module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("isLocalNotificationDemoPosture", () => {
    it("1. Returns true for NODE_ENV=development with valid loopback URLs", () => {
      vi.stubEnv("NODE_ENV", "development");

      vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
      expect(isLocalNotificationDemoPosture()).toBe(true);

      vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://127.0.0.1:3000");
      expect(isLocalNotificationDemoPosture()).toBe(true);

      vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://[::1]:3000");
      expect(isLocalNotificationDemoPosture()).toBe(true);
    });

    it("2. Returns false when NODE_ENV is not development", () => {
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");

      vi.stubEnv("NODE_ENV", "production");
      expect(isLocalNotificationDemoPosture()).toBe(false);

      vi.stubEnv("NODE_ENV", "test");
      expect(isLocalNotificationDemoPosture()).toBe(false);

      vi.stubEnv("NODE_ENV", "");
      expect(isLocalNotificationDemoPosture()).toBe(false);
    });

    it("3. Returns false for invalid IPv6 URL http://::1:3000 without throwing", () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://::1:3000");
      expect(isLocalNotificationDemoPosture()).toBe(false);
    });

    it("4. Returns false for non-loopback hostnames and external URLs", () => {
      vi.stubEnv("NODE_ENV", "development");

      vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://example.com:3000");
      expect(isLocalNotificationDemoPosture()).toBe(false);

      vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://192.168.1.50:3000");
      expect(isLocalNotificationDemoPosture()).toBe(false);

      vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://preview.joyastarfilms.com");
      expect(isLocalNotificationDemoPosture()).toBe(false);

      vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://joyastarfilms.com");
      expect(isLocalNotificationDemoPosture()).toBe(false);
    });

    it("5. Returns false for missing, empty, or malformed NEXT_PUBLIC_APP_URL without throwing", () => {
      vi.stubEnv("NODE_ENV", "development");

      vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
      expect(isLocalNotificationDemoPosture()).toBe(false);

      vi.stubEnv("NEXT_PUBLIC_APP_URL", "not-a-valid-url");
      expect(isLocalNotificationDemoPosture()).toBe(false);
    });
  });

  describe("evaluateNotificationAlerts", () => {
    it("1. Admin global: calls public RPC with exact p_project_id: null", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: {
          tasks_evaluated: 4,
          reviews_evaluated: 2,
          events_created: 1,
          in_app_recipients_created: 1,
          external_suppressions_created: 1,
        },
        error: null,
      });

      const mockSupabase = {
        rpc: mockRpc,
      } as unknown as Parameters<typeof evaluateNotificationAlerts>[0];

      const result = await evaluateNotificationAlerts(mockSupabase, null);

      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(mockRpc).toHaveBeenCalledWith("evaluate_notification_alerts", {
        p_project_id: null,
      });
      expect(result).toEqual({
        tasksEvaluated: 4,
        reviewsEvaluated: 2,
        eventsCreated: 1,
        inAppRecipientsCreated: 1,
        externalSuppressionsCreated: 1,
      });
    });

    it("2. PM scope: calls public RPC with exact project UUID", async () => {
      const projectId = "11111111-1111-1111-1111-111111111111";
      const mockRpc = vi.fn().mockResolvedValue({
        data: {
          tasks_evaluated: 2,
          reviews_evaluated: 1,
          events_created: 0,
          in_app_recipients_created: 0,
          external_suppressions_created: 0,
        },
        error: null,
      });

      const mockSupabase = {
        rpc: mockRpc,
      } as unknown as Parameters<typeof evaluateNotificationAlerts>[0];

      const result = await evaluateNotificationAlerts(mockSupabase, projectId);

      expect(mockRpc).toHaveBeenCalledWith("evaluate_notification_alerts", {
        p_project_id: projectId,
      });
      expect(result).toEqual({
        tasksEvaluated: 2,
        reviewsEvaluated: 1,
        eventsCreated: 0,
        inAppRecipientsCreated: 0,
        externalSuppressionsCreated: 0,
      });
    });

    it("3. Rejects extra unexpected keys in return object", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: {
          tasks_evaluated: 1,
          reviews_evaluated: 1,
          events_created: 1,
          in_app_recipients_created: 1,
          external_suppressions_created: 1,
          extra_key: "forbidden",
        },
        error: null,
      });

      const mockSupabase = {
        rpc: mockRpc,
      } as unknown as Parameters<typeof evaluateNotificationAlerts>[0];

      await expect(
        evaluateNotificationAlerts(mockSupabase, null),
      ).rejects.toThrow("Alert evaluation failed");
    });

    it("4. Rejects NaN and Infinity in return counts", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: {
          tasks_evaluated: NaN,
          reviews_evaluated: 1,
          events_created: 1,
          in_app_recipients_created: 1,
          external_suppressions_created: 1,
        },
        error: null,
      });

      const mockSupabase = {
        rpc: mockRpc,
      } as unknown as Parameters<typeof evaluateNotificationAlerts>[0];

      await expect(
        evaluateNotificationAlerts(mockSupabase, null),
      ).rejects.toThrow("Alert evaluation failed");
    });

    it("5. Rejects values exceeding Number.MAX_SAFE_INTEGER", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: {
          tasks_evaluated: Number.MAX_SAFE_INTEGER + 10,
          reviews_evaluated: 1,
          events_created: 1,
          in_app_recipients_created: 1,
          external_suppressions_created: 1,
        },
        error: null,
      });

      const mockSupabase = {
        rpc: mockRpc,
      } as unknown as Parameters<typeof evaluateNotificationAlerts>[0];

      await expect(
        evaluateNotificationAlerts(mockSupabase, null),
      ).rejects.toThrow("Alert evaluation failed");
    });

    it("6. Rejects negative numbers, decimals, strings, arrays, and missing keys", async () => {
      const mockSupabase = (data: unknown) =>
        ({
          rpc: vi.fn().mockResolvedValue({ data, error: null }),
        }) as unknown as Parameters<typeof evaluateNotificationAlerts>[0];

      // Negative value
      await expect(
        evaluateNotificationAlerts(
          mockSupabase({
            tasks_evaluated: -1,
            reviews_evaluated: 0,
            events_created: 0,
            in_app_recipients_created: 0,
            external_suppressions_created: 0,
          }),
          null,
        ),
      ).rejects.toThrow("Alert evaluation failed");

      // Decimal value
      await expect(
        evaluateNotificationAlerts(
          mockSupabase({
            tasks_evaluated: 1.5,
            reviews_evaluated: 0,
            events_created: 0,
            in_app_recipients_created: 0,
            external_suppressions_created: 0,
          }),
          null,
        ),
      ).rejects.toThrow("Alert evaluation failed");

      // String value
      await expect(
        evaluateNotificationAlerts(
          mockSupabase({
            tasks_evaluated: "3",
            reviews_evaluated: 0,
            events_created: 0,
            in_app_recipients_created: 0,
            external_suppressions_created: 0,
          }),
          null,
        ),
      ).rejects.toThrow("Alert evaluation failed");

      // Incomplete object
      await expect(
        evaluateNotificationAlerts(
          mockSupabase({
            tasks_evaluated: 3,
          }),
          null,
        ),
      ).rejects.toThrow("Alert evaluation failed");
    });

    it("7. Fails closed and throws generic error on RPC error", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Internal DB error in evaluate_notification_alerts" },
      });

      const mockSupabase = {
        rpc: mockRpc,
      } as unknown as Parameters<typeof evaluateNotificationAlerts>[0];

      await expect(
        evaluateNotificationAlerts(mockSupabase, null),
      ).rejects.toThrow("Alert evaluation failed");
    });
  });

  describe("listActivePmLeadEvaluationProjects", () => {
    it("1. Queries project_members, deduplicates, filters non-active/terminal, and sorts by name", async () => {
      const mockData = [
        {
          projects: {
            id: "proj-2",
            name: "Beta Project",
            status: "in_progress",
            archived_at: null,
            deleted_at: null,
          },
        },
        {
          projects: {
            id: "proj-1",
            name: "Alpha Project",
            status: "planning",
            archived_at: null,
            deleted_at: null,
          },
        },
        {
          // Duplicate project membership for proj-1
          projects: {
            id: "proj-1",
            name: "Alpha Project",
            status: "planning",
            archived_at: null,
            deleted_at: null,
          },
        },
        {
          // Completed project
          projects: {
            id: "proj-3",
            name: "Completed Project",
            status: "completed",
            archived_at: null,
            deleted_at: null,
          },
        },
        {
          // Cancelled project
          projects: {
            id: "proj-4",
            name: "Cancelled Project",
            status: "cancelled",
            archived_at: null,
            deleted_at: null,
          },
        },
      ];

      const chain: Record<string, unknown> = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        then: (resolve: (value: { data: unknown; error: unknown }) => void) =>
          Promise.resolve({ data: mockData, error: null }).then(resolve),
      };

      const mockFrom = vi.fn().mockReturnValue(chain);
      const mockSupabase = {
        from: mockFrom,
      } as unknown as Parameters<typeof listActivePmLeadEvaluationProjects>[0];

      const projects = await listActivePmLeadEvaluationProjects(
        mockSupabase,
        "user-pm-1",
      );

      expect(mockFrom).toHaveBeenCalledWith("project_members");
      expect(chain.select).toHaveBeenCalledWith(
        "projects!inner(id, name, status, archived_at, deleted_at)",
      );
      expect(chain.eq).toHaveBeenCalledWith("user_id", "user-pm-1");
      expect(chain.eq).toHaveBeenCalledWith("member_type", "pm_lead");

      expect(projects).toEqual([
        { id: "proj-1", name: "Alpha Project" },
        { id: "proj-2", name: "Beta Project" },
      ]);
    });

    it("2. Fails closed and returns empty array on query error", async () => {
      const chain: Record<string, unknown> = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        then: (resolve: (value: { data: unknown; error: unknown }) => void) =>
          Promise.resolve({
            data: null,
            error: { message: "Database connection failed" },
          }).then(resolve),
      };

      const mockFrom = vi.fn().mockReturnValue(chain);
      const mockSupabase = {
        from: mockFrom,
      } as unknown as Parameters<typeof listActivePmLeadEvaluationProjects>[0];

      const projects = await listActivePmLeadEvaluationProjects(
        mockSupabase,
        "user-pm-1",
      );

      expect(projects).toEqual([]);
    });
  });

  describe("assertPmLeadForProject", () => {
    it("1. Returns true for active PM Lead membership on exact project with active PM profile", async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [{ id: "mem-1" }],
            error: null,
          }),
        })),
      }));

      const mockSupabase = {
        from: mockFrom,
      } as unknown as Parameters<typeof assertPmLeadForProject>[0];

      const result = await assertPmLeadForProject(
        mockSupabase,
        "user-pm-1",
        "00000000-0000-0000-0000-000000000001",
      );

      expect(result).toBe(true);
    });

    it("2. Returns false when no matching row is found (non-lead, wrong project, inactive profile, etc.)", async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        })),
      }));

      const mockSupabase = {
        from: mockFrom,
      } as unknown as Parameters<typeof assertPmLeadForProject>[0];

      const result = await assertPmLeadForProject(
        mockSupabase,
        "user-pm-1",
        "00000000-0000-0000-0000-000000000002",
      );

      expect(result).toBe(false);
    });

    it("3. Returns false on query error", async () => {
      const mockFrom = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Database query error" },
          }),
        })),
      }));

      const mockSupabase = {
        from: mockFrom,
      } as unknown as Parameters<typeof assertPmLeadForProject>[0];

      const result = await assertPmLeadForProject(
        mockSupabase,
        "user-pm-1",
        "00000000-0000-0000-0000-000000000001",
      );

      expect(result).toBe(false);
    });
  });
});
