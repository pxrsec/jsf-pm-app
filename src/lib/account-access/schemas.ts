import { z } from "zod";

export const UUID_SCHEMA = z.string().uuid();
export const IsoTimestampSchema = z.string().datetime({ offset: true });
export const NullableIsoTimestampSchema = IsoTimestampSchema.nullable();

export const UpdateOwnAccountSettingsSchema = z
  .object({
    fullName: z.string().trim().min(1).max(120),
    preferredLocale: z.enum(["en-US", "es-MX"]),
    timezone: z.string().trim().min(1).max(100),
    emailNotificationsEnabled: z.boolean(),
  })
  .strict();

export const UserAccessDirectoryCursorSchema = z
  .object({
    beforeCreatedAt: IsoTimestampSchema,
    beforeUserId: UUID_SCHEMA,
  })
  .strict();

export const InitialUserAccessDirectoryCursorSchema =
  UserAccessDirectoryCursorSchema.nullable().optional();

export const DeactivateUserAccessSchema = z
  .object({
    targetUserId: UUID_SCHEMA,
    isActive: z.literal(false),
    confirmationFullName: z.string().trim().min(1).max(120),
  })
  .strict();

export const ReactivateUserAccessSchema = z
  .object({
    targetUserId: UUID_SCHEMA,
    isActive: z.literal(true),
  })
  .strict();

export const SetUserAccessStateInputSchema = z.discriminatedUnion("isActive", [
  DeactivateUserAccessSchema,
  ReactivateUserAccessSchema,
]);

export const RecordStaleReminderSchema = z
  .object({
    targetUserId: UUID_SCHEMA,
  })
  .strict();

export const SubmitBugReportSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().min(1).max(5000),
  })
  .strict();

export const BugReportCursorSchema = z
  .object({
    beforeCreatedAt: IsoTimestampSchema,
    beforeReportId: UUID_SCHEMA,
  })
  .strict();

export const InitialBugReportCursorSchema =
  BugReportCursorSchema.nullable().optional();

export const SetBugReportStatusSchema = z
  .object({
    reportId: UUID_SCHEMA,
    status: z.enum(["open", "triaged", "resolved", "dismissed"]),
  })
  .strict();
