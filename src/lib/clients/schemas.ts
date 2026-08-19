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
