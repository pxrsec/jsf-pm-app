import { describe, it, expect } from "vitest";
import { CreateCommentSchema } from "@/lib/comments/schemas";

describe("Comments Domain Schemas", () => {
  const validProjectId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  const validTargetId = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";

  it("accepts valid comment for project target", () => {
    const result = CreateCommentSchema.safeParse({
      project_id: validProjectId,
      target_type: "project",
      target_id: validTargetId,
      body: "Weekly sync scheduled for Thursday 10am.",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid comment for task target", () => {
    const result = CreateCommentSchema.safeParse({
      project_id: validProjectId,
      target_type: "task",
      target_id: validTargetId,
      body: "Waiting on font licensing approval before finalizing typography.",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid comment for deliverable target", () => {
    const result = CreateCommentSchema.safeParse({
      project_id: validProjectId,
      target_type: "deliverable",
      target_id: validTargetId,
      body: "Please verify if the audio mix is 5.1 or stereo.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid target type", () => {
    const result = CreateCommentSchema.safeParse({
      project_id: validProjectId,
      target_type: "invalid_type",
      target_id: validTargetId,
      body: "Comment",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty comment body", () => {
    const result = CreateCommentSchema.safeParse({
      project_id: validProjectId,
      target_type: "task",
      target_id: validTargetId,
      body: "   ",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Comment body cannot be empty",
      );
    }
  });
});
