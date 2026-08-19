import { describe, it, expect } from "vitest";
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  TransitionProjectStatusSchema,
  RecoverProjectStatusSchema,
  AddProjectMemberSchema,
  UpdateProjectMemberSchema,
  CreateTaskSchema,
  UpdateTaskSchema,
  TransitionTaskStatusSchema,
} from "@/lib/projects/schemas";

describe("Project Domain Schemas", () => {
  const validClientId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  const validProjectId = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
  const validUserId = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33";
  const validTaskId = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44";
  const validIsoDate = "2026-09-01T12:00:00.000Z";

  describe("CreateProjectSchema", () => {
    it("accepts valid client project with client_id", () => {
      const result = CreateProjectSchema.safeParse({
        name: "Website Redesign",
        project_type: "client",
        internal_description: "Full redesign for client brand",
        deadline_at: validIsoDate,
        client_id: validClientId,
        client_scope: "Public marketing pages",
        drive_folder_url: "https://drive.google.com/drive/folders/test",
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid internal project without client_id", () => {
      const result = CreateProjectSchema.safeParse({
        name: "Internal Tooling Migration",
        project_type: "internal",
        internal_description: "Upgrading internal auth infrastructure",
        deadline_at: validIsoDate,
      });
      expect(result.success).toBe(true);
    });

    it("rejects client project without client_id", () => {
      const result = CreateProjectSchema.safeParse({
        name: "Website Redesign",
        project_type: "client",
        internal_description: "Missing client org",
        deadline_at: validIsoDate,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Client project requires a client organization",
        );
      }
    });

    it("rejects internal project with client_id", () => {
      const result = CreateProjectSchema.safeParse({
        name: "Internal Task",
        project_type: "internal",
        internal_description: "Should not have client",
        deadline_at: validIsoDate,
        client_id: validClientId,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Internal project cannot have a client organization",
        );
      }
    });

    it("rejects invalid date format", () => {
      const result = CreateProjectSchema.safeParse({
        name: "Project",
        project_type: "internal",
        internal_description: "Description",
        deadline_at: "not-a-date",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("UpdateProjectSchema", () => {
    it("accepts partial updates", () => {
      const result = UpdateProjectSchema.safeParse({
        name: "Updated Name",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("TransitionProjectStatusSchema", () => {
    it("accepts valid status transition", () => {
      const result = TransitionProjectStatusSchema.safeParse({
        project_id: validProjectId,
        next_status: "in_progress",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.confirm_unfinished).toBe(false);
      }
    });

    it("rejects invalid status", () => {
      const result = TransitionProjectStatusSchema.safeParse({
        project_id: validProjectId,
        next_status: "invalid_status",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("RecoverProjectStatusSchema", () => {
    it("requires a reason", () => {
      const result = RecoverProjectStatusSchema.safeParse({
        project_id: validProjectId,
        target_status: "planning",
        reason: "",
      });
      expect(result.success).toBe(false);
    });

    it("accepts valid recovery payload", () => {
      const result = RecoverProjectStatusSchema.safeParse({
        project_id: validProjectId,
        target_status: "in_progress",
        reason: "Administrative rollback of accidental cancellation",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("AddProjectMemberSchema & UpdateProjectMemberSchema", () => {
    it("accepts valid member addition", () => {
      const result = AddProjectMemberSchema.safeParse({
        project_id: validProjectId,
        user_id: validUserId,
        member_type: "pm_lead",
        is_primary: true,
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid member update", () => {
      const result = UpdateProjectMemberSchema.safeParse({
        member_id: validUserId,
        member_type: "pm_watcher",
        receives_notifications: false,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("CreateTaskSchema, UpdateTaskSchema, and TransitionTaskStatusSchema", () => {
    it("accepts valid task creation", () => {
      const result = CreateTaskSchema.safeParse({
        project_id: validProjectId,
        title: "Build landing page",
        description: "Implement hero and features section",
        task_type: "internal_work",
        priority: "high",
        deadline_at: validIsoDate,
        assignee_id: validUserId,
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid partial task update", () => {
      const result = UpdateTaskSchema.safeParse({
        title: "Updated task title",
        priority: "blocking",
      });
      expect(result.success).toBe(true);
    });

    it("accepts valid task status transition", () => {
      const result = TransitionTaskStatusSchema.safeParse({
        task_id: validTaskId,
        next_status: "in_review",
      });
      expect(result.success).toBe(true);
    });
  });
});
