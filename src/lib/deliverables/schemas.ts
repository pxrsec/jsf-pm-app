import { z } from "zod";
import { isValidGoogleDriveUrl } from "./validators";

export const CreateDeliverableSchema = z.object({
  project_id: z.string().uuid("Invalid project ID"),
  task_id: z.string().uuid("Invalid task ID"),
  assignee_id: z.string().uuid("Invalid assignee ID"),
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Title is too long"),
  specifications: z
    .string()
    .trim()
    .min(1, "Specifications are required")
    .max(5000, "Specifications are too long"),
  workflow_type: z.enum(["production"]),
  submission_deadline_at: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional(),
  internal_review_deadline_at: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional(),
  client_delivery_deadline_at: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional(),
});

export type CreateDeliverableInput = z.infer<typeof CreateDeliverableSchema>;

export const UpdateDeliverableSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  specifications: z.string().trim().min(1).max(5000).optional(),
  assignee_id: z.string().uuid().optional(),
  submission_deadline_at: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional(),
  internal_review_deadline_at: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional(),
  client_delivery_deadline_at: z
    .string()
    .datetime({ offset: true })
    .nullable()
    .optional(),
});

export type UpdateDeliverableInput = z.infer<typeof UpdateDeliverableSchema>;

export const SubmitDeliverableVersionSchema = z.object({
  deliverable_id: z.string().uuid("Invalid deliverable ID"),
  submission_url: z
    .string({ required_error: "Submission URL is required" })
    .refine(
      (val) => isValidGoogleDriveUrl(val),
      "Submission URL must be a valid Google Drive HTTPS share link (https://drive.google.com/... or https://docs.google.com/...)",
    ),
  submission_note: z
    .string()
    .trim()
    .max(1000, "Note is too long")
    .nullable()
    .optional(),
});

export type SubmitDeliverableVersionInput = z.infer<
  typeof SubmitDeliverableVersionSchema
>;

export const ReviewDeliverableSchema = z
  .object({
    deliverable_id: z.string().uuid("Invalid deliverable ID"),
    stage: z.enum(["internal"]),
    decision: z.enum(["approved", "changes_requested"]),
    comments: z
      .string()
      .trim()
      .max(5000, "Comments are too long")
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.decision === "changes_requested") {
      if (!data.comments || data.comments.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A comment is required when requesting changes",
          path: ["comments"],
        });
      }
    }
  });

export type ReviewDeliverableInput = z.infer<typeof ReviewDeliverableSchema>;

export const ReportBrokenLinkSchema = z.object({
  deliverable_id: z.string().uuid("Invalid deliverable ID"),
  version_id: z.string().uuid("Invalid version ID"),
  reason: z
    .string()
    .trim()
    .min(1, "Reason is mandatory")
    .max(1000, "Reason is too long"),
});

export type ReportBrokenLinkInput = z.infer<typeof ReportBrokenLinkSchema>;
