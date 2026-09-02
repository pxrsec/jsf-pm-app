import { describe, expect, it } from "vitest";
import {
  ArchiveOperationalEntitySchema,
  GetOperationalDeletionPreviewSchema,
  PermanentlyDeleteOperationalEntitySchema,
  RestoreArchivedOperationalEntitySchema,
  normalizeArchiveInput,
} from "@/lib/operational-lifecycle/schemas";

const VALID_UUID = "12345678-1234-4234-8234-123456789012";

describe("Operational Lifecycle Schemas & Normalization", () => {
  describe("normalizeArchiveInput", () => {
    it("normalizes blank string reason to null", () => {
      const normalized = normalizeArchiveInput({
        entityType: "project",
        entityId: VALID_UUID,
        reason: "   ",
      });
      expect(normalized.reason).toBeNull();
    });

    it("normalizes empty string reason to null", () => {
      const normalized = normalizeArchiveInput({
        entityType: "task",
        entityId: VALID_UUID,
        reason: "",
      });
      expect(normalized.reason).toBeNull();
    });

    it("normalizes undefined reason to null", () => {
      const normalized = normalizeArchiveInput({
        entityType: "deliverable",
        entityId: VALID_UUID,
      });
      expect(normalized.reason).toBeNull();
    });

    it("normalizes null reason to null", () => {
      const normalized = normalizeArchiveInput({
        entityType: "milestone",
        entityId: VALID_UUID,
        reason: null,
      });
      expect(normalized.reason).toBeNull();
    });

    it("trims non-blank reason", () => {
      const normalized = normalizeArchiveInput({
        entityType: "project",
        entityId: VALID_UUID,
        reason: "  Project finished on time  ",
      });
      expect(normalized.reason).toBe("Project finished on time");
    });
  });

  describe("ArchiveOperationalEntitySchema", () => {
    it("accepts valid input with null reason", () => {
      const parsed = ArchiveOperationalEntitySchema.safeParse({
        entityType: "project",
        entityId: VALID_UUID,
        reason: null,
      });
      expect(parsed.success).toBe(true);
    });

    it("accepts all 4 entity types", () => {
      for (const type of ["project", "task", "deliverable", "milestone"]) {
        const parsed = ArchiveOperationalEntitySchema.safeParse({
          entityType: type,
          entityId: VALID_UUID,
          reason: "Valid reason",
        });
        expect(parsed.success).toBe(true);
      }
    });

    it("rejects invalid entity type", () => {
      const parsed = ArchiveOperationalEntitySchema.safeParse({
        entityType: "user",
        entityId: VALID_UUID,
        reason: null,
      });
      expect(parsed.success).toBe(false);
    });

    it("rejects invalid entity UUID", () => {
      const parsed = ArchiveOperationalEntitySchema.safeParse({
        entityType: "project",
        entityId: "not-a-uuid",
        reason: null,
      });
      expect(parsed.success).toBe(false);
    });

    it("rejects reason over 1000 chars", () => {
      const parsed = ArchiveOperationalEntitySchema.safeParse({
        entityType: "project",
        entityId: VALID_UUID,
        reason: "a".repeat(1001),
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe("RestoreArchivedOperationalEntitySchema", () => {
    it("accepts valid input", () => {
      const parsed = RestoreArchivedOperationalEntitySchema.safeParse({
        entityType: "task",
        entityId: VALID_UUID,
      });
      expect(parsed.success).toBe(true);
    });

    it("rejects invalid UUID", () => {
      const parsed = RestoreArchivedOperationalEntitySchema.safeParse({
        entityType: "task",
        entityId: "invalid",
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe("GetOperationalDeletionPreviewSchema", () => {
    it("accepts valid input", () => {
      const parsed = GetOperationalDeletionPreviewSchema.safeParse({
        entityType: "deliverable",
        entityId: VALID_UUID,
      });
      expect(parsed.success).toBe(true);
    });
  });

  describe("PermanentlyDeleteOperationalEntitySchema", () => {
    it("accepts valid input", () => {
      const parsed = PermanentlyDeleteOperationalEntitySchema.safeParse({
        entityType: "milestone",
        entityId: VALID_UUID,
      });
      expect(parsed.success).toBe(true);
    });
  });
});
