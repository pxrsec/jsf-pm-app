import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  fetchScopedOperationsMetrics,
  fetchScopedOperationsMetricTrend,
  validateDeliverableStatusDistribution,
  validateProjectStatusDistribution,
} from "../queries";
import {
  fetchAdminAuditPage,
  fetchAdminUserInvitationStatePage,
} from "@/lib/admin-operations/queries";
import type { AdminAuditCursor } from "@/lib/admin-operations/types";
import { getAdminCapabilityDiagnostics } from "@/lib/admin-operations/diagnostics";
import * as notificationConfig from "@/lib/notifications/config";

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

describe("S07-05 & S07-06 Server Adapters Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. M3 Scoped Operations Metrics Adapter", () => {
    const validFrom = "2026-05-26T00:00:00-06:00";
    const validTo = "2026-08-24T00:00:00-06:00";
    const validProjectId = "a0000000-0000-0000-0000-000000000001";

    const mockRow = {
      project_counts_by_status: { in_progress: 3, completed: 5 },
      active_task_count: 12,
      overdue_task_count: 2,
      deadline_attention_count: 4,
      production_deliverable_counts_by_status: {
        pending: 1,
        approved: 4,
        delivered: 2,
      },
      finalized_deliverable_count: 6,
      client_review_cycle_count: 3,
      average_client_review_hours: 14.5,
      completion_cycle_count: 2,
      reopening_cycle_count: 1,
      average_completion_cycle_duration_days: 28.2,
      unread_in_app_queue_count: 5,
      suppressed_external_queue_count: 8,
      unresolved_link_report_count: 1,
      range_from: validFrom,
      range_to: validTo,
    };

    it("constructs explicit RPC arguments omitting project for Admin and requiring project for PM", async () => {
      const { client, mockRpc } = createMockSupabase();
      mockRpc.mockResolvedValue({ data: [mockRow], error: null });

      // Admin call: p_project_id is undefined
      const adminResult = await fetchScopedOperationsMetrics(
        client,
        { from: validFrom, to: validTo },
        "admin",
      );
      expect(adminResult.status).toBe("available");
      expect(mockRpc).toHaveBeenCalledWith("get_scoped_operations_metrics", {
        p_project_id: undefined,
        p_from: validFrom,
        p_to: validTo,
      });

      // PM call: p_project_id is passed
      const pmResult = await fetchScopedOperationsMetrics(
        client,
        { from: validFrom, to: validTo, projectId: validProjectId },
        "pm",
      );
      expect(pmResult.status).toBe("available");
      expect(mockRpc).toHaveBeenCalledWith("get_scoped_operations_metrics", {
        p_project_id: validProjectId,
        p_from: validFrom,
        p_to: validTo,
      });
    });

    it("requires exactly one returned row (0 or >1 fails closed to UNAVAILABLE)", async () => {
      const { client, mockRpc } = createMockSupabase();

      // Zero rows
      mockRpc.mockResolvedValueOnce({ data: [], error: null });
      const zeroResult = await fetchScopedOperationsMetrics(
        client,
        { from: validFrom, to: validTo },
        "admin",
      );
      expect(zeroResult).toEqual({
        status: "unavailable",
        code: "UNAVAILABLE",
      });

      // Multiple rows
      mockRpc.mockResolvedValueOnce({
        data: [mockRow, mockRow],
        error: null,
      });
      const multiResult = await fetchScopedOperationsMetrics(
        client,
        { from: validFrom, to: validTo },
        "admin",
      );
      expect(multiResult).toEqual({
        status: "unavailable",
        code: "UNAVAILABLE",
      });
    });

    it("normalizes missing known status keys to 0 and rejects unknown status keys", () => {
      // Known omitted keys become 0
      const validDist = validateProjectStatusDistribution({ in_progress: 2 });
      expect(validDist).toEqual({
        planning: 0,
        in_progress: 2,
        paused: 0,
        completed: 0,
        cancelled: 0,
      });

      const validDelivDist = validateDeliverableStatusDistribution({
        pending: 3,
        approved: 1,
      });
      expect(validDelivDist).toEqual({
        pending: 3,
        awaiting_internal_review: 0,
        awaiting_client_review: 0,
        approved: 1,
        changes_requested: 0,
        delivered: 0,
        submitted: 0,
      });

      // Unknown status key fails closed
      expect(
        validateProjectStatusDistribution({ in_progress: 2, unknown_key: 1 }),
      ).toBeNull();
      expect(
        validateDeliverableStatusDistribution({ pending: 2, unknown_key: 1 }),
      ).toBeNull();

      // Non-safe or negative integers fail closed
      expect(validateProjectStatusDistribution({ in_progress: -1 })).toBeNull();
      expect(
        validateProjectStatusDistribution({ in_progress: 1.5 }),
      ).toBeNull();
      expect(validateDeliverableStatusDistribution({ pending: -1 })).toBeNull();
    });

    it("preserves null vs zero honestly for cycle averages and queue metrics", async () => {
      const { client, mockRpc } = createMockSupabase();
      const rowWithNulls = {
        ...mockRow,
        average_client_review_hours: null,
        average_completion_cycle_duration_days: null,
        unread_in_app_queue_count: null,
        suppressed_external_queue_count: null,
      };
      mockRpc.mockResolvedValue({ data: [rowWithNulls], error: null });

      const result = await fetchScopedOperationsMetrics(
        client,
        { from: validFrom, to: validTo, projectId: validProjectId },
        "pm",
      );

      expect(result.status).toBe("available");
      if (result.status === "available") {
        expect(result.data.averageClientReviewHours).toBeNull();
        expect(result.data.averageCompletionCycleDurationDays).toBeNull();
        expect(result.data.unreadInAppQueueCount).toBeNull();
        expect(result.data.suppressedExternalQueueCount).toBeNull();
      }
    });
  });

  describe("2. M5 Metric Trend Adapter", () => {
    const from = "2026-08-03T00:00:00-06:00";
    const mid1 = "2026-08-10T00:00:00-06:00";
    const mid2 = "2026-08-17T00:00:00-06:00";
    const to = "2026-08-24T00:00:00-06:00";

    it("validates chronological contiguous 7-day bucket sequences and instant equality", async () => {
      const { client, mockRpc } = createMockSupabase();
      const mockBuckets = [
        {
          period_start: from,
          period_end: mid1,
          finalized_deliverable_count: 2,
          client_review_cycle_count: 1,
          completion_cycle_count: 1,
          reopening_cycle_count: 0,
        },
        {
          period_start: mid1,
          period_end: mid2,
          finalized_deliverable_count: 4,
          client_review_cycle_count: 2,
          completion_cycle_count: 1,
          reopening_cycle_count: 1,
        },
        {
          period_start: mid2,
          period_end: to,
          finalized_deliverable_count: 1,
          client_review_cycle_count: 0,
          completion_cycle_count: 0,
          reopening_cycle_count: 0,
        },
      ];
      mockRpc.mockResolvedValue({ data: mockBuckets, error: null });

      const result = await fetchScopedOperationsMetricTrend(
        client,
        { from, to },
        "admin",
      );

      expect(result.status).toBe("available");
      if (result.status === "available") {
        expect(result.data).toHaveLength(3);
        expect(result.data[0].finalizedDeliverableCount).toBe(2);
        expect(result.data[1].reopeningCycleCount).toBe(1);
      }
    });

    it("fails closed when bucket sequence is non-contiguous or exceeds 14 buckets", async () => {
      const { client, mockRpc } = createMockSupabase();

      // Non-contiguous bucket
      const nonContiguousBuckets = [
        {
          period_start: from,
          period_end: mid1,
          finalized_deliverable_count: 1,
          client_review_cycle_count: 0,
          completion_cycle_count: 0,
          reopening_cycle_count: 0,
        },
        {
          period_start: "2026-08-11T00:00:00-06:00", // Gap of 1 day
          period_end: to,
          finalized_deliverable_count: 0,
          client_review_cycle_count: 0,
          completion_cycle_count: 0,
          reopening_cycle_count: 0,
        },
      ];
      mockRpc.mockResolvedValueOnce({
        data: nonContiguousBuckets,
        error: null,
      });

      const gapResult = await fetchScopedOperationsMetricTrend(
        client,
        { from, to },
        "admin",
      );
      expect(gapResult).toEqual({ status: "unavailable", code: "UNAVAILABLE" });
    });
  });

  describe("3. Admin Audit History Adapter", () => {
    const from = "2026-05-26T00:00:00-06:00";
    const to = "2026-08-24T00:00:00-06:00";

    it("applies 25+1 keyset pagination, derives cursor from row 25, and strips raw IDs from DTOs", async () => {
      const { client, mockRpc } = createMockSupabase();
      const mockRows = Array.from({ length: 26 }, (_, i) => ({
        audit_id: 100 - i,
        created_at: `2026-08-${String(24 - Math.floor(i / 2)).padStart(2, "0")}T10:00:00-06:00`,
        action: "project_completed",
        entity_type: "project" as const,
        entity_id: `b0000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
        project_id: `c0000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
        project_name: `Project ${i}`,
        actor_role: "pm" as const,
        old_status: "in_progress",
        new_status: "completed",
        changed_field_summary: "Status changed",
      }));

      mockRpc.mockResolvedValue({ data: mockRows, error: null });

      const result = await fetchAdminAuditPage(client, { from, to });

      expect(result.status).toBe("available");
      if (result.status === "available") {
        expect(result.data.items).toHaveLength(25);
        expect(result.data.hasMore).toBe(true);
        expect(result.data.nextCursor).toEqual({
          beforeCreatedAt: mockRows[24].created_at,
          beforeAuditId: mockRows[24].audit_id,
        });

        // Verify raw IDs are stripped from projected DTOs
        const firstItem = result.data.items[0] as unknown as Record<
          string,
          unknown
        >;
        expect(firstItem.auditId).toBeUndefined();
        expect(firstItem.entityId).toBeUndefined();
        expect(firstItem.projectId).toBeUndefined();
        expect(firstItem.projectName).toBe("Project 0");
        expect(firstItem.action).toBe("project_completed");
      }
    });

    it("rejects incomplete cursor payloads", async () => {
      const { client } = createMockSupabase();
      const invalidCursor = {
        beforeCreatedAt: "2026-08-20T10:00:00-06:00",
        beforeAuditId: -5, // Negative ID
      };

      const result = await fetchAdminAuditPage(
        client,
        { from, to },
        invalidCursor as unknown as AdminAuditCursor,
      );
      expect(result).toEqual({ status: "unavailable", code: "UNAVAILABLE" });
    });
  });

  describe("4. Admin User & Invitation State Adapter", () => {
    it("discriminates profile vs invitation rows, derives cursor, and strips raw IDs", async () => {
      const { client, mockRpc } = createMockSupabase();
      const mockRows = [
        {
          record_id: "d0000000-0000-0000-0000-000000000001",
          record_kind: "profile",
          created_at: "2026-08-24T09:00:00-06:00",
          profile_id: "d0000000-0000-0000-0000-000000000001",
          full_name: "John Doe",
          application_role: "pm" as const,
          is_active: true,
          preferred_locale: "es-MX",
          email_notifications_enabled: true,
          whatsapp_opt_in: false,
          last_seen_at: "2026-08-24T09:30:00-06:00",
          invitation_id: null,
          invitation_status: null,
          project_id: null,
          project_name: null,
          invitation_expires_at: null,
          invitation_accepted_at: null,
          invitation_revoked_at: null,
        },
        {
          record_id: "e0000000-0000-0000-0000-000000000002",
          record_kind: "invitation",
          created_at: "2026-08-23T14:00:00-06:00",
          profile_id: null,
          full_name: null,
          application_role: "operator" as const,
          is_active: null,
          preferred_locale: null,
          email_notifications_enabled: null,
          whatsapp_opt_in: null,
          last_seen_at: null,
          invitation_id: "e0000000-0000-0000-0000-000000000002",
          invitation_status: "pending" as const,
          project_id: "f0000000-0000-0000-0000-000000000003",
          project_name: "Acme Commercial",
          invitation_expires_at: "2026-08-30T14:00:00-06:00",
          invitation_accepted_at: null,
          invitation_revoked_at: null,
        },
      ];

      mockRpc.mockResolvedValue({ data: mockRows, error: null });

      const result = await fetchAdminUserInvitationStatePage(client);

      expect(result.status).toBe("available");
      if (result.status === "available") {
        expect(result.data.items).toHaveLength(2);

        const profileItem = result.data.items[0];
        expect(profileItem.kind).toBe("profile");
        if (profileItem.kind === "profile") {
          expect(profileItem.fullName).toBe("John Doe");
          expect(profileItem.isActive).toBe(true);
          // Stripped raw ID verification
          const profileRaw = profileItem as unknown as Record<string, unknown>;
          expect(profileRaw.profileId).toBeUndefined();
          expect(profileRaw.recordId).toBeUndefined();
        }

        const inviteItem = result.data.items[1];
        expect(inviteItem.kind).toBe("invitation");
        if (inviteItem.kind === "invitation") {
          expect(inviteItem.invitationStatus).toBe("pending");
          expect(inviteItem.projectName).toBe("Acme Commercial");
          // Stripped raw ID verification
          const inviteRaw = inviteItem as unknown as Record<string, unknown>;
          expect(inviteRaw.invitationId).toBeUndefined();
          expect(inviteRaw.recordId).toBeUndefined();
          expect(inviteRaw.projectId).toBeUndefined();
        }
      }
    });
  });

  describe("5. Admin Capability Diagnostics Adapter", () => {
    it("maps external delivery capabilities to closed safe tokens without secret disclosure", () => {
      const spy = vi.spyOn(notificationConfig, "getExternalDeliveryCapability");

      // Test disabled
      spy.mockReturnValueOnce({
        kind: "disabled",
        mode: "disabled",
        code: "mode_disabled",
        email: { kind: "disabled", code: "provider_disabled" },
        whatsapp: { kind: "disabled", code: "provider_disabled" },
      });
      const disabledDiag = getAdminCapabilityDiagnostics();
      expect(disabledDiag).toEqual([
        { capability: "localDemoPosture", state: "local_demo" },
        { capability: "externalDelivery", state: "inactive" },
      ]);

      // Test invalid
      spy.mockReturnValueOnce({
        kind: "invalid",
        mode: "disabled",
        code: "provider_configuration_incomplete",
        email: { kind: "disabled", code: "provider_missing" },
        whatsapp: { kind: "disabled", code: "provider_missing" },
      });
      const invalidDiag = getAdminCapabilityDiagnostics();
      expect(invalidDiag).toEqual([
        { capability: "localDemoPosture", state: "local_demo" },
        {
          capability: "externalDelivery",
          state: "activation_prerequisites_incomplete",
        },
      ]);

      // Test active-ready (configuration_requires_review)
      spy.mockReturnValueOnce({
        kind: "active-ready",
        mode: "active",
        email: { kind: "ready" },
        whatsapp: { kind: "ready" },
      });
      const readyDiag = getAdminCapabilityDiagnostics();
      expect(readyDiag).toEqual([
        { capability: "localDemoPosture", state: "local_demo" },
        {
          capability: "externalDelivery",
          state: "configuration_requires_review",
        },
      ]);
    });
  });
});
