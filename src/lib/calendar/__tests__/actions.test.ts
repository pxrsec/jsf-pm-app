import { describe, expect, it } from "vitest";
import { CreateMilestoneSchema, UpdateMilestoneSchema } from "../schemas";

describe("milestone schemas", () => {
  const base = {
    scope: "project" as const,
    projectId: "00000000-0000-0000-0000-000000000001",
    title: "Target",
    description: null,
    targetDate: "2026-08-22",
    colorOverride: null,
    taskIds: [],
  };
  it("accepts a one-date project milestone", () =>
    expect(CreateMilestoneSchema.safeParse(base).success).toBe(true));
  it("accepts untracked company milestones and clears project scope at the contract", () =>
    expect(
      CreateMilestoneSchema.safeParse({
        ...base,
        scope: "company",
        projectId: null,
      }).success,
    ).toBe(true));
  it("rejects duplicate associations and missing project scope", () => {
    expect(
      CreateMilestoneSchema.safeParse({
        ...base,
        taskIds: [base.projectId, base.projectId],
      }).success,
    ).toBe(false);
    expect(
      UpdateMilestoneSchema.safeParse({
        ...base,
        milestoneId: base.projectId,
        projectId: null,
      }).success,
    ).toBe(false);
  });
});
