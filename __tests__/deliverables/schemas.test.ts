import { describe, it, expect } from "vitest";
import {
  CreateDeliverableSchema,
  UpdateDeliverableSchema,
  SubmitDeliverableVersionSchema,
  ReviewDeliverableSchema,
  ReviewDeliverableActionSchema,
  MarkDeliverableDeliveredActionSchema,
  ReportBrokenLinkSchema,
} from "@/lib/deliverables/schemas";

describe("Deliverable Domain Schemas", () => {
  const validProjectId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  const validTaskId = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
  const validAssigneeId = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";
  const validDeliverableId = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";
  const validVersionId = "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55";
  const validDriveUrl = "https://drive.google.com/file/d/12345/view";

  describe("CreateDeliverableSchema", () => {
    it("accepts valid deliverable input without workflow_type", () => {
      const result = CreateDeliverableSchema.safeParse({
        project_id: validProjectId,
        task_id: validTaskId,
        assignee_id: validAssigneeId,
        title: "Brand Logo Animation",
        specifications: "1080p ProRes 422 render with alpha channel",
        internal_review_deadline_at: "2026-09-01T12:00:00Z",
        client_delivery_deadline_at: "2026-09-05T12:00:00Z",
      });
      expect(result.success).toBe(true);
    });

    it("rejects title exceeding 180 characters", () => {
      const result = CreateDeliverableSchema.safeParse({
        project_id: validProjectId,
        task_id: validTaskId,
        assignee_id: validAssigneeId,
        title: "a".repeat(181),
        specifications: "Specs",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("UpdateDeliverableSchema", () => {
    it("accepts partial updates", () => {
      const result = UpdateDeliverableSchema.safeParse({
        title: "Updated Title",
        specifications: "Updated Specs",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("SubmitDeliverableVersionSchema", () => {
    it("accepts valid Google Drive URL", () => {
      const result = SubmitDeliverableVersionSchema.safeParse({
        deliverable_id: validDeliverableId,
        submission_url: validDriveUrl,
        submission_note: "Render v2 with corrected color profile",
      });
      expect(result.success).toBe(true);
    });

    it("rejects non-Google Drive URLs", () => {
      const result = SubmitDeliverableVersionSchema.safeParse({
        deliverable_id: validDeliverableId,
        submission_url: "https://dropbox.com/s/123/file.mp4",
      });
      expect(result.success).toBe(false);
    });

    it("rejects URLs with whitespace or explicit ports without trimming", () => {
      const withWhitespace = SubmitDeliverableVersionSchema.safeParse({
        deliverable_id: validDeliverableId,
        submission_url: " https://drive.google.com/file/d/12345/view ",
      });
      expect(withWhitespace.success).toBe(false);

      const withPort = SubmitDeliverableVersionSchema.safeParse({
        deliverable_id: validDeliverableId,
        submission_url: "https://drive.google.com:443/file/d/12345/view",
      });
      expect(withPort.success).toBe(false);
    });
  });

  describe("ReviewDeliverableSchema", () => {
    it("accepts approval without comments", () => {
      const result = ReviewDeliverableSchema.safeParse({
        deliverable_id: validDeliverableId,
        stage: "internal",
        decision: "approved",
      });
      expect(result.success).toBe(true);
    });

    it("accepts changes_requested with non-empty comments", () => {
      const result = ReviewDeliverableSchema.safeParse({
        deliverable_id: validDeliverableId,
        stage: "internal",
        decision: "changes_requested",
        comments:
          "Audio level is clipping at 0:45 mark. Please re-export at -14 LUFS.",
      });
      expect(result.success).toBe(true);
    });

    it("rejects changes_requested with missing comments", () => {
      const result = ReviewDeliverableSchema.safeParse({
        deliverable_id: validDeliverableId,
        stage: "internal",
        decision: "changes_requested",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "A comment is required when requesting changes",
        );
      }
    });

    it("rejects changes_requested with whitespace-only comments", () => {
      const result = ReviewDeliverableSchema.safeParse({
        deliverable_id: validDeliverableId,
        stage: "internal",
        decision: "changes_requested",
        comments: "    ",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "A comment is required when requesting changes",
        );
      }
    });
  });

  describe("ReportBrokenLinkSchema", () => {
    it("accepts valid report", () => {
      const result = ReportBrokenLinkSchema.safeParse({
        deliverable_id: validDeliverableId,
        version_id: validVersionId,
        reason: "Access denied 403 when opening the Drive folder",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty reason", () => {
      const result = ReportBrokenLinkSchema.safeParse({
        deliverable_id: validDeliverableId,
        version_id: validVersionId,
        reason: "   ",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("ReviewDeliverableActionSchema", () => {
    it("accepts approved without comments", () => {
      const result = ReviewDeliverableActionSchema.safeParse({
        deliverable_id: validDeliverableId,
        decision: "approved",
      });
      expect(result.success).toBe(true);
    });

    it("accepts changes_requested with non-empty comments", () => {
      const result = ReviewDeliverableActionSchema.safeParse({
        deliverable_id: validDeliverableId,
        decision: "changes_requested",
        comments: "Audio fix needed at 00:30",
      });
      expect(result.success).toBe(true);
    });

    it("rejects changes_requested with whitespace-only comments", () => {
      const result = ReviewDeliverableActionSchema.safeParse({
        deliverable_id: validDeliverableId,
        decision: "changes_requested",
        comments: "   ",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid UUIDs", () => {
      const result = ReviewDeliverableActionSchema.safeParse({
        deliverable_id: "invalid-uuid",
        decision: "approved",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("MarkDeliverableDeliveredActionSchema", () => {
    it("accepts valid deliverable and project UUIDs", () => {
      const result = MarkDeliverableDeliveredActionSchema.safeParse({
        deliverable_id: validDeliverableId,
        project_id: validProjectId,
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid UUIDs", () => {
      const result = MarkDeliverableDeliveredActionSchema.safeParse({
        deliverable_id: "not-a-uuid",
        project_id: validProjectId,
      });
      expect(result.success).toBe(false);
    });
  });
});
