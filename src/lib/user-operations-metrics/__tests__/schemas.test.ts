import { describe, expect, it } from "vitest";
import {
  adminUserMetricsQuerySchema,
  pmUserMetricsQuerySchema,
  userMetricsDateRangeSchema,
} from "../schemas";

describe("User Operations Metrics Schemas (schemas.ts)", () => {
  const validFrom = "2026-05-26T00:00:00-06:00";
  const validTo = "2026-08-24T00:00:00-06:00";
  const validUuid = "a0000000-0000-0000-0000-000000000001";

  describe("1. Date Range Schema", () => {
    it("accepts valid offset-bearing ISO date range", () => {
      const parsed = userMetricsDateRangeSchema.safeParse({
        from: validFrom,
        to: validTo,
      });
      expect(parsed.success).toBe(true);
    });

    it("rejects date-only strings without offset or time", () => {
      const parsed = userMetricsDateRangeSchema.safeParse({
        from: "2026-05-26",
        to: "2026-08-24",
      });
      expect(parsed.success).toBe(false);
    });

    it("rejects ISO strings without offset", () => {
      const parsed = userMetricsDateRangeSchema.safeParse({
        from: "2026-05-26T00:00:00",
        to: "2026-08-24T00:00:00",
      });
      expect(parsed.success).toBe(false);
    });

    it("rejects inverted date range (from >= to)", () => {
      const parsed = userMetricsDateRangeSchema.safeParse({
        from: validTo,
        to: validFrom,
      });
      expect(parsed.success).toBe(false);
    });

    it("rejects date range exceeding 93 days", () => {
      const parsed = userMetricsDateRangeSchema.safeParse({
        from: "2026-01-01T00:00:00-06:00",
        to: "2026-05-01T00:00:00-06:00", // ~120 days
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe("2. Admin Query Schema", () => {
    it("accepts valid query without projectId or userId", () => {
      const parsed = adminUserMetricsQuerySchema.safeParse({
        from: validFrom,
        to: validTo,
      });
      expect(parsed.success).toBe(true);
    });

    it("accepts valid query with optional projectId and userId", () => {
      const parsed = adminUserMetricsQuerySchema.safeParse({
        from: validFrom,
        to: validTo,
        projectId: validUuid,
        userId: validUuid,
      });
      expect(parsed.success).toBe(true);
    });

    it("rejects invalid UUID for projectId", () => {
      const parsed = adminUserMetricsQuerySchema.safeParse({
        from: validFrom,
        to: validTo,
        projectId: "not-a-uuid",
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe("3. PM Query Schema", () => {
    it("accepts valid query without projectId or userId", () => {
      const parsed = pmUserMetricsQuerySchema.safeParse({
        from: validFrom,
        to: validTo,
      });
      expect(parsed.success).toBe(true);
    });

    it("accepts valid query with optional projectId and userId", () => {
      const parsed = pmUserMetricsQuerySchema.safeParse({
        from: validFrom,
        to: validTo,
        projectId: validUuid,
        userId: validUuid,
      });
      expect(parsed.success).toBe(true);
    });

    it("rejects invalid UUID for projectId", () => {
      const parsed = pmUserMetricsQuerySchema.safeParse({
        from: validFrom,
        to: validTo,
        projectId: "not-a-uuid",
      });
      expect(parsed.success).toBe(false);
    });
  });
});
