import { describe, it, expect } from "vitest";
import {
  UUID_SCHEMA,
  IsoTimestampSchema,
  NullableIsoTimestampSchema,
  UpdateOwnAccountSettingsSchema,
  UserAccessDirectoryCursorSchema,
  InitialUserAccessDirectoryCursorSchema,
  DeactivateUserAccessSchema,
  ReactivateUserAccessSchema,
  SetUserAccessStateInputSchema,
  RecordStaleReminderSchema,
  SubmitBugReportSchema,
  BugReportCursorSchema,
  InitialBugReportCursorSchema,
  SetBugReportStatusSchema,
} from "@/lib/account-access/schemas";

describe("Account Access Schemas", () => {
  const validUuid = "11111111-1111-4111-8111-111111111111";
  const validIso = "2026-09-02T12:00:00.000Z";

  describe("UUID_SCHEMA", () => {
    it("accepts valid UUIDs", () => {
      expect(UUID_SCHEMA.safeParse(validUuid).success).toBe(true);
    });

    it("rejects non-UUID strings", () => {
      expect(UUID_SCHEMA.safeParse("not-a-uuid").success).toBe(false);
      expect(UUID_SCHEMA.safeParse("").success).toBe(false);
    });
  });

  describe("IsoTimestampSchema & NullableIsoTimestampSchema", () => {
    it("accepts valid ISO-8601 timestamps with offset", () => {
      expect(IsoTimestampSchema.safeParse(validIso).success).toBe(true);
      expect(
        IsoTimestampSchema.safeParse("2026-09-02T06:00:00-06:00").success,
      ).toBe(true);
    });

    it("rejects non-ISO, invalid, or date-only strings", () => {
      expect(IsoTimestampSchema.safeParse("2026-09-02").success).toBe(false);
      expect(IsoTimestampSchema.safeParse("invalid-date").success).toBe(false);
      expect(IsoTimestampSchema.safeParse("").success).toBe(false);
      expect(IsoTimestampSchema.safeParse(null).success).toBe(false);
    });

    it("NullableIsoTimestampSchema accepts null and valid ISO", () => {
      expect(NullableIsoTimestampSchema.safeParse(null).success).toBe(true);
      expect(NullableIsoTimestampSchema.safeParse(validIso).success).toBe(true);
      expect(NullableIsoTimestampSchema.safeParse(undefined).success).toBe(
        false,
      );
      expect(NullableIsoTimestampSchema.safeParse("invalid").success).toBe(
        false,
      );
    });
  });

  describe("UpdateOwnAccountSettingsSchema", () => {
    it("accepts valid inputs and trims whitespace", () => {
      const result = UpdateOwnAccountSettingsSchema.safeParse({
        fullName: "  Ruben Test  ",
        preferredLocale: "es-MX",
        timezone: "  America/Mexico_City  ",
        emailNotificationsEnabled: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fullName).toBe("Ruben Test");
        expect(result.data.timezone).toBe("America/Mexico_City");
        expect(result.data.preferredLocale).toBe("es-MX");
        expect(result.data.emailNotificationsEnabled).toBe(true);
      }
    });

    it("rejects empty full name or >120 chars", () => {
      expect(
        UpdateOwnAccountSettingsSchema.safeParse({
          fullName: "   ",
          preferredLocale: "es-MX",
          timezone: "UTC",
          emailNotificationsEnabled: false,
        }).success,
      ).toBe(false);

      expect(
        UpdateOwnAccountSettingsSchema.safeParse({
          fullName: "a".repeat(121),
          preferredLocale: "es-MX",
          timezone: "UTC",
          emailNotificationsEnabled: false,
        }).success,
      ).toBe(false);
    });

    it("rejects invalid locale enum", () => {
      expect(
        UpdateOwnAccountSettingsSchema.safeParse({
          fullName: "Valid Name",
          preferredLocale: "fr-FR",
          timezone: "UTC",
          emailNotificationsEnabled: true,
        }).success,
      ).toBe(false);
    });

    it("rejects unknown keys (.strict)", () => {
      expect(
        UpdateOwnAccountSettingsSchema.safeParse({
          fullName: "Valid Name",
          preferredLocale: "es-MX",
          timezone: "UTC",
          emailNotificationsEnabled: true,
          extraField: "not allowed",
        }).success,
      ).toBe(false);
    });
  });

  describe("UserAccessDirectoryCursorSchema", () => {
    it("accepts valid non-null composite cursor", () => {
      const result = UserAccessDirectoryCursorSchema.safeParse({
        beforeCreatedAt: validIso,
        beforeUserId: validUuid,
      });
      expect(result.success).toBe(true);
    });

    it("rejects null, undefined, or partial cursors", () => {
      expect(UserAccessDirectoryCursorSchema.safeParse(null).success).toBe(
        false,
      );
      expect(UserAccessDirectoryCursorSchema.safeParse(undefined).success).toBe(
        false,
      );
      expect(
        UserAccessDirectoryCursorSchema.safeParse({ beforeCreatedAt: validIso })
          .success,
      ).toBe(false);
      expect(
        UserAccessDirectoryCursorSchema.safeParse({ beforeUserId: validUuid })
          .success,
      ).toBe(false);
    });

    it("rejects unknown keys (.strict)", () => {
      expect(
        UserAccessDirectoryCursorSchema.safeParse({
          beforeCreatedAt: validIso,
          beforeUserId: validUuid,
          extra: 123,
        }).success,
      ).toBe(false);
    });
  });

  describe("InitialUserAccessDirectoryCursorSchema", () => {
    it("accepts null and undefined for initial load", () => {
      expect(
        InitialUserAccessDirectoryCursorSchema.safeParse(null).success,
      ).toBe(true);
      expect(
        InitialUserAccessDirectoryCursorSchema.safeParse(undefined).success,
      ).toBe(true);
    });

    it("accepts valid cursor object", () => {
      expect(
        InitialUserAccessDirectoryCursorSchema.safeParse({
          beforeCreatedAt: validIso,
          beforeUserId: validUuid,
        }).success,
      ).toBe(true);
    });

    it("rejects partial or malformed cursor", () => {
      expect(
        InitialUserAccessDirectoryCursorSchema.safeParse({
          beforeCreatedAt: "bad",
        }).success,
      ).toBe(false);
    });
  });

  describe("DeactivateUserAccessSchema & ReactivateUserAccessSchema", () => {
    it("DeactivateUserAccessSchema requires isActive: false and confirmationFullName", () => {
      expect(
        DeactivateUserAccessSchema.safeParse({
          targetUserId: validUuid,
          isActive: false,
          confirmationFullName: "Target User",
        }).success,
      ).toBe(true);

      expect(
        DeactivateUserAccessSchema.safeParse({
          targetUserId: validUuid,
          isActive: false,
        }).success,
      ).toBe(false);
    });

    it("ReactivateUserAccessSchema requires isActive: true and rejects confirmationFullName", () => {
      expect(
        ReactivateUserAccessSchema.safeParse({
          targetUserId: validUuid,
          isActive: true,
        }).success,
      ).toBe(true);

      expect(
        ReactivateUserAccessSchema.safeParse({
          targetUserId: validUuid,
          isActive: true,
          confirmationFullName: "Not allowed",
        }).success,
      ).toBe(false);
    });
  });

  describe("SetUserAccessStateInputSchema (discriminated union)", () => {
    it("validates deactivation requiring confirmationFullName", () => {
      const result = SetUserAccessStateInputSchema.safeParse({
        targetUserId: validUuid,
        isActive: false,
        confirmationFullName: "  Target User  ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isActive).toBe(false);
        if (result.data.isActive === false) {
          expect(result.data.confirmationFullName).toBe("Target User");
        }
      }
    });

    it("rejects deactivation missing or empty confirmationFullName", () => {
      expect(
        SetUserAccessStateInputSchema.safeParse({
          targetUserId: validUuid,
          isActive: false,
        }).success,
      ).toBe(false);

      expect(
        SetUserAccessStateInputSchema.safeParse({
          targetUserId: validUuid,
          isActive: false,
          confirmationFullName: "   ",
        }).success,
      ).toBe(false);
    });

    it("validates reactivation omitting confirmationFullName", () => {
      const result = SetUserAccessStateInputSchema.safeParse({
        targetUserId: validUuid,
        isActive: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isActive).toBe(true);
      }
    });

    it("rejects reactivation that provides confirmationFullName (.strict)", () => {
      expect(
        SetUserAccessStateInputSchema.safeParse({
          targetUserId: validUuid,
          isActive: true,
          confirmationFullName: "Not allowed",
        }).success,
      ).toBe(false);
    });

    it("rejects invalid isActive boolean value", () => {
      expect(
        SetUserAccessStateInputSchema.safeParse({
          targetUserId: validUuid,
          isActive: "false",
        }).success,
      ).toBe(false);
    });
  });

  describe("RecordStaleReminderSchema", () => {
    it("accepts valid targetUserId", () => {
      expect(
        RecordStaleReminderSchema.safeParse({ targetUserId: validUuid })
          .success,
      ).toBe(true);
    });

    it("rejects invalid targetUserId and unknown keys", () => {
      expect(
        RecordStaleReminderSchema.safeParse({ targetUserId: "bad" }).success,
      ).toBe(false);
      expect(
        RecordStaleReminderSchema.safeParse({
          targetUserId: validUuid,
          extra: true,
        }).success,
      ).toBe(false);
    });
  });

  describe("SubmitBugReportSchema", () => {
    it("accepts valid title and description and trims them", () => {
      const result = SubmitBugReportSchema.safeParse({
        title: "  Crash on mobile navigation  ",
        description: "  Steps to reproduce: tap menu twice  ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toBe("Crash on mobile navigation");
        expect(result.data.description).toBe(
          "Steps to reproduce: tap menu twice",
        );
      }
    });

    it("rejects empty title or >160 chars", () => {
      expect(
        SubmitBugReportSchema.safeParse({
          title: "   ",
          description: "Valid description",
        }).success,
      ).toBe(false);

      expect(
        SubmitBugReportSchema.safeParse({
          title: "a".repeat(161),
          description: "Valid description",
        }).success,
      ).toBe(false);
    });

    it("rejects empty description or >5000 chars", () => {
      expect(
        SubmitBugReportSchema.safeParse({
          title: "Valid title",
          description: "   ",
        }).success,
      ).toBe(false);

      expect(
        SubmitBugReportSchema.safeParse({
          title: "Valid title",
          description: "a".repeat(5001),
        }).success,
      ).toBe(false);
    });

    it("rejects unknown keys (.strict)", () => {
      expect(
        SubmitBugReportSchema.safeParse({
          title: "Valid title",
          description: "Valid description",
          severity: "high",
        }).success,
      ).toBe(false);
    });
  });

  describe("BugReportCursorSchema & InitialBugReportCursorSchema", () => {
    it("BugReportCursorSchema requires complete composite cursor", () => {
      expect(
        BugReportCursorSchema.safeParse({
          beforeCreatedAt: validIso,
          beforeReportId: validUuid,
        }).success,
      ).toBe(true);
      expect(BugReportCursorSchema.safeParse(null).success).toBe(false);
      expect(
        BugReportCursorSchema.safeParse({ beforeCreatedAt: validIso }).success,
      ).toBe(false);
    });

    it("InitialBugReportCursorSchema accepts null/undefined", () => {
      expect(InitialBugReportCursorSchema.safeParse(null).success).toBe(true);
      expect(InitialBugReportCursorSchema.safeParse(undefined).success).toBe(
        true,
      );
    });
  });

  describe("SetBugReportStatusSchema", () => {
    it("accepts all four allowed statuses", () => {
      for (const status of [
        "open",
        "triaged",
        "resolved",
        "dismissed",
      ] as const) {
        expect(
          SetBugReportStatusSchema.safeParse({
            reportId: validUuid,
            status,
          }).success,
        ).toBe(true);
      }
    });

    it("rejects invalid status", () => {
      expect(
        SetBugReportStatusSchema.safeParse({
          reportId: validUuid,
          status: "closed",
        }).success,
      ).toBe(false);
    });

    it("rejects unknown keys (.strict)", () => {
      expect(
        SetBugReportStatusSchema.safeParse({
          reportId: validUuid,
          status: "open",
          note: "closing note",
        }).success,
      ).toBe(false);
    });
  });
});
