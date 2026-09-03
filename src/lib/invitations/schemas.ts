import { z } from "zod";

export const invitationLinkLocaleSchema = z.enum(["es-MX", "en-US"]);

export const ordinaryInvitationCursorSchema = z
  .object({
    beforeCreatedAt: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: "beforeCreatedAt must be a valid ISO timestamp",
    }),
    beforeInvitationId: z.string().uuid("Invalid invitation ID"),
  })
  .strict();

export type OrdinaryInvitationCursorInput = z.infer<
  typeof ordinaryInvitationCursorSchema
>;

export const loadOrdinaryInvitationPageSchema = z
  .object({
    cursor: ordinaryInvitationCursorSchema.nullable().optional(),
    limit: z.number().int().min(1).max(50).optional(),
  })
  .strict();

export type LoadOrdinaryInvitationPageInput = z.infer<
  typeof loadOrdinaryInvitationPageSchema
>;

export const createOrdinaryInvitationSchema = z.discriminatedUnion("role", [
  z
    .object({
      role: z.literal("client"),
      contactId: z.string().uuid("Valid contact ID is required"),
      projectId: z.string().uuid("Invalid project ID").nullable().optional(),
      expiresInHours: z
        .number()
        .int()
        .min(1, "Expiration must be at least 1 hour")
        .max(720, "Expiration cannot exceed 720 hours")
        .optional()
        .default(168),
    })
    .strict(),
  z
    .object({
      role: z.literal("operator"),
      recipientEmail: z
        .string()
        .trim()
        .email("Valid email is required")
        .max(320, "Email is too long"),
      projectId: z.string().uuid("Invalid project ID").nullable().optional(),
      expiresInHours: z
        .number()
        .int()
        .min(1, "Expiration must be at least 1 hour")
        .max(720, "Expiration cannot exceed 720 hours")
        .optional()
        .default(168),
    })
    .strict(),
]);

export type CreateOrdinaryInvitationInput = z.infer<
  typeof createOrdinaryInvitationSchema
>;

export const rotateOrdinaryInvitationSchema = z
  .object({
    invitationId: z.string().uuid("Invalid invitation ID"),
    expiresInHours: z
      .number()
      .int()
      .min(1, "Expiration must be at least 1 hour")
      .max(720, "Expiration cannot exceed 720 hours")
      .optional()
      .default(168),
  })
  .strict();

export type RotateOrdinaryInvitationInput = z.infer<
  typeof rotateOrdinaryInvitationSchema
>;

export const revokeOrdinaryInvitationSchema = z
  .object({
    invitationId: z.string().uuid("Invalid invitation ID"),
  })
  .strict();

export type RevokeOrdinaryInvitationInput = z.infer<
  typeof revokeOrdinaryInvitationSchema
>;
