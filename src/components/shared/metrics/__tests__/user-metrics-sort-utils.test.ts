import { describe, expect, it } from "vitest";
import type { UserOperationsMetricDto } from "@/lib/user-operations-metrics/types";
import {
  formatMetricCount,
  formatMetricHours,
  formatMetricTimestamp,
  sortUserOperationsMetrics,
} from "../user-metrics-sort-utils";

describe("User Metrics Sort & Format Utils (user-metrics-sort-utils.ts)", () => {
  const userA: UserOperationsMetricDto = {
    userId: "00000000-0000-0000-0000-000000000001",
    fullName: "Alice Smith",
    applicationRole: "operator",
    isActive: true,
    currentActiveTaskCount: 2,
    taskAssignedCount: 3,
    taskStartedCount: 2,
    taskCompletedCount: 4,
    averageAssignmentToStartHours: 8.5,
    unstartedTaskCountAtRangeEnd: 2,
    productionDeliverableSubmissionCount: 1,
    clientSubmissionCount: 0,
    deliverableReviewCount: 1,
    deliverableDeliveredCount: 0,
    inAppNotificationReceivedCount: 5,
    inAppNotificationReadCount: 4,
    inAppNotificationUnreadCountAtRangeEnd: 1,
    inAppNotificationUnreadOver24hCountAtRangeEnd: 1,
    averageInAppNotificationReadHours: 2.0,
    lastWorkflowActionAt: "2026-08-20T10:00:00-06:00",
    rangeFrom: "2026-05-26T00:00:00-06:00",
    rangeTo: "2026-08-24T00:00:00-06:00",
  };

  const userB: UserOperationsMetricDto = {
    userId: "00000000-0000-0000-0000-000000000002",
    fullName: "Bob Jones",
    applicationRole: "pm",
    isActive: true,
    currentActiveTaskCount: 5,
    taskAssignedCount: 6,
    taskStartedCount: 5,
    taskCompletedCount: 2,
    averageAssignmentToStartHours: null,
    unstartedTaskCountAtRangeEnd: 0,
    productionDeliverableSubmissionCount: 0,
    clientSubmissionCount: 0,
    deliverableReviewCount: 5,
    deliverableDeliveredCount: 2,
    inAppNotificationReceivedCount: 10,
    inAppNotificationReadCount: 10,
    inAppNotificationUnreadCountAtRangeEnd: 0,
    inAppNotificationUnreadOver24hCountAtRangeEnd: 0,
    averageInAppNotificationReadHours: null,
    lastWorkflowActionAt: null,
    rangeFrom: "2026-05-26T00:00:00-06:00",
    rangeTo: "2026-08-24T00:00:00-06:00",
  };

  describe("1. Default RPC Sorting", () => {
    it("sorts by unstartedTaskCountAtRangeEnd desc by default", () => {
      const sorted = sortUserOperationsMetrics([userB, userA], null);
      expect(sorted[0].userId).toBe(userA.userId);
      expect(sorted[1].userId).toBe(userB.userId);
    });
  });

  describe("2. Field Sorting & Nulls-to-End Handling", () => {
    it("sorts by averageAssignmentToStartHours ascending, placing nulls at end", () => {
      const sorted = sortUserOperationsMetrics(
        [userB, userA],
        "averageAssignmentToStartHours",
        "asc",
      );
      expect(sorted[0].userId).toBe(userA.userId); // 8.5 hrs
      expect(sorted[1].userId).toBe(userB.userId); // null
    });

    it("sorts by averageAssignmentToStartHours descending, placing nulls at end", () => {
      const sorted = sortUserOperationsMetrics(
        [userB, userA],
        "averageAssignmentToStartHours",
        "desc",
      );
      expect(sorted[0].userId).toBe(userA.userId); // 8.5 hrs
      expect(sorted[1].userId).toBe(userB.userId); // null
    });

    it("sorts by lastWorkflowActionAt descending, placing nulls at end", () => {
      const sorted = sortUserOperationsMetrics(
        [userB, userA],
        "lastWorkflowActionAt",
        "desc",
      );
      expect(sorted[0].userId).toBe(userA.userId);
      expect(sorted[1].userId).toBe(userB.userId);
    });
  });

  describe("3. Intl Formatting Functions", () => {
    it("formats counts via Intl.NumberFormat", () => {
      expect(formatMetricCount(1234, "es-MX")).toBe("1,234");
      expect(formatMetricCount(0, "es-MX")).toBe("0");
    });

    it("formats hours with unit and handles null gracefully", () => {
      expect(
        formatMetricHours(12.345, "es-MX", "Sin observaciones", "hrs"),
      ).toBe("12.3 hrs");
      expect(formatMetricHours(null, "es-MX", "Sin observaciones", "hrs")).toBe(
        "Sin observaciones",
      );
    });

    it("formats ISO timestamps in America/Mexico_City", () => {
      const formatted = formatMetricTimestamp(
        "2026-08-20T10:00:00-06:00",
        "en-US",
        "No action",
      );
      expect(formatted).toContain("2026");
      expect(formatted).toContain("10:00");
      expect(formatMetricTimestamp(null, "en-US", "No action")).toBe(
        "No action",
      );
    });
  });
});
