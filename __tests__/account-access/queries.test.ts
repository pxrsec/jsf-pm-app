import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  fetchOwnAccountSettings,
  fetchUserAccessDirectory,
  fetchStaleAccessReminderCandidates,
  fetchBugReports,
} from "@/lib/account-access/queries";

describe("Account Access Queries", () => {
  const validUuid = "11111111-1111-4111-8111-111111111111";
  const validIso = "2026-09-02T12:00:00.000Z";

  describe("fetchOwnAccountSettings", () => {
    it("returns available on valid single row", async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: [
            {
              user_id: validUuid,
              full_name: "Ruben Owner",
              preferred_locale: "es-MX",
              timezone: "America/Mexico_City",
              email_notifications_enabled: true,
              role: "admin",
            },
          ],
          error: null,
        }),
      } as unknown as SupabaseClient<Database>;

      const result = await fetchOwnAccountSettings(mockSupabase);
      expect(result.status).toBe("available");
      if (result.status === "available") {
        expect(result.data.userId).toBe(validUuid);
        expect(result.data.fullName).toBe("Ruben Owner");
        expect(result.data.preferredLocale).toBe("es-MX");
        expect(result.data.timezone).toBe("America/Mexico_City");
        expect(result.data.emailNotificationsEnabled).toBe(true);
        expect(result.data.role).toBe("admin");
      }
    });

    it("fails closed on 0 rows, >1 rows, or RPC error", async () => {
      const mockEmpty = {
        rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as unknown as SupabaseClient<Database>;
      expect((await fetchOwnAccountSettings(mockEmpty)).status).toBe(
        "unavailable",
      );

      const mockMultiple = {
        rpc: vi.fn().mockResolvedValue({
          data: [
            {
              user_id: validUuid,
              full_name: "A",
              preferred_locale: "es-MX",
              timezone: "UTC",
              email_notifications_enabled: true,
              role: "admin",
            },
            {
              user_id: validUuid,
              full_name: "B",
              preferred_locale: "es-MX",
              timezone: "UTC",
              email_notifications_enabled: true,
              role: "admin",
            },
          ],
          error: null,
        }),
      } as unknown as SupabaseClient<Database>;
      expect((await fetchOwnAccountSettings(mockMultiple)).status).toBe(
        "unavailable",
      );

      const mockError = {
        rpc: vi
          .fn()
          .mockResolvedValue({ data: null, error: { message: "DB error" } }),
      } as unknown as SupabaseClient<Database>;
      expect((await fetchOwnAccountSettings(mockError)).status).toBe(
        "unavailable",
      );
    });

    it("fails closed on malformed fields", async () => {
      const mockBadRole = {
        rpc: vi.fn().mockResolvedValue({
          data: [
            {
              user_id: validUuid,
              full_name: "Bad User",
              preferred_locale: "es-MX",
              timezone: "UTC",
              email_notifications_enabled: true,
              role: "superuser", // invalid
            },
          ],
          error: null,
        }),
      } as unknown as SupabaseClient<Database>;
      expect((await fetchOwnAccountSettings(mockBadRole)).status).toBe(
        "unavailable",
      );
    });

    it("catches thrown client exceptions and resolves to unavailable", async () => {
      const mockThrowing = {
        rpc: vi.fn().mockRejectedValue(new Error("Network crash")),
      } as unknown as SupabaseClient<Database>;
      const result = await fetchOwnAccountSettings(mockThrowing);
      expect(result.status).toBe("unavailable");
    });
  });

  describe("fetchUserAccessDirectory", () => {
    function makeDirectoryRow(index: number) {
      return {
        user_id: `11111111-1111-4111-8111-${String(index).padStart(12, "0")}`,
        created_at: `2026-09-02T12:${String(index).padStart(2, "0")}:00.000Z`,
        full_name: `User ${index}`,
        application_role: "operator",
        is_active: true,
        last_successful_auth_at: index % 2 === 0 ? validIso : null,
        active_project_membership_count: 2,
        active_task_assignment_count: 1,
        active_deliverable_assignment_count: 0,
        pending_invitation_count: 0,
        last_access_action: index % 3 === 0 ? "reactivated" : null,
        last_access_action_at: index % 3 === 0 ? validIso : null,
      };
    }

    it("processes 26 rows, validates all 26, slices to 25, and derives cursor from item 25", async () => {
      const rows = Array.from({ length: 26 }, (_, i) =>
        makeDirectoryRow(i + 1),
      );

      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({ data: rows, error: null }),
      } as unknown as SupabaseClient<Database>;

      const result = await fetchUserAccessDirectory(mockSupabase);
      expect(result.status).toBe("available");
      if (result.status === "available") {
        expect(result.data.hasMore).toBe(true);
        expect(result.data.items).toHaveLength(25);
        // Exposes visible item 25 (index 24) in nextCursor
        expect(result.data.nextCursor).toEqual({
          beforeCreatedAt: rows[24].created_at,
          beforeUserId: rows[24].user_id,
        });
        // 26th row is NOT in items
        expect(
          result.data.items.some((item) => item.userId === rows[25].user_id),
        ).toBe(false);
      }
    });

    it("rejects >26 rows", async () => {
      const rows = Array.from({ length: 27 }, (_, i) =>
        makeDirectoryRow(i + 1),
      );
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({ data: rows, error: null }),
      } as unknown as SupabaseClient<Database>;
      const result = await fetchUserAccessDirectory(mockSupabase);
      expect(result.status).toBe("unavailable");
    });

    it("fails closed on malformed row or invalid timestamp in any row", async () => {
      const rows = Array.from({ length: 26 }, (_, i) =>
        makeDirectoryRow(i + 1),
      );
      // Invalidate row 26 (lookahead row)
      rows[25].created_at = "not-an-iso-date";

      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({ data: rows, error: null }),
      } as unknown as SupabaseClient<Database>;
      const result = await fetchUserAccessDirectory(mockSupabase);
      expect(result.status).toBe("unavailable");
    });

    it("catches thrown client exceptions and resolves to unavailable", async () => {
      const mockThrowing = {
        rpc: vi.fn().mockRejectedValue(new Error("RPC failure")),
      } as unknown as SupabaseClient<Database>;
      const result = await fetchUserAccessDirectory(mockThrowing);
      expect(result.status).toBe("unavailable");
    });
  });

  describe("fetchStaleAccessReminderCandidates", () => {
    it("validates candidates and returns available", async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: [
            {
              user_id: validUuid,
              full_name: "Stale Operator",
              application_role: "operator",
              inactivity_period_started_at: validIso,
            },
          ],
          error: null,
        }),
      } as unknown as SupabaseClient<Database>;

      const result = await fetchStaleAccessReminderCandidates(mockSupabase);
      expect(result.status).toBe("available");
      if (result.status === "available") {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].fullName).toBe("Stale Operator");
      }
    });

    it("fails closed on malformed candidate or invalid role", async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({
          data: [
            {
              user_id: validUuid,
              full_name: "Bad Role",
              application_role: "admin", // only client or operator allowed
              inactivity_period_started_at: validIso,
            },
          ],
          error: null,
        }),
      } as unknown as SupabaseClient<Database>;
      expect(
        (await fetchStaleAccessReminderCandidates(mockSupabase)).status,
      ).toBe("unavailable");
    });
  });

  describe("fetchBugReports", () => {
    function makeBugRow(index: number) {
      return {
        report_id: `22222222-2222-4222-8222-${String(index).padStart(12, "0")}`,
        title: `Bug ${index}`,
        description: `Description ${index}`,
        status: "open",
        reporter_role: "client",
        created_at: `2026-09-02T12:${String(index).padStart(2, "0")}:00.000Z`,
        status_changed_at: index % 2 === 0 ? validIso : null,
      };
    }

    it("validates 26 rows, derives nextCursor from item 25, and excludes item 26", async () => {
      const rows = Array.from({ length: 26 }, (_, i) => makeBugRow(i + 1));
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({ data: rows, error: null }),
      } as unknown as SupabaseClient<Database>;

      const result = await fetchBugReports(mockSupabase);
      expect(result.status).toBe("available");
      if (result.status === "available") {
        expect(result.data.hasMore).toBe(true);
        expect(result.data.items).toHaveLength(25);
        expect(result.data.nextCursor).toEqual({
          beforeCreatedAt: rows[24].created_at,
          beforeReportId: rows[24].report_id,
        });
      }
    });

    it("rejects >26 rows", async () => {
      const rows = Array.from({ length: 27 }, (_, i) => makeBugRow(i + 1));
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValue({ data: rows, error: null }),
      } as unknown as SupabaseClient<Database>;
      expect((await fetchBugReports(mockSupabase)).status).toBe("unavailable");
    });
  });
});
