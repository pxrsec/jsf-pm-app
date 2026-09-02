import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  archiveOperationalEntity,
  permanentlyDeleteOperationalEntity,
  restoreArchivedOperationalEntity,
} from "@/lib/operational-lifecycle/commands";
import {
  fetchOperationalDeletionPreview,
  fetchOperationalRecycleBin,
} from "@/lib/operational-lifecycle/queries";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

const VALID_UUID = "12345678-1234-4234-8234-123456789012";

function mockSupabaseRpc(mockFn: ReturnType<typeof vi.fn>) {
  return {
    rpc: mockFn,
  } as unknown as SupabaseClient<Database>;
}

describe("Operational Lifecycle Commands & Queries", () => {
  describe("archiveOperationalEntity", () => {
    it("returns mutation code on single row result", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: [{ success: true, code: "archived" }],
        error: null,
      });
      const supabase = mockSupabaseRpc(mockRpc);

      const result = await archiveOperationalEntity(supabase, {
        entityType: "project",
        entityId: VALID_UUID,
        reason: "Done",
      });

      expect(result).toEqual({ ok: true, data: { code: "archived" } });
      expect(mockRpc).toHaveBeenCalledWith("archive_operational_entity", {
        p_entity_type: "project",
        p_entity_id: VALID_UUID,
        p_reason: "Done",
      });
    });

    it("returns idempotent code", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: [{ success: true, code: "already_archived" }],
        error: null,
      });
      const supabase = mockSupabaseRpc(mockRpc);

      const result = await archiveOperationalEntity(supabase, {
        entityType: "task",
        entityId: VALID_UUID,
        reason: null,
      });

      expect(result).toEqual({ ok: true, data: { code: "already_archived" } });
    });

    it("returns failure code on failure result", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: [{ success: false, code: "not_found_or_archived" }],
        error: null,
      });
      const supabase = mockSupabaseRpc(mockRpc);

      const result = await archiveOperationalEntity(supabase, {
        entityType: "project",
        entityId: VALID_UUID,
        reason: null,
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "not_found_or_archived" },
      });
    });

    it("returns UNAVAILABLE on RPC error or empty rows", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      });
      const supabase = mockSupabaseRpc(mockRpc);

      const result = await archiveOperationalEntity(supabase, {
        entityType: "project",
        entityId: VALID_UUID,
        reason: null,
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "UNAVAILABLE" },
      });
    });
  });

  describe("restoreArchivedOperationalEntity", () => {
    it("returns mutation code on single row result", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: [{ success: true, code: "restored" }],
        error: null,
      });
      const supabase = mockSupabaseRpc(mockRpc);

      const result = await restoreArchivedOperationalEntity(supabase, {
        entityType: "deliverable",
        entityId: VALID_UUID,
      });

      expect(result).toEqual({ ok: true, data: { code: "restored" } });
    });
  });

  describe("permanentlyDeleteOperationalEntity", () => {
    it("returns mutation code on single row result", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: [{ success: true, code: "permanently_deleted" }],
        error: null,
      });
      const supabase = mockSupabaseRpc(mockRpc);

      const result = await permanentlyDeleteOperationalEntity(supabase, {
        entityType: "milestone",
        entityId: VALID_UUID,
      });

      expect(result).toEqual({
        ok: true,
        data: { code: "permanently_deleted" },
      });
    });
  });

  describe("fetchOperationalRecycleBin", () => {
    it("returns mapped DTOs on valid rows", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: [
          {
            entity_type: "project",
            entity_id: VALID_UUID,
            project_id: null,
            title: "Archived Project",
            archived_at: "2026-09-01T12:00:00.000Z",
            archived_by: null,
            archive_reason: "Test",
            parent_is_archived: false,
          },
        ],
        error: null,
      });
      const supabase = mockSupabaseRpc(mockRpc);

      const result = await fetchOperationalRecycleBin(supabase);

      expect(result).toEqual({
        status: "available",
        data: [
          {
            entityType: "project",
            entityId: VALID_UUID,
            projectId: null,
            title: "Archived Project",
            archivedAt: "2026-09-01T12:00:00.000Z",
            archivedBy: null,
            archiveReason: "Test",
            parentIsArchived: false,
          },
        ],
      });
    });

    it("returns status: unavailable if any row is malformed", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: [
          {
            entity_type: "project",
            entity_id: "invalid-uuid",
            title: "Archived Project",
            archived_at: "2026-09-01T12:00:00.000Z",
            archive_reason: null,
            parent_is_archived: false,
          },
        ],
        error: null,
      });
      const supabase = mockSupabaseRpc(mockRpc);

      const result = await fetchOperationalRecycleBin(supabase);
      expect(result).toEqual({ status: "unavailable" });
    });

    it("returns status: unavailable on RPC error", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "DB Error" },
      });
      const supabase = mockSupabaseRpc(mockRpc);

      const result = await fetchOperationalRecycleBin(supabase);
      expect(result).toEqual({ status: "unavailable" });
    });
  });

  describe("fetchOperationalDeletionPreview", () => {
    it("returns mapped preview when can_delete is true and blocker_code is null", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: [
          {
            entity_type: "project",
            entity_id: VALID_UUID,
            title: "Ready to delete",
            can_delete: true,
            blocker_code: null,
          },
        ],
        error: null,
      });
      const supabase = mockSupabaseRpc(mockRpc);

      const result = await fetchOperationalDeletionPreview(supabase, {
        entityType: "project",
        entityId: VALID_UUID,
      });

      expect(result).toEqual({
        status: "available",
        data: {
          entityType: "project",
          entityId: VALID_UUID,
          title: "Ready to delete",
          canDelete: true,
          blockerCode: null,
        },
      });
    });

    it("returns mapped preview when can_delete is false and blocker_code is non-null", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: [
          {
            entity_type: "task",
            entity_id: VALID_UUID,
            title: "Blocked task",
            can_delete: false,
            blocker_code: "dependencies_present",
          },
        ],
        error: null,
      });
      const supabase = mockSupabaseRpc(mockRpc);

      const result = await fetchOperationalDeletionPreview(supabase, {
        entityType: "task",
        entityId: VALID_UUID,
      });

      expect(result).toEqual({
        status: "available",
        data: {
          entityType: "task",
          entityId: VALID_UUID,
          title: "Blocked task",
          canDelete: false,
          blockerCode: "dependencies_present",
        },
      });
    });

    it("returns unavailable when invariant violated (can_delete true but blocker_code set)", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: [
          {
            entity_type: "task",
            entity_id: VALID_UUID,
            title: "Invariant violation",
            can_delete: true,
            blocker_code: "dependencies_present",
          },
        ],
        error: null,
      });
      const supabase = mockSupabaseRpc(mockRpc);

      const result = await fetchOperationalDeletionPreview(supabase, {
        entityType: "task",
        entityId: VALID_UUID,
      });

      expect(result).toEqual({ status: "unavailable" });
    });

    it("returns unavailable when title is null or empty", async () => {
      const mockRpc = vi.fn().mockResolvedValue({
        data: [
          {
            entity_type: "task",
            entity_id: VALID_UUID,
            title: "",
            can_delete: true,
            blocker_code: null,
          },
        ],
        error: null,
      });
      const supabase = mockSupabaseRpc(mockRpc);

      const result = await fetchOperationalDeletionPreview(supabase, {
        entityType: "task",
        entityId: VALID_UUID,
      });

      expect(result).toEqual({ status: "unavailable" });
    });
  });
});
