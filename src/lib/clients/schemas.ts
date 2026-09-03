import { z } from "zod";

export const CreateClientSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, "Display name is required")
    .max(150, "Display name is too long"),
  legal_name: z
    .string()
    .trim()
    .min(1, "Legal name is required")
    .max(200, "Legal name is too long"),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(100, "Slug is too long")
    .regex(
      /^[a-z0-9-]+$/,
      "Slug must contain only lowercase alphanumeric characters and hyphens",
    ),
  default_drive_folder_url: z.string().url("Invalid URL").nullable().optional(),
  notes: z
    .string()
    .trim()
    .max(2000, "Notes are too long")
    .nullable()
    .optional(),
});

export type CreateClientInput = z.infer<typeof CreateClientSchema>;

export const saveClientContactSchema = z
  .object({
    contactId: z.string().uuid().nullable().optional(),
    fullName: z
      .string()
      .trim()
      .min(1, "Full name is required")
      .max(120, "Full name is too long"),
    email: z
      .string()
      .trim()
      .email("Invalid email address")
      .max(320, "Email is too long"),
    phoneE164: z
      .string()
      .trim()
      .regex(
        /^\+[1-9][0-9]{7,14}$/,
        "Phone must be in E.164 format (e.g. +525512345678)",
      )
      .nullable()
      .optional(),
    jobTitle: z
      .string()
      .trim()
      .min(1, "Job title cannot be empty")
      .max(120, "Job title is too long")
      .nullable()
      .optional(),
    clientId: z.string().uuid().nullable().optional(),
    isPrimary: z.boolean(),
  })
  .strict()
  .refine(
    (data) => {
      const isDirect = data.clientId === null || data.clientId === undefined;
      return !(isDirect && data.isPrimary);
    },
    {
      message: "Direct contacts cannot be designated as primary",
      path: ["isPrimary"],
    },
  );

export type SaveClientContactInput = z.infer<typeof saveClientContactSchema>;

export const setProjectClientContactSchema = z
  .object({
    projectId: z.string().uuid("Invalid project ID"),
    contactId: z.string().uuid("Invalid contact ID"),
    associated: z.boolean(),
  })
  .strict();

export type SetProjectClientContactInput = z.infer<
  typeof setProjectClientContactSchema
>;

export const loadProjectClientContactAssociationsSchema = z
  .object({
    projectId: z.string().uuid("Invalid project ID"),
  })
  .strict();

export type LoadProjectClientContactAssociationsInput = z.infer<
  typeof loadProjectClientContactAssociationsSchema
>;
