import { describe, expect, it } from "vitest";
import { normalizeUserMetricsSearchState } from "../date-utils";

describe("User Operations Metrics Date Utils (date-utils.ts)", () => {
  const validFrom = "2026-05-26T00:00:00-06:00";
  const validTo = "2026-08-24T00:00:00-06:00";
  const validProjectId = "a0000000-0000-0000-0000-000000000001";
  const validUserId = "b0000000-0000-0000-0000-000000000002";

  it("normalizes valid query parameters for Admin", () => {
    const query = normalizeUserMetricsSearchState(
      {
        from: validFrom,
        to: validTo,
        projectId: validProjectId,
        userId: validUserId,
      },
      "admin",
    );

    expect(query.from).toBe(validFrom);
    expect(query.to).toBe(validTo);
    expect(query.projectId).toBe(validProjectId);
    expect(query.userId).toBe(validUserId);
  });

  it("falls back to default 90-day range when from/to are missing or invalid", () => {
    const query = normalizeUserMetricsSearchState({}, "admin");

    expect(query.from).toBeDefined();
    expect(query.to).toBeDefined();
    expect(query.projectId).toBeUndefined();
    expect(query.userId).toBeUndefined();
  });

  it("clears userId when validUserIds list is provided and does not include the parsed userId", () => {
    const query = normalizeUserMetricsSearchState(
      {
        from: validFrom,
        to: validTo,
        userId: validUserId,
      },
      "admin",
      {
        validUserIds: ["c0000000-0000-0000-0000-000000000003"],
      },
    );

    expect(query.userId).toBeUndefined();
  });

  it("preserves userId when present in validUserIds list", () => {
    const query = normalizeUserMetricsSearchState(
      {
        from: validFrom,
        to: validTo,
        userId: validUserId,
      },
      "admin",
      {
        validUserIds: [validUserId],
      },
    );

    expect(query.userId).toBe(validUserId);
  });

  it("PM normalization uses fixedProjectId when provided", () => {
    const query = normalizeUserMetricsSearchState(
      {
        from: validFrom,
        to: validTo,
      },
      "pm",
      {
        fixedProjectId: validProjectId,
      },
    );

    expect(query.projectId).toBe(validProjectId);
  });
});
